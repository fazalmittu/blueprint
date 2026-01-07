import { useRef, useState, type ReactNode, type MouseEvent, type CSSProperties } from "react";

export interface Position {
  x: number;
  y: number;
}

export interface DraggableBlockProps {
  children: ReactNode;
  position: Position;
  onPositionChange: (position: Position) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  width?: number | "auto";
  minWidth?: number;
  selected?: boolean;
  onSelect?: () => void;
  style?: CSSProperties;
  className?: string;
}

/**
 * Base draggable block component.
 * - Click to select (stops propagation to prevent canvas deselecting)
 * - Drag from [data-drag-handle] elements
 */
export function DraggableBlock({
  children,
  position,
  onPositionChange,
  onDragStart,
  onDragEnd,
  width = "auto",
  minWidth = 100,
  selected = false,
  onSelect,
  style,
  className,
}: DraggableBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Click to select - stop propagation so canvas doesn't deselect
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  // Drag start - only from drag handle
  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-drag-handle]")) return;

    e.preventDefault();
    setIsDragging(true);
    onDragStart?.();
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      onPositionChange({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      data-draggable
      className={className}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: width === "auto" ? "auto" : width,
        minWidth,
        boxShadow: isDragging
          ? "var(--shadow-lg)"
          : selected
          ? "0 0 0 2px var(--accent), var(--shadow-card)"
          : "var(--shadow-card)",
        transition: isDragging ? "none" : "box-shadow var(--transition-fast)",
        zIndex: isDragging ? 1000 : selected ? 100 : 1,
        cursor: isDragging ? "grabbing" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
