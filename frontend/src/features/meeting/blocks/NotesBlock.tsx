import { useRef, useCallback } from "react";
import { DraggableBlock, type Position } from "./DraggableBlock";
import { BlockHeader } from "./BlockHeader";

interface NotesBlockProps {
  position: Position;
  onPositionChange: (position: Position) => void;
  content: string;
  onContentChange?: (content: string) => void;
  workflowCount: number;
  width?: number;
  selected?: boolean;
  onSelect?: () => void;
  readOnly?: boolean;
}

/**
 * Meeting notes block with editable summary.
 */
export function NotesBlock({
  position,
  onPositionChange,
  content,
  onContentChange,
  workflowCount,
  width = 320,
  selected = false,
  onSelect,
  readOnly = false,
}: NotesBlockProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const contentInitialized = useRef(false);

  const handleInput = useCallback(() => {
    if (editorRef.current && onContentChange) {
      onContentChange(editorRef.current.innerText);
    }
  }, [onContentChange]);

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
      <BlockHeader title="Meeting Notes" />

      <div style={{ padding: "var(--space-md)" }}>
        {/* Summary section */}
        <div style={{ marginBottom: "var(--space-md)" }}>
          <h3
            style={{
              margin: "0 0 var(--space-sm) 0",
              fontSize: "0.6875rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
            }}
          >
            Summary
          </h3>
          <div
            ref={(el) => {
              if (el && !contentInitialized.current && !readOnly) {
                editorRef.current = el;
                if (content) el.innerText = content;
                contentInitialized.current = true;
              }
            }}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={handleInput}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              fontSize: "0.8125rem",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              outline: "none",
              cursor: readOnly ? "default" : "text",
              minHeight: "60px",
            }}
          >
            {readOnly ? content : undefined}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            paddingTop: "var(--space-md)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {workflowCount}
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Workflows
            </div>
          </div>
        </div>
      </div>
    </DraggableBlock>
  );
}

