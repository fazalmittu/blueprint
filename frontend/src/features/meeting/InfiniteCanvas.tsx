import { useRef, useState, useCallback, type ReactNode, type WheelEvent, type MouseEvent } from "react";

interface InfiniteCanvasProps {
  children: ReactNode;
  minZoom?: number;
  maxZoom?: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Infinite canvas with pan (drag) and zoom (scroll wheel) support.
 * Children are placed in a transformed container that can be moved freely.
 */
export function InfiniteCanvas({ 
  children, 
  minZoom = 0.1, 
  maxZoom = 2 
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Handle zoom with scroll wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(maxZoom, Math.max(minZoom, transform.scale + delta));
    
    // Zoom toward cursor position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const scaleChange = newScale / transform.scale;
      const newX = mouseX - (mouseX - transform.x) * scaleChange;
      const newY = mouseY - (mouseY - transform.y) * scaleChange;
      
      setTransform({ x: newX, y: newY, scale: newScale });
    }
  }, [transform, minZoom, maxZoom]);

  // Handle pan start
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Only pan with left mouse button on the canvas itself (not on cards)
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-draggable]')) return;
    
    setIsPanning(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Handle pan move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [isPanning]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="canvas-background"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: isPanning ? "grabbing" : "grab",
        position: "relative",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Transformed content layer */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>

      {/* Controls overlay - stop propagation so clicking controls doesn't deselect */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: "var(--space-lg)",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "var(--space-xs)",
          padding: "var(--space-xs)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(minZoom, prev.scale - 0.1) }))}
          style={{
            width: "var(--space-xl)",
            height: "var(--space-xl)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
            fontSize: "1.25rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={resetView}
          style={{
            padding: "0 var(--space-sm)",
            height: "var(--space-xl)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            minWidth: "var(--space-2xl)",
          }}
          title="Reset view"
        >
          {Math.round(transform.scale * 100)}%
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(maxZoom, prev.scale + 0.1) }))}
          style={{
            width: "var(--space-xl)",
            height: "var(--space-xl)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
            fontSize: "1.25rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

