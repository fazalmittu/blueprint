import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface ProcessNodeData {
  label: string;
  width?: number;
  onLabelChange?: (label: string) => void;
}

/**
 * Process node - rectangular shape for actions/steps.
 * Width is dynamic based on text content.
 * Double-click to edit label.
 */
export const ProcessNode = memo(function ProcessNode({
  data,
  selected,
}: NodeProps & { data: ProcessNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setEditValue(data.label);
    setIsEditing(true);
  }, [data.label]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== data.label) {
      data.onLabelChange?.(editValue.trim());
    }
  }, [editValue, data]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleBlur();
      } else if (e.key === "Escape") {
        setEditValue(data.label);
        setIsEditing(false);
      }
    },
    [handleBlur, data.label]
  );

  // Use width from layout calculation, or auto
  const width = data.width || "auto";

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        padding: "12px 20px",
        borderRadius: "var(--radius-sm)",
        background: selected ? "var(--accent-subtle)" : "var(--bg-elevated)",
        border: `2px solid ${selected ? "var(--accent)" : "var(--border-default)"}`,
        width: width,
        minWidth: 120,
        maxWidth: 300,
        minHeight: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "all var(--transition-fast)",
        textAlign: "center",
      }}
    >
      {/* Left target handle - input */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: "var(--accent)",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
        }}
      />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--text-primary)",
            textAlign: "center",
            width: "100%",
            fontFamily: "var(--font-sans)",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--text-primary)",
            userSelect: "none",
            lineHeight: 1.4,
          }}
        >
          {data.label || "Process"}
        </span>
      )}

      {/* Right source handle - output */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "var(--accent)",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
        }}
      />
    </div>
  );
});
