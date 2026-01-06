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

/**
 * Main meeting canvas content.
 */
function MeetingContent({ data }: { data: MeetingResponse }) {
  const navigate = useNavigate();
  const state = data.currentState.data;
  const meeting = data.meeting;
  
  // Workflow positions (keyed by workflow ID)
  const [workflowPositions, setWorkflowPositions] = useState<Record<string, Position>>({});
  
  // Notes block state
  const [notesPosition, setNotesPosition] = useState<Position>({ x: 40, y: 80 });
  const [notesContent, setNotesContent] = useState<string>(state.meetingSummary);
  
  // User-created blocks
  const [userBlocks, setUserBlocks] = useState<UserBlock[]>([]);
  
  // Selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

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
      
      {/* Header bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 48,
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
