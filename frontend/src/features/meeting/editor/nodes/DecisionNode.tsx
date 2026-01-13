import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface DecisionNodeData {
  label: string;
  onLabelChange?: (label: string) => void;
}

/**
 * Decision node - diamond shape for conditionals/branches.
 * Larger size with better text display.
 * 
 * Handles for horizontal layout:
 * - Left: input
 * - Top: "Yes" output
 * - Bottom: "No" output  
 * - Right: default output
 */
export const DecisionNode = memo(function DecisionNode({
  data,
  selected,
}: NodeProps & { data: DecisionNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleBlur();
      } else if (e.key === "Escape") {
        setEditValue(data.label);
        setIsEditing(false);
      }
    },
    [handleBlur, data.label]
  );

  const size = 120;
  const handleOffset = -6;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
      }}
    >
      {/* Diamond shape */}
      <div
        onDoubleClick={handleDoubleClick}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size * 0.75,
          height: size * 0.75,
          transform: "translate(-50%, -50%) rotate(45deg)",
          background: selected ? "#fef3c7" : "#fffbeb",
          border: `2px solid ${selected ? "#f59e0b" : "#fbbf24"}`,
          cursor: "grab",
          boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
          transition: "all var(--transition-fast)",
        }}
      />

      {/* Text container - not rotated */}
      <div
        onDoubleClick={handleDoubleClick}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: size * 0.65,
          textAlign: "center",
          cursor: "grab",
        }}
      >
        {isEditing ? (
          <textarea
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
              resize: "none",
              lineHeight: 1.3,
            }}
            rows={3}
          />
        ) : (
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              userSelect: "none",
              wordBreak: "break-word",
              lineHeight: 1.3,
              display: "block",
            }}
          >
            {data.label || "Decision?"}
          </span>
        )}
      </div>

      {/* Left target handle - input */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: "#f59e0b",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          left: handleOffset,
        }}
      />

      {/* Top handle - Yes branch */}
      <Handle
        type="source"
        position={Position.Top}
        id="yes"
        style={{
          background: "#10b981",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          top: handleOffset,
        }}
      />

      {/* Bottom handle - No branch */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{
          background: "#ef4444",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          bottom: handleOffset,
        }}
      />

      {/* Right handle - default/continue */}
      <Handle
        type="source"
        position={Position.Right}
        id="default"
        style={{
          background: "#f59e0b",
          border: "2px solid var(--bg-elevated)",
          width: 10,
          height: 10,
          right: handleOffset,
        }}
      />
    </div>
  );
});
