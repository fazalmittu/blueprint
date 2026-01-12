"""
Heuristic dataset builder to produce ~30 test cases from existing meetings.

Usage:
    python -m eval.generate_synthetic --out eval/eval_data/ground_truth.json

Notes:
    - Requires the database to be seeded (seed_db.py).
    - Does NOT change strategy code; it only writes a JSON dataset.
    - If there are fewer than 30 meetings, it will generate as many as possible.
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import database as db
from eval.dataset import EvalDataset, RelevantDoc, TestCase
from eval.metrics import make_doc_id


def _load_meetings():
    meetings = db.get_db().execute("SELECT meetingId, orgId, title FROM meetings").fetchall()
    return [{"meeting_id": m[0], "org_id": m[1], "title": m[2] or "Untitled Meeting"} for m in meetings]


def _load_workflows(meeting_id: str):
    workflows = db.get_db().execute(
        "SELECT id, title FROM workflows WHERE meetingId = ?", (meeting_id,)
    ).fetchall()
    return [{"workflow_id": w[0], "title": w[1] or "Workflow"} for w in workflows]


def build_dataset(target_count: int = 30) -> EvalDataset:
    meetings = _load_meetings()
    random.shuffle(meetings)
    test_cases: list[TestCase] = []

    for meeting in meetings:
        if len(test_cases) >= target_count:
            break
        meeting_id = meeting["meeting_id"]
        org_id = meeting["org_id"]
        title = meeting["title"]

        # Base query about the meeting
        tc_id = f"{org_id}-{len(test_cases):03d}"
        test_cases.append(
            TestCase(
                id=tc_id,
                query=f"What was discussed in '{title}'?",
                org_id=org_id,
                relevant_docs=[RelevantDoc(doc_id=make_doc_id("meeting_notes", meeting_id))],
                tags=["meeting", "summary"],
            )
        )

        # Workflow-specific queries
        workflows = _load_workflows(meeting_id)
        for wf in workflows[:2]:  # cap per meeting to keep volume reasonable
            if len(test_cases) >= target_count:
                break
            wf_tc_id = f"{org_id}-{len(test_cases):03d}"
            test_cases.append(
                TestCase(
                    id=wf_tc_id,
                    query=f"Describe the workflow '{wf['title']}' from {title}",
                    org_id=org_id,
                    relevant_docs=[
                        RelevantDoc(
                            doc_id=make_doc_id("workflow_summary", meeting_id, wf["workflow_id"]),
                            relevance=2,
                        ),
                        RelevantDoc(
                            doc_id=make_doc_id("meeting_notes", meeting_id),
                            relevance=1,
                        ),
                    ],
                    tags=["workflow", "process"],
                )
            )

    name = f"synthetic-{target_count}"
    return EvalDataset(name=name, test_cases=test_cases[:target_count])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=str, default="eval/eval_data/ground_truth.json")
    parser.add_argument("--count", type=int, default=30, help="Number of test cases to generate")
    args = parser.parse_args()

    dataset = build_dataset(target_count=args.count)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    dataset.dump(args.out)
    print(f"Wrote dataset with {len(dataset.test_cases)} cases to {args.out}")


if __name__ == "__main__":
    main()
