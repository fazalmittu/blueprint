from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List


@dataclass
class RelevantDoc:
    doc_id: str
    relevance: int = 1  # 1 = relevant, 2 = highly relevant


@dataclass
class TestCase:
    id: str
    query: str
    org_id: str
    relevant_docs: List[RelevantDoc]
    tags: List[str] = field(default_factory=list)


@dataclass
class EvalDataset:
    """Container for all eval test cases."""

    name: str
    test_cases: List[TestCase]

    @classmethod
    def load(cls, path: str | Path) -> "EvalDataset":
        data = json.loads(Path(path).read_text())
        name = data.get("name") or Path(path).stem
        cases: list[TestCase] = []
        for tc in data.get("test_cases", []):
            relevant = [
                RelevantDoc(doc_id=rd["doc_id"], relevance=rd.get("relevance", 1))
                for rd in tc.get("relevant_docs", [])
            ]
            cases.append(
                TestCase(
                    id=tc["id"],
                    query=tc["query"],
                    org_id=tc["org_id"],
                    relevant_docs=relevant,
                    tags=tc.get("tags", []),
                )
            )
        return cls(name=name, test_cases=cases)

    def dump(self, path: str | Path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "name": self.name,
            "test_cases": [
                {
                    "id": tc.id,
                    "query": tc.query,
                    "org_id": tc.org_id,
                    "tags": tc.tags,
                    "relevant_docs": [
                        {"doc_id": rd.doc_id, "relevance": rd.relevance}
                        for rd in tc.relevant_docs
                    ],
                }
                for tc in self.test_cases
            ],
        }
        path.write_text(json.dumps(payload, indent=2))

    def subset_by_org(self, org_ids: Iterable[str]) -> "EvalDataset":
        org_set = set(org_ids)
        return EvalDataset(
            name=f"{self.name}-subset",
            test_cases=[tc for tc in self.test_cases if tc.org_id in org_set],
        )
