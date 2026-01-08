import { useState, useCallback, useRef, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface SplitPanelProps {
  tabs: Tab[];
  defaultTabId?: string;
}

type LayoutMode = "single" | "split-horizontal";

interface DragState {
  tabId: string;
  startX: number;
  startY: number;
}

/**
 * A panel system with tabs that can be split by dragging.
 * Drag a tab down to split the view horizontally.
 */
export function SplitPanel({ tabs, defaultTabId }: SplitPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0]?.id);
  const [layout, setLayout] = useState<LayoutMode>("single");
  const [splitTabs, setSplitTabs] = useState<[string, string] | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showDropZone, setShowDropZone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleTabClick = useCallback((tabId: string) => {
    if (layout === "single") {
      setActiveTab(tabId);
    }
  }, [layout]);

  const handleTabMouseDown = useCallback((e: React.MouseEvent, tabId: string) => {
    if (layout === "split-horizontal") return; // Can't drag when already split
    
    setDragState({
      tabId,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, [layout]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    
    const deltaY = e.clientY - dragState.startY;
    
    // Show drop zone when dragging down significantly
    if (deltaY > 50) {
      setShowDropZone(true);
    } else {
      setShowDropZone(false);
    }
  }, [dragState]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    
    const deltaY = e.clientY - dragState.startY;
    
    // If dragged down enough and we have another tab, split
    if (deltaY > 50 && tabs.length >= 2) {
      const otherTab = tabs.find(t => t.id !== dragState.tabId);
      if (otherTab) {
        setLayout("split-horizontal");
        setSplitTabs([activeTab || tabs[0].id, dragState.tabId]);
      }
    }
    
    setDragState(null);
    setShowDropZone(false);
  }, [dragState, tabs, activeTab]);

  const handleCloseSplit = useCallback(() => {
    setLayout("single");
    setSplitTabs(null);
    setActiveTab(tabs[0]?.id);
  }, [tabs]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startRatio = splitRatio;
    const container = containerRef.current;
    if (!container) return;
    
    const containerHeight = container.getBoundingClientRect().height;
    
    const handleMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newRatio = Math.max(0.2, Math.min(0.8, startRatio + delta / containerHeight));
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
          setShowDropZone(false);
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            onMouseDown={(e) => handleTabMouseDown(e, tab.id)}
            style={{
              padding: "var(--space-sm) var(--space-md)",
              border: "none",
              borderRadius: "var(--radius-md)",
              background:
                (layout === "single" && activeTab === tab.id) ||
                (layout === "split-horizontal" && splitTabs?.includes(tab.id))
                  ? "var(--accent-subtle)"
                  : "transparent",
              color:
                (layout === "single" && activeTab === tab.id) ||
                (layout === "split-horizontal" && splitTabs?.includes(tab.id))
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
        ))}

        {/* Split indicator */}
        {layout === "split-horizontal" && (
          <button
            onClick={handleCloseSplit}
            style={{
              marginLeft: "auto",
              padding: "var(--space-xs) var(--space-sm)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-tertiary)",
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Close split
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {layout === "single" ? (
          // Single tab view
          <div style={{ height: "100%", overflow: "auto" }}>
            {getTabContent(activeTab || tabs[0]?.id)}
          </div>
        ) : (
          // Split view
          <>
            {/* Top panel */}
            <div
              style={{
                height: `${splitRatio * 100}%`,
                overflow: "auto",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              {splitTabs && getTabContent(splitTabs[0])}
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `calc(${splitRatio * 100}% - 3px)`,
                height: 6,
                cursor: "row-resize",
                background: isResizing ? "var(--accent)" : "transparent",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  background: isResizing ? "var(--accent)" : "var(--border-subtle)",
                }}
              />
            </div>

            {/* Bottom panel */}
            <div
              style={{
                height: `${(1 - splitRatio) * 100}%`,
                overflow: "auto",
              }}
            >
              {splitTabs && getTabContent(splitTabs[1])}
            </div>
          </>
        )}

        {/* Drop zone indicator */}
        {showDropZone && (
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              bottom: "10%",
              height: "40%",
              border: "2px dashed var(--accent)",
              borderRadius: "var(--radius-lg)",
              background: "var(--accent-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              opacity: 0.9,
            }}
          >
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--accent)",
              }}
            >
              Drop here to split view
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

