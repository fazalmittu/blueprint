from __future__ import annotations

import argparse
from pathlib import Path
from datetime import datetime, timezone

from .dataset import EvalDataset
from .report import maybe_save_plots, print_summary, save_case_details, save_markdown
from .runner import evaluate_strategies


def main():
    parser = argparse.ArgumentParser(description="Run retrieval evaluation")
    parser.add_argument("--dataset", type=str, default="eval/eval_data/ground_truth.json")
    parser.add_argument(
        "--strategies",
        type=str,
        nargs="+",
        default=["title_first"],
        help="Strategy names to evaluate (must already be registered)",
    )
    parser.add_argument("--k", type=int, nargs="+", default=[3, 5, 10], help="K values for metrics")
    parser.add_argument(
        "--out",
        type=str,
        default="eval/results",
        help="Directory to write results/plots",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        help="top_k passed into strategies (default=max K)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of test cases to run (for quick testing)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print verbose output during evaluation",
    )
    args = parser.parse_args()

    dataset = EvalDataset.load(args.dataset)
    
    # Apply limit if specified
    if args.limit:
        dataset.test_cases = dataset.test_cases[:args.limit]
        print(f"📊 Running with {len(dataset.test_cases)} test cases (limited)")
    else:
        print(f"📊 Running with {len(dataset.test_cases)} test cases")
    result = evaluate_strategies(
        dataset=dataset,
        strategy_names=args.strategies,
        k_values=args.k,
        top_k=args.top_k,
    )

    # Print to terminal
    metrics_to_show = [f"recall@{max(args.k)}", f"precision@{max(args.k)}", "mrr", f"ndcg@{max(args.k)}"]
    print_summary(result, metrics_to_show)

    # Create run-specific directory
    base_out_dir = Path(args.out)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    run_dir = base_out_dir / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)
    
    # Save with simpler names inside run directory
    json_path = run_dir / f"{dataset.name}.json"
    md_path = run_dir / f"{dataset.name}.md"
    cases_path = run_dir / f"{dataset.name}-cases.json"
    plots_dir = run_dir / "plots"
    
    json_path.write_text(result.to_json())
    save_markdown(result, md_path, metrics_to_show)
    save_case_details(result, cases_path)
    maybe_save_plots(result, plots_dir, metrics=[f"recall@{k}" for k in args.k])

    print(f"\n📁 Results saved to: {run_dir}/")
    print(f"   - {json_path.name}")
    print(f"   - {md_path.name}")
    print(f"   - {cases_path.name}")
    if plots_dir.exists():
        print(f"   - plots/")


if __name__ == "__main__":
    main()
