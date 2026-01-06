import { useCallback, useRef, useState, type MouseEvent } from "react";
import { DraggableBlock, type Position } from "./DraggableBlock";

export type ShapeType = "rectangle" | "circle" | "diamond";

export const SHAPE_COLORS = {
  blue: { bg: "#dbeafe", border: "#3b82f6" },
  green: { bg: "#dcfce7", border: "#22c55e" },
  amber: { bg: "#fef3c7", border: "#f59e0b" },
  rose: { bg: "#ffe4e6", border: "#f43f5e" },
  purple: { bg: "#f3e8ff", border: "#a855f7" },
  slate: { bg: "#f1f5f9", border: "#64748b" },
} as const;

export type ShapeColor = keyof typeof SHAPE_COLORS;

// Snap threshold in pixels - if within this range of square, snap to square
const SNAP_THRESHOLD = 8;

interface ShapeBlockProps {
  position: Position;
  onPositionChange: (position: Position) => void;
  shape: ShapeType;
  width?: number;
  height?: number;
  onSizeChange?: (width: number, height: number) => void;
  color?: ShapeColor;
  onColorChange?: (color: ShapeColor) => void;
  text?: string;
  onTextChange?: (text: string) => void;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * Shape block with resize handles, color picker, and editable text.
 * Shows dimensions while resizing and snaps to perfect squares/circles.
 */
export function ShapeBlock({
  position,
  onPositionChange,
  shape,
  width = 100,
  height = 100, // Default to square/circle
  onSizeChange,
  color = "blue",
  onColorChange,
  text = "",
  onTextChange,
  selected = false,
  onSelect,
}: ShapeBlockProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isSnapped, setIsSnapped] = useState(false);
  const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  
  const colors = SHAPE_COLORS[color];

  const handleResizeStart = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStart.current = { width, height, x: e.clientX, y: e.clientY };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      let newWidth = Math.max(40, resizeStart.current.width + dx);
      let newHeight = Math.max(40, resizeStart.current.height + dy);
      
      // Snap to square if dimensions are close
      const diff = Math.abs(newWidth - newHeight);
      if (diff < SNAP_THRESHOLD) {
        const avg = (newWidth + newHeight) / 2;
        newWidth = avg;
        newHeight = avg;
        setIsSnapped(true);
      } else {
        setIsSnapped(false);
      }
      
      onSizeChange?.(Math.round(newWidth), Math.round(newHeight));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsSnapped(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width, height, onSizeChange]);

  const handleColorClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  }, [showColorPicker]);

  const handleColorSelect = useCallback((newColor: ShapeColor) => {
    onColorChange?.(newColor);
    setShowColorPicker(false);
  }, [onColorChange]);

  const handleTextInput = useCallback(() => {
    if (textRef.current && onTextChange) {
      onTextChange(textRef.current.innerText);
    }
  }, [onTextChange]);

  // Render the shape based on type
  const renderShape = () => {
    const baseStyle: React.CSSProperties = {
      background: colors.bg,
      border: `2px solid ${colors.border}`,
      cursor: "grab",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    // Text element - uncontrolled contentEditable to avoid cursor issues
    const textElement = (
      <div
        ref={(el) => {
          // Store ref and set initial text only once
          if (el && !textRef.current) {
            textRef.current = el;
            if (text) el.innerText = text;
          }
        }}
        contentEditable={!!onTextChange}
        suppressContentEditableWarning
        onInput={handleTextInput}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          outline: "none",
          textAlign: "center",
          fontSize: "0.8125rem",
          color: colors.border,
          fontWeight: 500,
          cursor: onTextChange ? "text" : "grab",
          padding: "4px 8px",
          maxWidth: "90%",
          wordBreak: "break-word",
          minHeight: "1em",
        }}
      />
    );

    switch (shape) {
      case "circle":
        return (
          <div
            data-drag-handle
            style={{
              ...baseStyle,
              width,
              height,
              borderRadius: "50%",
            }}
          >
            {textElement}
          </div>
        );

      case "diamond": {
        const size = Math.min(width, height) * 0.7;
        return (
          <div
            style={{
              width,
              height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              data-drag-handle
              style={{
                ...baseStyle,
                width: size,
                height: size,
                transform: "rotate(45deg)",
                position: "absolute",
              }}
            />
            {/* Text not rotated */}
            <div style={{ position: "relative", zIndex: 1 }}>
              {textElement}
            </div>
          </div>
        );
      }

      case "rectangle":
      default:
        return (
          <div
            data-drag-handle
            style={{
              ...baseStyle,
              width,
              height,
              borderRadius: "var(--radius-md)",
            }}
          >
            {textElement}
          </div>
        );
    }
  };

  return (
    <DraggableBlock
      position={position}
      onPositionChange={onPositionChange}
      width="auto"
      selected={selected}
      onSelect={onSelect}
      style={{
        background: "transparent",
        boxShadow: "none",
      }}
    >
      <div style={{ position: "relative", width, height }}>
        {renderShape()}

        {/* Selection outline */}
        {selected && (
          <div
            style={{
              position: "absolute",
              inset: -4,
              border: `2px solid ${isSnapped ? "var(--success)" : "var(--accent)"}`,
              borderRadius: shape === "circle" ? "50%" : "var(--radius-md)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Dimension tooltip while resizing */}
        {isResizing && (
          <div
            style={{
              position: "absolute",
              bottom: -28,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "2px 8px",
              background: isSnapped ? "var(--success)" : "var(--text-primary)",
              color: "white",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.6875rem",
              fontFamily: "var(--font-mono)",
              whiteSpace: "nowrap",
              zIndex: 1000,
            }}
          >
            {Math.round(width)} × {Math.round(height)}
            {isSnapped && " ✓"}
          </div>
        )}

        {/* Resize handle (bottom-right) */}
        {selected && onSizeChange && (
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: "absolute",
              right: -4,
              bottom: -4,
              width: 12,
              height: 12,
              background: "var(--bg-elevated)",
              border: `2px solid ${isSnapped ? "var(--success)" : "var(--accent)"}`,
              borderRadius: 2,
              cursor: "nwse-resize",
            }}
          />
        )}

        {/* Color picker trigger */}
        {selected && onColorChange && (
          <div
            onClick={handleColorClick}
            style={{
              position: "absolute",
              left: -4,
              top: -4,
              width: 16,
              height: 16,
              background: colors.border,
              border: "2px solid var(--bg-elevated)",
              borderRadius: "50%",
              cursor: "pointer",
            }}
          />
        )}

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: 0,
              top: -44,
              display: "flex",
              gap: 4,
              padding: 6,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 1000,
            }}
          >
            {(Object.keys(SHAPE_COLORS) as ShapeColor[]).map((colorKey) => (
              <button
                key={colorKey}
                onClick={() => handleColorSelect(colorKey)}
                style={{
                  width: 20,
                  height: 20,
                  background: SHAPE_COLORS[colorKey].border,
                  border: colorKey === color ? "2px solid var(--text-primary)" : "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </DraggableBlock>
  );
}
