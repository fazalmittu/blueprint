import type { Workflow } from "@/types";
import { WorkflowCard } from "./WorkflowCard";

interface WorkflowBoardProps {
  workflows: Workflow[];
}

/**
 * Renders all workflows stacked vertically.
 * No overlap, no selection logic.
 */
export function WorkflowBoard({ workflows }: WorkflowBoardProps) {
  if (workflows.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.875rem",
        }}
      >
        No workflows yet
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
        padding: "var(--space-lg)",
        overflowY: "auto",
        height: "100%",
      }}
    >
      {workflows.map((workflow) => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
    </div>
  );
}

