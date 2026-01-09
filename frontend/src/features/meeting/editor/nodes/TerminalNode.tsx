import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface TerminalNodeData {
  label: string;
  variant: "start" | "end";
  onLabelChange?: (label: string) => void;
}

/**
 * Terminal node - rounded pill shape for start/end.
 * Double-click to edit label.
 */
export const TerminalNode = memo(function TerminalNode({
  data,
  selected,
}: NodeProps & { data: TerminalNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const isStart = data.variant === "start";

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

  const bgColor = isStart
    ? selected
      ? "#dcfce7"
      : "#f0fdf4"
    : selected
      ? "#fee2e2"
      : "#fef2f2";
  const borderColor = isStart
    ? selected
      ? "#10b981"
      : "#4ade80"
    : selected
      ? "#ef4444"
      : "#f87171";
  const handleColor = isStart ? "#10b981" : "#ef4444";

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        padding: "8px 20px",
        borderRadius: "9999px",
        background: bgColor,
        border: `2px solid ${borderColor}`,
        minWidth: 80,
        minHeight: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "all var(--transition-fast)",
      }}
    >
      {/* Start nodes only have source handle (bottom) */}
      {isStart && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: handleColor,
            border: "2px solid var(--bg-elevated)",
            width: 10,
            height: 10,
          }}
        />
      )}

      {/* End nodes have target handles */}
      {!isStart && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="top"
            style={{
              background: handleColor,
              border: "2px solid var(--bg-elevated)",
              width: 10,
              height: 10,
            }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            style={{
              background: handleColor,
              border: "2px solid var(--bg-elevated)",
              width: 10,
              height: 10,
            }}
          />
        </>
      )}

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
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            textAlign: "center",
            width: "100%",
            fontFamily: "var(--font-sans)",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            userSelect: "none",
          }}
        >
          {data.label || (isStart ? "Start" : "End")}
        </span>
      )}
    </div>
  );
});

