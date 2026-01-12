from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from .runner import EvalResult


def _format_table(rows: list[list[str]], headers: list[str]) -> str:
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))
    sep = "┼".join("─" * (w + 2) for w in widths)
    line = f"├{sep}┤"
    top = f"┌{sep}┐"
    bottom = f"└{sep}┘"

    def fmt_row(row_vals: list[str]) -> str:
        cells = [f" {cell}{' ' * (widths[i]-len(cell))} " for i, cell in enumerate(row_vals)]
        return f"│{'│'.join(cells)}│"

    out = [top, fmt_row(headers), line]
    for row in rows:
        out.append(fmt_row(row))
    out.append(bottom)
    return "\n".join(out)


def print_summary(result: EvalResult, metrics_to_show: Iterable[str]):
    metrics_to_show = list(metrics_to_show)
    rows: list[list[str]] = []
    for strat in result.strategy_results:
        row = [strat.strategy]
        for m in metrics_to_show:
            row.append(f"{strat.metrics.get(m, 0):.3f}")
        rows.append(row)
    table = _format_table(rows, headers=["Strategy", *metrics_to_show])
    print(f"\nRetrieval Eval Results — dataset={result.dataset_name}")
    print(table)


def save_markdown(result: EvalResult, path: str | Path, metrics_to_show: Iterable[str]):
    metrics_to_show = list(metrics_to_show)
    lines = [f"# Retrieval Eval Results", "", f"- Dataset: `{result.dataset_name}`", f"- Generated: {result.generated_at}", ""]
    header = "| Strategy | " + " | ".join(metrics_to_show) + " |"
    sep = "|---|" + "|".join("---" for _ in metrics_to_show) + "|"
    lines.extend([header, sep])
    for strat in result.strategy_results:
        values = " | ".join(f"{strat.metrics.get(m, 0):.3f}" for m in metrics_to_show)
        lines.append(f"| {strat.strategy} | {values} |")
    Path(path).write_text("\n".join(lines))


def maybe_save_plots(result: EvalResult, output_dir: str | Path, metrics: list[str]):
    """
    Save bar charts if matplotlib is available. Best-effort; no hard dependency.
    """
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return None

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []

    strategies = [s.strategy for s in result.strategy_results]
    for metric in metrics:
        values = [s.metrics.get(metric, 0) for s in result.strategy_results]
        plt.figure(figsize=(6, 4))
        plt.bar(strategies, values, color="#3b82f6")
        plt.ylabel(metric)
        plt.title(f"{metric} by strategy")
        plt.ylim(0, 1)
        plt.grid(axis="y", alpha=0.2)
        fname = output_dir / f"{metric.replace('@','-')}.png"
        plt.tight_layout()
        plt.savefig(fname)
        plt.close()
        paths.append(fname)
    return paths


def save_case_details(result: EvalResult, path: str | Path):
    Path(path).write_text(json.dumps([cr.__dict__ for cr in result.case_results], indent=2))
