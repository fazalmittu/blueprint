import { useState, useCallback, useRef, type ReactNode, useEffect } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface SplitPanelProps {
  tabs: Tab[];
  defaultTabId?: string;
  onTabChange?: (tabId: string) => void;
  activeTabId?: string;
}

type LayoutMode = "single" | "split-vertical";

// Inject keyframes for pulse animation
const pulseKeyframes = `
@keyframes dropZonePulse {
  0%, 100% {
    background: rgba(59, 130, 246, 0.05);
    border-color: rgba(59, 130, 246, 0.4);
  }
  50% {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.8);
  }
}
@keyframes cornerPulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}
`;

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement("style");
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
  stylesInjected = true;
}

interface DragState {
  tabId: string;
  startX: number;
  startY: number;
}

/**
 * A panel system with tabs that can be split by dragging.
 * Drag a tab right to split the view side-by-side.
 */
export function SplitPanel({ tabs, defaultTabId, onTabChange, activeTabId }: SplitPanelProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTabId || tabs[0]?.id);
  
  // Inject pulse animation styles
  useEffect(() => {
    injectStyles();
  }, []);
  
  // Use controlled or uncontrolled pattern
  const activeTab = activeTabId !== undefined ? activeTabId : internalActiveTab;
  const setActiveTab = (tabId: string) => {
    setInternalActiveTab(tabId);
    onTabChange?.(tabId);
  };
  const [layout, setLayout] = useState<LayoutMode>("single");
  const [splitTabs, setSplitTabs] = useState<[string, string] | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropZoneSide, setDropZoneSide] = useState<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const handleTabClick = useCallback((tabId: string) => {
    if (layout === "single") {
      setActiveTab(tabId);
    } else {
      // In split mode, clicking a tab closes split and shows that tab fullscreen
      setLayout("single");
      setSplitTabs(null);
      setActiveTab(tabId);
    }
  }, [layout]);

  const handleTabMouseDown = useCallback((e: React.MouseEvent, tabId: string) => {
    if (layout === "split-vertical") return; // Can't drag when already split
    
    setDragState({
      tabId,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, [layout]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || !containerRef.current) return;
    
    const deltaY = Math.abs(e.clientY - dragState.startY);
    const deltaX = Math.abs(e.clientX - dragState.startX);
    
    // Show drop zone when dragging enough distance
    if (deltaX > 50 || deltaY > 50) {
      // Determine side based on cursor position relative to container center
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerCenterX = containerRect.left + containerRect.width / 2;
      setDropZoneSide(e.clientX < containerCenterX ? "left" : "right");
    } else {
      setDropZoneSide(null);
    }
  }, [dragState]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragState || !containerRef.current) return;
    
    const deltaY = Math.abs(e.clientY - dragState.startY);
    const deltaX = Math.abs(e.clientX - dragState.startX);
    
    // If dragged enough and we have at least 2 tabs, split
    if ((deltaX > 50 || deltaY > 50) && tabs.length >= 2) {
      // Get the other tab (not the one being dragged)
      const otherTab = tabs.find(t => t.id !== dragState.tabId);
      if (otherTab) {
        setLayout("split-vertical");
        // Determine panel order based on cursor position
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerCenterX = containerRect.left + containerRect.width / 2;
        if (e.clientX < containerCenterX) {
          // Cursor on left: dragged tab goes to left panel
          setSplitTabs([dragState.tabId, otherTab.id]);
        } else {
          // Cursor on right: dragged tab goes to right panel
        setSplitTabs([otherTab.id, dragState.tabId]);
        }
        // Reset to exactly 50/50 split
        setSplitRatio(0.5);
      }
    }
    
    setDragState(null);
    setDropZoneSide(null);
  }, [dragState, tabs]);

  const handleClosePane = useCallback((paneIndex: 0 | 1) => {
    if (!splitTabs) return;
    
    // Keep the other pane's tab as the active tab
    const remainingTab = splitTabs[paneIndex === 0 ? 1 : 0];
    setLayout("single");
    setSplitTabs(null);
    setActiveTab(remainingTab);
  }, [splitTabs]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startRatio = splitRatio;
    const container = containerRef.current;
    if (!container) return;
    
    const containerWidth = container.getBoundingClientRect().width;
    
    const handleMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newRatio = Math.max(0.2, Math.min(0.8, startRatio + delta / containerWidth));
      setSplitRatio(newRatio);
    };
    
    const handleUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [splitRatio]);

  const getTabContent = (tabId: string) => {
    return tabs.find(t => t.id === tabId)?.content || null;
  };

  const getTabLabel = (tabId: string) => {
    return tabs.find(t => t.id === tabId)?.label || "";
  };

  const getTabIcon = (tabId: string) => {
    return tabs.find(t => t.id === tabId)?.icon || null;
  };

  const isTabActive = (tabId: string) => {
    if (layout === "single") {
      return activeTab === tabId;
    }
    return splitTabs?.includes(tabId) || false;
  };

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
        position: "relative",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (dragState) {
          setDragState(null);
          setDropZoneSide(null);
        }
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-xs)",
          padding: "var(--space-sm) var(--space-md)",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-elevated)",
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => {
          const active = isTabActive(tab.id);
          const hovered = hoveredTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleTabMouseDown(e, tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                padding: "var(--space-sm) var(--space-md)",
                border: "none",
                borderRadius: "var(--radius-md)",
                background: active
                  ? "var(--accent-subtle)"
                  : hovered
                    ? "rgba(59, 130, 246, 0.1)"
                    : "transparent",
                color: active || hovered
                  ? "var(--accent)"
                  : "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: layout === "single" ? "grab" : "default",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                transition: "all var(--transition-fast)",
                userSelect: "none",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: layout === "split-vertical" ? "flex" : "block" }}>
        {layout === "single" ? (
          // Single tab view - slides when drop zone appears
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: dropZoneSide === "left" 
                ? "translateX(50%)" 
                : dropZoneSide === "right"
                  ? "translateX(0)"
                  : "translateX(0)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: dropZoneSide ? "50%" : "100%",
              overflow: "auto",
                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                flexShrink: 0,
            }}
          >
            {getTabContent(activeTab || tabs[0]?.id)}
            </div>
          </div>
        ) : (
          // Split view - side by side
          <>
            {/* Left panel */}
            <div
              style={{
                width: `${splitRatio * 100}%`,
                height: "100%",
                overflow: "hidden",
                borderRight: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Left panel header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-xs) var(--space-sm)",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--bg-tertiary)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-xs)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  {splitTabs && getTabIcon(splitTabs[0])}
                  {splitTabs && getTabLabel(splitTabs[0])}
                </div>
                <button
                  onClick={() => handleClosePane(0)}
                  style={{
                    padding: "2px",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-secondary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                  title="Close pane"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Left panel content */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {splitTabs && getTabContent(splitTabs[0])}
              </div>
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `calc(${splitRatio * 100}% - 3px)`,
                width: 6,
                cursor: "col-resize",
                background: isResizing ? "var(--accent)" : "transparent",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 40,
                  borderRadius: 2,
                  background: isResizing ? "var(--accent)" : "var(--border-subtle)",
                }}
              />
            </div>

            {/* Right panel */}
            <div
              style={{
                width: `${(1 - splitRatio) * 100}%`,
                height: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Right panel header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-xs) var(--space-sm)",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--bg-tertiary)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-xs)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  {splitTabs && getTabIcon(splitTabs[1])}
                  {splitTabs && getTabLabel(splitTabs[1])}
                </div>
                <button
                  onClick={() => handleClosePane(1)}
                  style={{
                    padding: "2px",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-secondary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                  title="Close pane"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Right panel content */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {splitTabs && getTabContent(splitTabs[1])}
              </div>
            </div>
          </>
        )}

        {/* Drop zone indicator - shows on left or right based on drag direction */}
          <div
            style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
              width: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            borderLeft: dropZoneSide === "right" ? "2px dashed rgba(59, 130, 246, 0.6)" : "none",
            borderRight: dropZoneSide === "left" ? "2px dashed rgba(59, 130, 246, 0.6)" : "none",
            animation: dropZoneSide ? "dropZonePulse 1.2s ease-in-out infinite" : "none",
            opacity: dropZoneSide ? 1 : 0,
            pointerEvents: dropZoneSide ? "auto" : "none",
            transition: "opacity 0.2s ease-out, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: dropZoneSide === "right" ? "translateX(100%)" : "translateX(0)",
            }}
          >
          {dropZoneSide && (
            <>
            {/* Pulsing corners */}
            <DropZoneCorner position="top-left" />
            <DropZoneCorner position="top-right" />
            <DropZoneCorner position="bottom-left" />
            <DropZoneCorner position="bottom-right" />
            
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-sm)",
                color: "var(--accent)",
              }}
            >
              <svg 
                width="40" 
                height="40" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
                style={{
                  opacity: 0.8,
                }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 3v18" />
              </svg>
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                Drop to split view
              </span>
            </div>
            </>
          )}
          </div>
      </div>
    </div>
  );
}

/**
 * Pulsing corner decoration for drop zone
 */
function DropZoneCorner({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");
  
  return (
    <div
      style={{
        position: "absolute",
        top: isTop ? 12 : "auto",
        bottom: isTop ? "auto" : 12,
        left: isLeft ? 12 : "auto",
        right: isLeft ? "auto" : 12,
        width: 24,
        height: 24,
        animation: "cornerPulse 1.2s ease-in-out infinite",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{
          transform: `rotate(${
            position === "top-left" ? 0 :
            position === "top-right" ? 90 :
            position === "bottom-right" ? 180 :
            270
          }deg)`,
        }}
      >
        <path d="M4 14V4h10" />
      </svg>
    </div>
  );
}
