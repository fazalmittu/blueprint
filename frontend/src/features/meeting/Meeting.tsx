import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import { 
  getMeeting, 
  getMeetingVersions, 
  subscribeMeetingUpdates,
  updateWorkflow,
  deleteWorkflow,
  type MeetingResponse, 
  type VersionInfo,
  type SSEMessage,
} from "@/api/client";
import type { Node, Edge } from "@xyflow/react";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { Toolbar } from "./Toolbar";
import { TranscriptSidebar } from "./TranscriptSidebar";
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
 * Uses viewport-relative values, accounting for sidebar.
 */
function getWorkflowPosition(index: number, hasSidebar: boolean): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sidebarWidth = hasSidebar ? 280 : 0;
  
  // Available width after sidebar
  const availableWidth = vw - sidebarWidth;
  
  // Card takes ~30% of available width, gap is 3%
  const CARD_WIDTH = availableWidth * 0.3;
  const GAP_X = availableWidth * 0.03;
  const START_X = sidebarWidth + availableWidth * 0.02; // Start after sidebar
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
function getNotesPosition(hasSidebar: boolean): Position {
  const sidebarWidth = hasSidebar ? 280 : 0;
  return {
    x: sidebarWidth + window.innerWidth * 0.02,
    y: window.innerHeight * 0.12,
  };
}

/**
 * Get initial position for new blocks - center of visible area.
 */
function getNewBlockPosition(hasSidebar: boolean): Position {
  const sidebarWidth = hasSidebar ? 280 : 0;
  const availableWidth = window.innerWidth - sidebarWidth;
  return {
    x: sidebarWidth + availableWidth * 0.4,
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
const isMouseInTrashZone = (mouseX: number, mouseY: number, hasSidebar: boolean) => {
  const margin = 24; // Same as --trash-zone-margin (1.5rem)
  const size = 56; // Same as --trash-zone-size (3.5rem)
  const hitPadding = 30; // Extra padding around the trash icon for easier targeting
  const sidebarWidth = hasSidebar ? 280 : 0;
  
  const trashCenterX = sidebarWidth + margin + size / 2;
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
function TrashZone({ isOver, hasSidebar }: { isOver: boolean; hasSidebar: boolean }) {
  const sidebarWidth = hasSidebar ? 280 : 0;
  return (
    <div
      style={{
        position: "fixed",
        bottom: "var(--trash-zone-margin)",
        left: `calc(${sidebarWidth}px + var(--trash-zone-margin))`,
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
function MeetingContent({ 
  data, 
  versions,
  isProcessing,
  processingChunkIndex,
  onVersionChange,
  onWorkflowDeleted,
  onWorkflowUpdated,
}: { 
  data: MeetingResponse;
  versions: VersionInfo[];
  isProcessing: boolean;
  processingChunkIndex: number | null;
  onVersionChange: (version: number) => void;
  onWorkflowDeleted?: (workflowId: string) => void;
  onWorkflowUpdated?: (workflowId: string, nodes: { id: string; type: "process" | "decision" | "terminal"; label: string; variant?: "start" | "end" }[], edges: { id: string; source: string; target: string; label?: string }[]) => void;
}) {
  const navigate = useNavigate();
  const state = data.currentState.data;
  const meeting = data.meeting;
  const hasSidebar = meeting.totalChunks !== undefined && meeting.totalChunks > 0;
  
  // Workflow positions (keyed by workflow ID)
  const [workflowPositions, setWorkflowPositions] = useState<Record<string, Position>>({});
  
  // Notes block state - initialize with viewport-relative position
  const [notesPosition, setNotesPosition] = useState<Position>(() => getNotesPosition(hasSidebar));
  const [notesContent, setNotesContent] = useState<string>(state.meetingSummary);
  const [notesSize, setNotesSize] = useState({ width: 340, height: 300 });
  
  // User-created blocks
  const [userBlocks, setUserBlocks] = useState<UserBlock[]>([]);
  
  // Selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  // Drag state for trash zone
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Update notes content when state changes (from SSE updates)
  useEffect(() => {
    setNotesContent(state.meetingSummary);
  }, [state.meetingSummary]);

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
    return workflowPositions[workflowId] || getWorkflowPosition(index, hasSidebar);
  }, [workflowPositions, hasSidebar]);

  const handleWorkflowPositionChange = useCallback((workflowId: string, position: Position) => {
    setWorkflowPositions(prev => ({ ...prev, [workflowId]: position }));
  }, []);

  const handleAddText = useCallback(() => {
    const availableWidth = window.innerWidth - (hasSidebar ? 280 : 0);
    const newBlock: TextBlockState = {
      type: "text",
      id: `text-${Date.now()}`,
      position: getNewBlockPosition(hasSidebar),
      content: "",
      width: Math.max(availableWidth * 0.12, 150), // 12% of viewport, min 150px
    };
    setUserBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, [hasSidebar]);

  const handleAddShape = useCallback((shape: ShapeType) => {
    const availableWidth = window.innerWidth - (hasSidebar ? 280 : 0);
    const colors: ShapeColor[] = ["blue", "green", "amber", "rose", "purple"];
    const isSquare = shape === "circle" || shape === "diamond";
    const baseSize = Math.max(availableWidth * 0.06, 80); // 6% of viewport, min 80px
    const newBlock: ShapeBlockState = {
      type: "shape",
      id: `shape-${Date.now()}`,
      position: getNewBlockPosition(hasSidebar),
      shape,
      width: isSquare ? baseSize : baseSize * 1.4,
      height: baseSize,
      color: colors[Math.floor(Math.random() * colors.length)],
      text: "",
    };
    setUserBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, [hasSidebar]);

  const handleBlockPositionChange = useCallback((blockId: string, position: Position, mouseX: number, mouseY: number) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, position } : block
    ));
    
    // Check if mouse is over trash zone (uses screen coordinates)
    setIsOverTrash(isMouseInTrashZone(mouseX, mouseY, hasSidebar));
  }, [hasSidebar]);
  
  const handleBlockDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleBlockDragEnd = useCallback((blockId: string, mouseX: number, mouseY: number) => {
    setIsDragging(false);
    
    // Check if dropped in trash zone
    if (isMouseInTrashZone(mouseX, mouseY, hasSidebar)) {
      setUserBlocks(prev => prev.filter(b => b.id !== blockId));
      setSelectedBlockId(null);
    }
    
    setIsOverTrash(false);
  }, [hasSidebar]);

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

  // Check if meeting is editable (finalized and not processing)
  const isEditable = meeting.status === "finalized" && !isProcessing;

  // Handle workflow update from editor
  const handleWorkflowUpdate = useCallback(
    async (workflowId: string, nodes: Node[], edges: Edge[]) => {
      try {
        // Convert React Flow nodes/edges to our workflow format
        const workflowNodes = nodes.map((node) => ({
          id: node.id,
          type: (node.type || "process") as "process" | "decision" | "terminal",
          label: (node.data as { label: string }).label || "Untitled",
          variant: (node.data as { variant?: "start" | "end" }).variant,
        }));

        const workflowEdges = edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label as string | undefined,
        }));

        await updateWorkflow(meeting.meetingId, workflowId, {
          nodes: workflowNodes,
          edges: workflowEdges,
        });

        // Notify parent to update state
        onWorkflowUpdated?.(workflowId, workflowNodes, workflowEdges);
      } catch (error) {
        console.error("Failed to update workflow:", error);
        alert(error instanceof Error ? error.message : "Failed to update workflow");
      }
    },
    [meeting.meetingId, onWorkflowUpdated]
  );

  // Handle workflow delete
  const handleWorkflowDelete = useCallback(
    async (workflowId: string) => {
      try {
        await deleteWorkflow(meeting.meetingId, workflowId);
        // Notify parent to update state
        onWorkflowDeleted?.(workflowId);
      } catch (error) {
        console.error("Failed to delete workflow:", error);
        alert(error instanceof Error ? error.message : "Failed to delete workflow");
      }
    },
    [meeting.meetingId, onWorkflowDeleted]
  );

  return (
    <div style={{ height: "100%", width: "100%" }} onClick={handleCanvasClick}>
      {/* Transcript sidebar */}
      {hasSidebar && (
        <TranscriptSidebar
          versions={versions}
          currentVersion={data.currentState.version}
          processingChunkIndex={processingChunkIndex}
          totalChunks={meeting.totalChunks || 0}
          isProcessing={isProcessing}
          onVersionClick={onVersionChange}
        />
      )}

      <div style={{ marginLeft: hasSidebar ? "280px" : 0, height: "100%" }}>
        <InfiniteCanvas>
          {/* Notes block */}
          <NotesBlock
            position={notesPosition}
            onPositionChange={setNotesPosition}
            content={notesContent}
            onContentChange={setNotesContent}
            workflowCount={state.workflows.length}
            width={notesSize.width}
            height={notesSize.height}
            onSizeChange={(w, h) => setNotesSize({ width: w, height: h })}
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
              isEditable={isEditable}
              onWorkflowUpdate={handleWorkflowUpdate}
              onWorkflowDelete={handleWorkflowDelete}
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
      </div>

      <Toolbar onAddText={handleAddText} onAddShape={handleAddShape} />
      
      {/* Trash zone - visible when dragging */}
      {isDragging && <TrashZone isOver={isOverTrash} hasSidebar={hasSidebar} />}
      
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
          {isProcessing && (
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              fontSize: "0.75rem",
              color: "#d97706",
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#f59e0b",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
              Processing chunk {(processingChunkIndex ?? 0) + 1}/{meeting.totalChunks}
            </span>
          )}
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
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 8px",
              borderRadius: 9999,
              background: meeting.status === "finalized" 
                ? "#e0e7ff" 
                : isProcessing 
                  ? "rgba(245, 158, 11, 0.2)" 
                  : "#dcfce7",
              color: meeting.status === "finalized" 
                ? "#3730a3" 
                : isProcessing
                  ? "#d97706"
                  : "#166534",
            }}
          >
            {isProcessing ? "processing" : meeting.status}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
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
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingChunkIndex, setProcessingChunkIndex] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load meeting data
  useEffect(() => {
    if (!meetingId) return;
    
    async function load() {
      try {
        // Load meeting with current state
        const meetingRes = await getMeeting(meetingId!);
        setData(meetingRes);

        // Load versions for sidebar
        if (meetingRes.meeting.totalChunks) {
          const versionsRes = await getMeetingVersions(meetingId!);
          setVersions(versionsRes.versions);
        }

        // If meeting has a transcript and isn't finalized, subscribe to updates
        if (meetingRes.meeting.status === "active" && meetingRes.meeting.transcript) {
          subscribeToUpdates(meetingId!);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load meeting");
      } finally {
        setLoading(false);
      }
    }
    load();

    // Cleanup SSE on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [meetingId]);

  const subscribeToUpdates = useCallback((id: string) => {
    setIsProcessing(true);
    
    eventSourceRef.current = subscribeMeetingUpdates(
      id,
      (message: SSEMessage) => {
        switch (message.type) {
          case "connected":
            console.log("Connected to SSE for meeting:", id);
            break;
          
          case "processing_started":
            setIsProcessing(true);
            break;
          
          case "chunk_processed":
            if (message.currentState && message.chunkIndex !== undefined) {
              // Update current state with the new data
              setData(prev => prev ? {
                ...prev,
                currentState: message.currentState!,
              } : null);
              
              // Add to versions
              setVersions(prev => {
                const newVersion: VersionInfo = {
                  version: message.version!,
                  currentStateId: message.currentState!.currentStateId,
                  chunkIndex: message.chunkIndex,
                  chunkText: message.currentState!.data.chunkText,
                };
                // Check if already exists
                if (prev.find(v => v.version === newVersion.version)) {
                  return prev;
                }
                return [...prev, newVersion];
              });
              
              setProcessingChunkIndex(message.chunkIndex);
            }
            break;
          
          case "processing_complete":
            setIsProcessing(false);
            setProcessingChunkIndex(null);
            // Update meeting status
            setData(prev => prev ? {
              ...prev,
              meeting: { ...prev.meeting, status: "finalized" }
            } : null);
            // Close SSE
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            break;
          
          case "keepalive":
            // Ignore keepalive messages
            break;
        }
      },
      (error) => {
        console.error("SSE error:", error);
        setIsProcessing(false);
      }
    );
  }, []);

  const handleVersionChange = useCallback(async (version: number) => {
    if (!meetingId) return;
    
    try {
      const res = await getMeeting(meetingId, version);
      setData(res);
    } catch (e) {
      console.error("Failed to load version:", e);
    }
  }, [meetingId]);

  const handleWorkflowDeleted = useCallback((workflowId: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            currentState: {
              ...prev.currentState,
              data: {
                ...prev.currentState.data,
                workflows: prev.currentState.data.workflows.filter(
                  (w) => w.id !== workflowId
                ),
              },
            },
          }
        : null
    );
  }, []);

  const handleWorkflowUpdated = useCallback((
    workflowId: string, 
    nodes: { id: string; type: "process" | "decision" | "terminal"; label: string; variant?: "start" | "end" }[], 
    edges: { id: string; source: string; target: string; label?: string }[]
  ) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            currentState: {
              ...prev.currentState,
              data: {
                ...prev.currentState.data,
                workflows: prev.currentState.data.workflows.map((w) =>
                  w.id === workflowId
                    ? { ...w, nodes, edges }
                    : w
                ),
              },
            },
          }
        : null
    );
  }, []);

  if (!meetingId) {
    return <ErrorState message="Missing meeting ID" onBack={() => navigate("/")} />;
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState message={error || "Failed to load"} onBack={() => navigate("/")} />;
  }

  return (
    <MeetingContent 
      data={data} 
      versions={versions}
      isProcessing={isProcessing}
      processingChunkIndex={processingChunkIndex}
      onVersionChange={handleVersionChange}
      onWorkflowDeleted={handleWorkflowDeleted}
      onWorkflowUpdated={handleWorkflowUpdated}
    />
  );
}
