import { useParams } from "react-router-dom";
import { useState, useCallback } from "react";
import { useMeetingSocket } from "./useMeetingSocket";
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
import type { ConnectionStatus } from "@/types";

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
 */
function getWorkflowPosition(index: number): Position {
  const CARD_WIDTH = 480;
  const GAP_X = 60;
  const START_X = 380;
  const START_Y = 80;
  const ROW_HEIGHT = 450;
  
  const col = index % 2;
  const row = Math.floor(index / 2);
  
  return {
    x: START_X + col * (CARD_WIDTH + GAP_X),
    y: START_Y + row * ROW_HEIGHT,
  };
}

/**
 * Status indicator component.
 */
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const statusConfig = {
    connecting: { color: "var(--warning)", label: "Connecting..." },
    connected: { color: "var(--success)", label: "Live" },
    disconnected: { color: "var(--text-muted)", label: "Disconnected" },
    error: { color: "var(--error)", label: "Error" },
  };

  const config = statusConfig[status];

  return (
    <div
      style={{
        position: "fixed",
        bottom: "var(--space-lg)",
        right: "var(--space-lg)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "var(--space-sm) var(--space-md)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        fontSize: "0.75rem",
        fontFamily: "var(--font-mono)",
        color: "var(--text-secondary)",
        zIndex: 100,
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: config.color,
          boxShadow: status === "connected" ? `0 0 8px ${config.color}` : "none",
        }}
      />
      {config.label}
    </div>
  );
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
        Connecting to meeting...
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
 * Missing meeting ID error.
 */
function MissingMeetingId() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--error)",
        fontFamily: "var(--font-mono)",
      }}
    >
      Missing meeting ID
    </div>
  );
}

/**
 * Main meeting canvas content.
 */
function MeetingContent({ meetingId }: { meetingId: string }) {
  const { state, status } = useMeetingSocket(meetingId);
  
  // Workflow positions (keyed by workflow ID)
  const [workflowPositions, setWorkflowPositions] = useState<Record<string, Position>>({});
  
  // Notes block state
  const [notesPosition, setNotesPosition] = useState<Position>({ x: 40, y: 80 });
  const [notesContent, setNotesContent] = useState<string>("");
  const [notesInitialized, setNotesInitialized] = useState(false);
  
  // User-created blocks
  const [userBlocks, setUserBlocks] = useState<UserBlock[]>([]);
  
  // Selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Initialize notes content from server
  if (state && !notesInitialized) {
    setNotesContent(state.meetingSummary);
    setNotesInitialized(true);
  }

  const getWorkflowPos = useCallback((workflowId: string, index: number): Position => {
    return workflowPositions[workflowId] || getWorkflowPosition(index);
  }, [workflowPositions]);

  const handleWorkflowPositionChange = useCallback((workflowId: string, position: Position) => {
    setWorkflowPositions(prev => ({ ...prev, [workflowId]: position }));
  }, []);

  const handleAddText = useCallback(() => {
    const newBlock: TextBlockState = {
      type: "text",
      id: `text-${Date.now()}`,
      position: { x: 400, y: 200 },
      content: "",
      width: 200,
    };
    setUserBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const handleAddShape = useCallback((shape: ShapeType) => {
    const colors: ShapeColor[] = ["blue", "green", "amber", "rose", "purple"];
    // Circles and diamonds default to square, rectangles are wider
    const isSquare = shape === "circle" || shape === "diamond";
    const newBlock: ShapeBlockState = {
      type: "shape",
      id: `shape-${Date.now()}`,
      position: { x: 400, y: 200 },
      shape,
      width: isSquare ? 100 : 140,
      height: 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      text: "",
    };
    setUserBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const handleBlockPositionChange = useCallback((blockId: string, position: Position) => {
    setUserBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, position } : block
    ));
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

  if (!state) {
    return <LoadingState />;
  }

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
                onPositionChange={(pos) => handleBlockPositionChange(block.id, pos)}
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
                onPositionChange={(pos) => handleBlockPositionChange(block.id, pos)}
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
      <StatusIndicator status={status} />
    </div>
  );
}

/**
 * Meeting page - smart container.
 */
export function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();

  if (!meetingId) {
    return <MissingMeetingId />;
  }

  return <MeetingContent meetingId={meetingId} />;
}
