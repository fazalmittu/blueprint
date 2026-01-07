import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { getMeeting, type MeetingResponse } from "@/api/client";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { Toolbar } from "./Toolbar";
import { 
  WorkflowBlock, 
  NotesBlock, 
  TextBlock, 
  ShapeBlock,
  type Position,
  type ShapeType,
  type ShapeColor,
} from "./blocks";

// Block state types
interface TextBlockState {
  type: "text";
  id: string;
  position: Position;
  content: string;
  width: number;
}

interface ShapeBlockState {
  type: "shape";
  id: string;
  position: Position;
  shape: ShapeType;
  width: number;
  height: number;
  color: ShapeColor;
  text: string;
}

type UserBlock = TextBlockState | ShapeBlockState;

/**
 * Calculate non-overlapping positions for workflow cards.
 * Uses viewport-relative values.
 */
function getWorkflowPosition(index: number): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // Card takes ~30% of viewport width, gap is 3%
  const CARD_WIDTH = vw * 0.3;
  const GAP_X = vw * 0.03;
  const START_X = vw * 0.25; // Start at 25% from left (after notes block)
  const START_Y = vh * 0.12; // Start 12% from top (below header)
  const ROW_HEIGHT = vh * 0.55; // Each row takes 55% of viewport height
  
  const col = index % 2;
  const row = Math.floor(index / 2);
  
  return {
    x: START_X + col * (CARD_WIDTH + GAP_X),
    y: START_Y + row * ROW_HEIGHT,
  };
}

/**
 * Get initial position for notes block - relative to viewport.
 */
function getNotesPosition(): Position {
  return {
    x: window.innerWidth * 0.02,
    y: window.innerHeight * 0.12,
  };
}

/**
 * Get initial position for new blocks - center of visible area.
 */
function getNewBlockPosition(): Position {
  return {
    x: window.innerWidth * 0.4,
    y: window.innerHeight * 0.3,
  };
}

/**
 * Loading state.
 */
function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-lg)",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "2px solid var(--border-subtle)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          fontFamily: "var(--font-mono)",
        }}
      >
        Loading meeting...
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Error state.
 */
function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-md)",
      }}
    >
      <p style={{ color: "var(--error)", margin: 0 }}>{message}</p>
      <button
        onClick={onBack}
        style={{
          padding: "var(--space-sm) var(--space-md)",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
      >
        Back to Home
      </button>
    </div>
  );
}

// Trash zone - check if mouse is near the trash icon (bottom-left corner)
// Uses screen coordinates, not canvas coordinates
const isMouseInTrashZone = (mouseX: number, mouseY: number) => {
  const margin = 24; // Same as --trash-zone-margin (1.5rem)
  const size = 56; // Same as --trash-zone-size (3.5rem)
  const hitPadding = 30; // Extra padding around the trash icon for easier targeting
  
  const trashCenterX = margin + size / 2;
  const trashCenterY = window.innerHeight - margin - size / 2;
  
  const distance = Math.sqrt(
    Math.pow(mouseX - trashCenterX, 2) + 
    Math.pow(mouseY - trashCenterY, 2)
  );
  
  return distance < (size / 2 + hitPadding);
};

/**
 * Trash zone component - appears when dragging.
 */
function TrashZone({ isOver }: { isOver: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "var(--trash-zone-margin)",
        left: "var(--trash-zone-margin)",
        width: "var(--trash-zone-size)",
        height: "var(--trash-zone-size)",
        borderRadius: "50%",
        background: isOver ? "#fee2e2" : "var(--bg-elevated)",
        border: isOver ? "2px solid var(--error)" : "2px dashed var(--border-default)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all var(--transition-fast)",
        transform: isOver ? "scale(1.1)" : "scale(1)",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <svg
        width="1.5rem"
        height="1.5rem"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isOver ? "var(--error)" : "var(--text-muted)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </div>
  );
}

/**
 * Main meeting canvas content.
 */
function MeetingContent({ data }: { data: MeetingResponse }) {
  const navigate = useNavigate();
  const state = data.currentState.data;
  const meeting = data.meeting;
  
  // Workflow positions (keyed by workflow ID)
  const [workflowPositions, setWorkflowPositions] = useState<Record<string, Position>>({});
  
  // Notes block state - initialize with viewport-relative position
  const [notesPosition, setNotesPosition] = useState<Position>(() => getNotesPosition());
  const [notesContent, setNotesContent] = useState<string>(state.meetingSummary);
  
  // User-created blocks
  const [userBlocks, setUserBlocks] = useState<UserBlock[]>([]);
  
  // Selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  // Drag state for trash zone
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Keyboard delete handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if a user block is selected (not notes or workflows)
      if ((e.key === "Backspace" || e.key === "Delete") && selectedBlockId) {
        // Don't delete if user is typing in an editable element
        const activeEl = document.activeElement;
        if (activeEl && (activeEl as HTMLElement).isContentEditable) {
          return;
        }
        // Check if it's a user block (starts with "text-" or "shape-")
        if (selectedBlockId.startsWith("text-") || selectedBlockId.startsWith("shape-")) {
          e.preventDefault();
          setUserBlocks(prev => prev.filter(b => b.id !== selectedBlockId));
          setSelectedBlockId(null);
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBlockId]);

  const getWorkflowPos = useCallback((workflowId: string, index: number): Position => {
    return workflowPositions[workflowId] || getWorkflowPosition(index);
  }, [workflowPositions]);

  const handleWorkflowPositionChange = useCallback((workflowId: string, position: Position) => {
    setWorkflowPositions(prev => ({ ...prev, [workflowId]: position }));
  }, []);

  const handleAddText = useCallback(() => {
    const vw = window.innerWidth;
    const newBlock: TextBlockState = {
      type: "text",
      id: `text-${Date.now()}`,
      position: getNewBlockPosition(),
      content: "",
      width: Math.max(vw * 0.12, 150), // 12% of viewport, min 150px
    };
    setUserBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const handleAddShape = useCallback((shape: ShapeType) => {
    const vw = window.innerWidth;
    const colors: ShapeColor[] = ["blue", "green", "amber", "rose", "purple"];
    const isSquare = shape === "circle" || shape === "diamond";
    const baseSize = Math.max(vw * 0.06, 80); // 6% of viewport, min 80px
    const newBlock: ShapeBlockState = {
      type: "shape",
      id: `shape-${Date.now()}`,
      position: getNewBlockPosition(),
      shape,
      width: isSquare ? baseSize : baseSize * 1.4,
      height: baseSize,
      color: colors[Math.floor(Math.random() * colors.length)],
      text: "",
    };
    setUserBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const handleBlockPositionChange = useCallback((blockId: string, position: Position, mouseX: number, mouseY: number) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, position } : block
    ));
    
    // Check if mouse is over trash zone (uses screen coordinates)
    setIsOverTrash(isMouseInTrashZone(mouseX, mouseY));
  }, []);
  
  const handleBlockDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleBlockDragEnd = useCallback((blockId: string, mouseX: number, mouseY: number) => {
    setIsDragging(false);
    
    // Check if dropped in trash zone
    if (isMouseInTrashZone(mouseX, mouseY)) {
      setUserBlocks(prev => prev.filter(b => b.id !== blockId));
      setSelectedBlockId(null);
    }
    
    setIsOverTrash(false);
  }, []);

  const handleTextContentChange = useCallback((blockId: string, content: string) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId && block.type === "text" 
        ? { ...block, content } 
        : block
    ));
  }, []);

  const handleTextWidthChange = useCallback((blockId: string, width: number) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId && block.type === "text" 
        ? { ...block, width } 
        : block
    ));
  }, []);

  const handleShapeSizeChange = useCallback((blockId: string, width: number, height: number) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId && block.type === "shape" 
        ? { ...block, width, height } 
        : block
    ));
  }, []);

  const handleShapeColorChange = useCallback((blockId: string, color: ShapeColor) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId && block.type === "shape" 
        ? { ...block, color } 
        : block
    ));
  }, []);

  const handleShapeTextChange = useCallback((blockId: string, text: string) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId && block.type === "shape" 
        ? { ...block, text } 
        : block
    ));
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedBlockId(null);
  }, []);

  return (
    <div style={{ height: "100%", width: "100%" }} onClick={handleCanvasClick}>
      <InfiniteCanvas>
        {/* Notes block */}
        <NotesBlock
          position={notesPosition}
          onPositionChange={setNotesPosition}
          content={notesContent}
          onContentChange={setNotesContent}
          workflowCount={state.workflows.length}
          selected={selectedBlockId === "notes"}
          onSelect={() => setSelectedBlockId("notes")}
        />

        {/* Workflow blocks from server */}
        {state.workflows.map((workflow, index) => (
          <WorkflowBlock
            key={workflow.id}
            workflow={workflow}
            position={getWorkflowPos(workflow.id, index)}
            onPositionChange={(pos) => handleWorkflowPositionChange(workflow.id, pos)}
            selected={selectedBlockId === workflow.id}
            onSelect={() => setSelectedBlockId(workflow.id)}
          />
        ))}

        {/* User-created blocks */}
        {userBlocks.map((block) => {
          if (block.type === "text") {
            return (
              <TextBlock
                key={block.id}
                position={block.position}
                onPositionChange={(pos, mx, my) => handleBlockPositionChange(block.id, pos, mx, my)}
                onDragStart={handleBlockDragStart}
                onDragEnd={(mx, my) => handleBlockDragEnd(block.id, mx, my)}
                content={block.content}
                onContentChange={(content) => handleTextContentChange(block.id, content)}
                width={block.width}
                onWidthChange={(width) => handleTextWidthChange(block.id, width)}
                selected={selectedBlockId === block.id}
                onSelect={() => setSelectedBlockId(block.id)}
              />
            );
          }
          if (block.type === "shape") {
            return (
              <ShapeBlock
                key={block.id}
                position={block.position}
                onPositionChange={(pos, mx, my) => handleBlockPositionChange(block.id, pos, mx, my)}
                onDragStart={handleBlockDragStart}
                onDragEnd={(mx, my) => handleBlockDragEnd(block.id, mx, my)}
                shape={block.shape}
                width={block.width}
                height={block.height}
                onSizeChange={(w, h) => handleShapeSizeChange(block.id, w, h)}
                color={block.color}
                onColorChange={(color) => handleShapeColorChange(block.id, color)}
                text={block.text}
                onTextChange={(text) => handleShapeTextChange(block.id, text)}
                selected={selectedBlockId === block.id}
                onSelect={() => setSelectedBlockId(block.id)}
              />
            );
          }
          return null;
        })}
      </InfiniteCanvas>

      <Toolbar onAddText={handleAddText} onAddShape={handleAddShape} />
      
      {/* Trash zone - visible when dragging */}
      {isDragging && <TrashZone isOver={isOverTrash} />}
      
      {/* Header bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "var(--header-height)",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-md)",
          zIndex: 100,
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
          }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            {meeting.meetingId.slice(0, 8)}...
          </span>
          <span
            className={`status-badge ${meeting.status}`}
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 8px",
              borderRadius: 9999,
              background: meeting.status === "finalized" ? "#e0e7ff" : "#dcfce7",
              color: meeting.status === "finalized" ? "#3730a3" : "#166534",
            }}
          >
            {meeting.status}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Meeting page - smart container.
 */
export function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<MeetingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) return;
    
    async function load() {
      try {
        const res = await getMeeting(meetingId!);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load meeting");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [meetingId]);

  if (!meetingId) {
    return <ErrorState message="Missing meeting ID" onBack={() => navigate("/")} />;
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState message={error || "Failed to load"} onBack={() => navigate("/")} />;
  }

  return <MeetingContent data={data} />;
}
