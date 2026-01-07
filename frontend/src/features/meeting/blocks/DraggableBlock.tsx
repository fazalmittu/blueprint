import { useRef, useState, type ReactNode, type MouseEvent, type CSSProperties } from "react";
import { useCanvasTransform } from "../CanvasContext";

export interface Position {
  x: number;
  y: number;
}

export interface DraggableBlockProps {
  children: ReactNode;
  position: Position;
  onPositionChange: (position: Position, mouseX: number, mouseY: number) => void;
  onDragStart?: () => void;
  onDragEnd?: (mouseX: number, mouseY: number) => void;
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
 * - Accounts for canvas zoom when calculating drag movement
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
  const canvasTransform = useCanvasTransform();
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, scale: 1 });

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
    e.stopPropagation();
    setIsDragging(true);
    onDragStart?.();
    
    // Store starting mouse position, element position, and current scale
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
      scale: canvasTransform.scale,
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      // Calculate delta from drag start (in screen pixels)
      const deltaX = e.clientX - dragStart.current.mouseX;
      const deltaY = e.clientY - dragStart.current.mouseY;
      
      // Divide by scale to convert screen pixels to canvas pixels
      // When zoomed out (scale < 1), moving 100px on screen should move more in canvas
      const scale = dragStart.current.scale;
      onPositionChange(
        {
          x: dragStart.current.posX + deltaX / scale,
          y: dragStart.current.posY + deltaY / scale,
        },
        e.clientX,
        e.clientY
      );
    };

    const handleMouseUp = (e: globalThis.MouseEvent) => {
      setIsDragging(false);
      onDragEnd?.(e.clientX, e.clientY);
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
