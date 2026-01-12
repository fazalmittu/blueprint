from __future__ import annotations

import math
from typing import Iterable, Mapping


def make_doc_id(doc_type: str, meeting_id: str, source_id: str | None = None) -> str:
    """Canonical doc id used for comparisons."""
    tail = source_id or ""
    return f"{doc_type}:{meeting_id}:{tail}"


def precision_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    if k == 0:
        return 0.0
    topk = retrieved[:k]
    if not topk:
        return 0.0
    hits = sum(1 for d in topk if d in relevant)
    return hits / len(topk)


def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 0.0
    topk = retrieved[:k]
    hits = sum(1 for d in topk if d in relevant)
    return hits / len(relevant)


def hit_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    topk = retrieved[:k]
    return 1.0 if any(d in relevant for d in topk) else 0.0


def mrr(retrieved: list[str], relevant: set[str]) -> float:
    for idx, doc_id in enumerate(retrieved):
        if doc_id in relevant:
            return 1.0 / (idx + 1)
    return 0.0


def ndcg_at_k(retrieved: list[str], rel_grades: Mapping[str, int], k: int) -> float:
    def dcg(scores: Iterable[int]) -> float:
        return sum(score / math.log2(i + 2) for i, score in enumerate(scores))

    topk = retrieved[:k]
    gains = [rel_grades.get(doc_id, 0) for doc_id in topk]
    actual = dcg(gains)

    # Ideal DCG
    ideal_gains = sorted(rel_grades.values(), reverse=True)[:k]
    ideal = dcg(ideal_gains) if ideal_gains else 0.0
    if ideal == 0:
        return 0.0
    return actual / ideal


def compute_all_metrics(
    retrieved: list[str],
    relevant_with_grades: Mapping[str, int],
    k_values: Iterable[int],
) -> dict:
    relevant_set = {doc_id for doc_id, grade in relevant_with_grades.items() if grade > 0}
    metrics: dict[str, float] = {}
    for k in k_values:
        metrics[f"precision@{k}"] = precision_at_k(retrieved, relevant_set, k)
        metrics[f"recall@{k}"] = recall_at_k(retrieved, relevant_set, k)
        metrics[f"hit@{k}"] = hit_at_k(retrieved, relevant_set, k)
        metrics[f"ndcg@{k}"] = ndcg_at_k(retrieved, relevant_with_grades, k)
    metrics["mrr"] = mrr(retrieved, relevant_set)
    return metrics
