import type { CurrentStateData } from "@/types";
import { Sidebar } from "./Sidebar";
import { WorkflowBoard } from "./WorkflowBoard";

interface CanvasProps {
  state: CurrentStateData;
}

/**
 * Main canvas layout.
 * Left: Sidebar with summary and workflow list.
 * Right: WorkflowBoard with stacked diagrams.
 */
export function Canvas({ state }: CanvasProps) {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Sidebar summary={state.meetingSummary} workflows={state.workflows} />
      <main
        style={{
          flex: 1,
          overflow: "hidden",
          background: "var(--bg-primary)",
        }}
      >
        <WorkflowBoard workflows={state.workflows} />
      </main>
    </div>
  );
}

