import { useRef, useCallback, useEffect, useState } from "react";
import { DraggableBlock, type Position } from "./DraggableBlock";
import { BlockHeader } from "./BlockHeader";

interface NotesBlockProps {
  position: Position;
  onPositionChange: (position: Position) => void;
  content: string;
  onContentChange?: (content: string) => void;
  workflowCount: number;
  width?: number;
  height?: number;
  onSizeChange?: (width: number, height: number) => void;
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
  height = 280,
  onSizeChange,
  selected = false,
  onSelect,
  readOnly = false,
}: NotesBlockProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const isUserEditing = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  // Update content when it changes from external source (SSE)
  useEffect(() => {
    if (editorRef.current && !isUserEditing.current) {
      editorRef.current.innerText = content;
    }
  }, [content]);

  const handleInput = useCallback(() => {
    if (editorRef.current && onContentChange) {
      onContentChange(editorRef.current.innerText);
    }
  }, [onContentChange]);

  const handleFocus = useCallback(() => {
    isUserEditing.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isUserEditing.current = false;
  }, []);

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = width;
    const startHeight = height;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(150, startHeight + (moveEvent.clientY - startY));
      onSizeChange?.(newWidth, newHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width, height, onSizeChange]);

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
        height: height,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div ref={blockRef} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <BlockHeader title="Meeting Notes" />

        <div style={{ 
          padding: "var(--space-md)", 
          flex: 1, 
          display: "flex", 
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Summary section */}
          <div style={{ flex: 1, overflow: "auto", marginBottom: "var(--space-md)" }}>
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
              ref={editorRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                outline: "none",
                cursor: readOnly ? "default" : "text",
                minHeight: "40px",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-md)",
              paddingTop: "var(--space-md)",
              borderTop: "1px solid var(--border-subtle)",
              flexShrink: 0,
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

        {/* Resize handle */}
        {onSizeChange && (
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              cursor: "nwse-resize",
              background: isResizing ? "var(--accent)" : "transparent",
              borderRadius: "0 0 var(--radius-lg) 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ opacity: selected ? 0.6 : 0.3 }}
            >
              <path
                d="M7 1L1 7M7 4L4 7M7 7L7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>
    </DraggableBlock>
  );
}

