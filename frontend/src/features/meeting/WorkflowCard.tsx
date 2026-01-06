import type { Workflow } from "@/types";
import { MermaidDiagram } from "./MermaidDiagram";

interface WorkflowCardProps {
  workflow: Workflow;
}

/**
 * Displays a single workflow with title, sources, and diagram.
 */
export function WorkflowCard({ workflow }: WorkflowCardProps) {
  return (
    <article
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "var(--space-md) var(--space-lg)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-md)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {workflow.title}
        </h3>
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {workflow.sources.length} sources
        </span>
      </header>

      {/* Diagram */}
      <div
        style={{
          background: "var(--bg-primary)",
          minHeight: "200px",
        }}
      >
        <MermaidDiagram id={workflow.id} diagram={workflow.mermaidDiagram} />
      </div>
    </article>
  );
}

