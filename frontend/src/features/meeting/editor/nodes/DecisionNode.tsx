import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface DecisionNodeData {
  label: string;
  onLabelChange?: (label: string) => void;
}

/**
 * Decision node - diamond shape for conditionals/branches.
 * Double-click to edit label.
 */
export const DecisionNode = memo(function DecisionNode({
  data,
  selected,
}: NodeProps & { data: DecisionNodeData }) {
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

  const size = 80;

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        width: size,
        height: size,
        transform: "rotate(45deg)",
        background: selected ? "#fef3c7" : "#fffbeb",
        border: `2px solid ${selected ? "#f59e0b" : "#fbbf24"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "all var(--transition-fast)",
      }}
    >
      {/* Top target handle - for normal forward edges */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: "#f59e0b",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          transform: "rotate(-45deg)",
          top: -5,
          left: "50%",
        }}
      />
      
      {/* Left target handle - for back-edges (loops) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: "#f59e0b",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          transform: "rotate(-45deg)",
          left: -5,
          top: "50%",
        }}
      />

      <div
        style={{
          transform: "rotate(-45deg)",
          textAlign: "center",
          padding: "4px",
          maxWidth: size * 0.9,
        }}
      >
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
              fontSize: "0.6875rem",
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
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              userSelect: "none",
              wordBreak: "break-word",
            }}
          >
            {data.label || "Decision"}
          </span>
        )}
      </div>

      {/* Left handle (No) */}
      <Handle
        type="source"
        position={Position.Left}
        id="no"
        style={{
          background: "#ef4444",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          transform: "rotate(-45deg)",
          left: -5,
          top: "50%",
        }}
      />

      {/* Right handle (Yes) */}
      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        style={{
          background: "#10b981",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          transform: "rotate(-45deg)",
          right: -5,
          top: "50%",
        }}
      />

      {/* Bottom handle (default) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        style={{
          background: "#f59e0b",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          transform: "rotate(-45deg)",
          bottom: -5,
          left: "50%",
        }}
      />
    </div>
  );
});

