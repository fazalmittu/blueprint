import { useState, useCallback } from "react";
import type { Workflow } from "@/types";
import { DraggableBlock, type Position } from "./DraggableBlock";
import { BlockHeader } from "./BlockHeader";
import { MermaidDiagram } from "../MermaidDiagram";

interface WorkflowBlockProps {
  workflow: Workflow;
  position: Position;
  onPositionChange: (position: Position) => void;
  width?: number;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * Workflow block that displays a mermaid diagram.
 * Can be minimized to show only the header.
 */
export function WorkflowBlock({
  workflow,
  position,
  onPositionChange,
  width = 480,
  selected = false,
  onSelect,
}: WorkflowBlockProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  const MinimizeButton = (
    <button
      onClick={toggleMinimize}
      style={{
        width: 20,
        height: 20,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "var(--text-muted)",
        fontSize: "0.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
      }}
      title={isMinimized ? "Expand" : "Minimize"}
    >
      {isMinimized ? "+" : "-"}
    </button>
  );

  return (
    <DraggableBlock
      position={position}
      onPositionChange={onPositionChange}
      width={width}
      selected={selected}
      onSelect={onSelect}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <BlockHeader title={workflow.title} actions={MinimizeButton} />

      {!isMinimized && (
        <>
          {/* Diagram */}
          <div
            style={{
              background: "var(--bg-primary)",
              minHeight: "150px",
            }}
          >
            <MermaidDiagram id={workflow.id} diagram={workflow.mermaidDiagram} />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "var(--space-sm) var(--space-md)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-secondary)",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {workflow.sources.length} sources
            </span>
            <div
              style={{
                display: "flex",
                gap: "var(--space-xs)",
              }}
            >
              {workflow.sources.slice(0, 3).map((source) => (
                <span
                  key={source}
                  style={{
                    fontSize: "0.625rem",
                    padding: "2px 6px",
                    background: "var(--accent-subtle)",
                    color: "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {source}
                </span>
              ))}
              {workflow.sources.length > 3 && (
                <span
                  style={{
                    fontSize: "0.625rem",
                    padding: "2px 6px",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-muted)",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  +{workflow.sources.length - 3}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </DraggableBlock>
  );
}
