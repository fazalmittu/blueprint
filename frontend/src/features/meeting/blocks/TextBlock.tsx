import { useRef, useCallback, type MouseEvent } from "react";
import { DraggableBlock, type Position } from "./DraggableBlock";

interface TextBlockProps {
  position: Position;
  onPositionChange: (position: Position) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  content: string;
  onContentChange: (content: string) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  selected?: boolean;
  onSelect?: () => void;
  placeholder?: string;
}

/**
 * Simple editable text block.
 * Has a small drag handle at the top, text area below.
 */
export function TextBlock({
  position,
  onPositionChange,
  onDragStart,
  onDragEnd,
  content,
  onContentChange,
  width = 200,
  onWidthChange,
  selected = false,
  onSelect,
  placeholder = "Type something...",
}: TextBlockProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const contentInitialized = useRef(false);
  const resizeStart = useRef({ width: 0, x: 0 });

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  }, [onContentChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case "b":
          e.preventDefault();
          document.execCommand("bold");
          break;
        case "i":
          e.preventDefault();
          document.execCommand("italic");
          break;
        case "u":
          e.preventDefault();
          document.execCommand("underline");
          break;
      }
    }
  }, []);

  const handleResizeStart = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStart.current = { width, x: e.clientX };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const newWidth = Math.max(100, resizeStart.current.width + dx);
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width, onWidthChange]);

  return (
    <DraggableBlock
      position={position}
      onPositionChange={onPositionChange}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      width={width}
      selected={selected}
      onSelect={onSelect}
      style={{
        background: "var(--bg-elevated)",
        border: selected ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        overflow: "visible",
      }}
    >
      {/* Drag handle bar at top */}
      <div
        data-drag-handle
        style={{
          height: 12,
          background: selected ? "var(--accent-subtle, #e0f2fe)" : "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md) var(--radius-md) 0 0",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Grip dots */}
        <div style={{ display: "flex", gap: 3 }}>
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-faint)" }} />
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-faint)" }} />
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-faint)" }} />
        </div>
      </div>

      {/* Editable content */}
      <div
        ref={(el) => {
          if (el && !contentInitialized.current) {
            editorRef.current = el;
            if (content) el.innerHTML = content;
            contentInitialized.current = true;
          }
        }}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        data-placeholder={placeholder}
        style={{
          padding: "var(--space-sm) var(--space-md)",
          minHeight: "40px",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          color: "var(--text-primary)",
          outline: "none",
          cursor: "text",
        }}
      />

      {/* Resize handle */}
      {selected && onWidthChange && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: "absolute",
            right: -4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 8,
            height: 32,
            background: "var(--bg-elevated)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            cursor: "ew-resize",
          }}
        />
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-faint);
          pointer-events: none;
        }
      `}</style>
    </DraggableBlock>
  );
}
