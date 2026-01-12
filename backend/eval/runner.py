from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List, Mapping

from search.service import get_search_service
from search.strategies.base import SearchResult

from .dataset import EvalDataset, TestCase
from .metrics import compute_all_metrics, make_doc_id


@dataclass
class CaseResult:
    test_case_id: str
    strategy: str
    metrics: Mapping[str, float]
    retrieved: list[str]
    relevant: Mapping[str, int]


@dataclass
class StrategyAggregate:
    strategy: str
    metrics: Mapping[str, float]


@dataclass
class EvalResult:
    dataset_name: str
    strategy_results: list[StrategyAggregate]
    case_results: list[CaseResult]
    generated_at: str = field(default_factory=lambda: dt.datetime.utcnow().isoformat() + "Z")

    def to_json(self) -> str:
        return json.dumps(
            {
                "dataset": self.dataset_name,
                "generated_at": self.generated_at,
                "strategy_results": self.strategy_results,
                "case_results": self.case_results,
            },
            default=lambda o: o.__dict__,
            indent=2,
        )


def _extract_doc_ids(result: SearchResult) -> list[str]:
    # Use provided score ordering if present; otherwise keep order.
    sources = sorted(result.sources, key=lambda s: getattr(s, "score", 0), reverse=True)
    return [
        make_doc_id(s.doc_type, s.meeting_id, s.source_id)
        for s in sources
    ]


def evaluate_strategies(
    dataset: EvalDataset,
    strategy_names: Iterable[str],
    k_values: Iterable[int] = (3, 5, 10),
    top_k: int | None = None,
) -> EvalResult:
    """
    Run evaluation for specified strategies.

    Args:
        dataset: Loaded EvalDataset
        strategy_names: iterable of strategy names to evaluate
        k_values: metrics cutoffs
        top_k: override top_k passed to strategies; defaults to max(k_values)
    """
    service = get_search_service()
    k_values = list(k_values)
    max_k = top_k or max(k_values)
    case_results: list[CaseResult] = []

    for strategy in strategy_names:
        for tc in dataset.test_cases:
            result = service.search(
                query=tc.query,
                org_id=tc.org_id,
                strategy_name=strategy,
                top_k=max_k,
            )
            retrieved_ids = _extract_doc_ids(result)
            relevant_map = {rd.doc_id: rd.relevance for rd in tc.relevant_docs}
            metrics = compute_all_metrics(retrieved_ids, relevant_map, k_values)
            case_results.append(
                CaseResult(
                    test_case_id=tc.id,
                    strategy=strategy,
                    metrics=metrics,
                    retrieved=retrieved_ids,
                    relevant=relevant_map,
                )
            )

    # Aggregate per strategy
    strategy_results: list[StrategyAggregate] = []
    for strategy in strategy_names:
        # average metrics across cases for this strategy
        filtered = [cr for cr in case_results if cr.strategy == strategy]
        if not filtered:
            continue
        keys = filtered[0].metrics.keys()
        agg = {
            k: sum(cr.metrics[k] for cr in filtered) / len(filtered)
            for k in keys
        }
        strategy_results.append(StrategyAggregate(strategy=strategy, metrics=agg))

    return EvalResult(
        dataset_name=dataset.name,
        strategy_results=strategy_results,
        case_results=case_results,
    )


def save_result(result: EvalResult, output_dir: str | Path) -> Path:
    ts = dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"eval-{result.dataset_name}-{ts}.json"
    out_path.write_text(result.to_json())
    return out_path
