import { useState, useCallback, useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { Toolbar } from "./Toolbar";
import { 
  WorkflowBlock, 
  TextBlock, 
  ShapeBlock,
  type Position,
  type ShapeType,
  type ShapeColor,
} from "./blocks";
import type { Workflow } from "@/types";

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
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  const CARD_WIDTH = vw * 0.3;
  const GAP_X = vw * 0.03;
  const START_X = vw * 0.05;
  const START_Y = vh * 0.1;
  const ROW_HEIGHT = vh * 0.5;
  
  const col = index % 2;
  const row = Math.floor(index / 2);
  
  return {
    x: START_X + col * (CARD_WIDTH + GAP_X),
    y: START_Y + row * ROW_HEIGHT,
  };
}

/**
 * Get initial position for new blocks.
 */
function getNewBlockPosition(): Position {
  return {
    x: window.innerWidth * 0.3,
    y: window.innerHeight * 0.3,
  };
}

/**
 * Check if mouse is in trash zone.
 */
function isMouseInTrashZone(mouseX: number, mouseY: number): boolean {
  const trashHeight = 80;
  const trashWidth = 200;
  const centerX = window.innerWidth / 2;
  
  return (
    mouseY > window.innerHeight - trashHeight - 20 &&
    mouseX > centerX - trashWidth / 2 &&
    mouseX < centerX + trashWidth / 2
  );
}

interface CanvasViewProps {
  workflows: Workflow[];
  isEditable: boolean;
  onWorkflowUpdate: (workflowId: string, nodes: Node[], edges: Edge[]) => void;
  onWorkflowDelete: (workflowId: string) => void;
}

/**
 * Canvas view with infinite canvas, workflow blocks, and user-created elements.
 */
export function CanvasView({
  workflows,
  isEditable,
  onWorkflowUpdate,
  onWorkflowDelete,
}: CanvasViewProps) {
  // Workflow positions (keyed by workflow ID)
  const [workflowPositions, setWorkflowPositions] = useState<Record<string, Position>>({});
  
  // Workflow sizes (keyed by workflow ID)
  const [workflowSizes, setWorkflowSizes] = useState<Record<string, { width: number; height: number }>>({});
  
  // User-created blocks
  const [userBlocks, setUserBlocks] = useState<UserBlock[]>([]);
  
  // Selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  // Drag state for trash zone
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Keyboard delete handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === "Backspace" || e.key === "Delete") && selectedBlockId) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl as HTMLElement).isContentEditable) {
        return;
      }
      if (selectedBlockId.startsWith("text-") || selectedBlockId.startsWith("shape-")) {
        e.preventDefault();
        setUserBlocks(prev => prev.filter(b => b.id !== selectedBlockId));
        setSelectedBlockId(null);
      }
    }
  }, [selectedBlockId]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const getWorkflowPos = useCallback((workflowId: string, index: number): Position => {
    return workflowPositions[workflowId] || getWorkflowPosition(index);
  }, [workflowPositions]);

  const handleWorkflowPositionChange = useCallback((workflowId: string, position: Position) => {
    setWorkflowPositions(prev => ({ ...prev, [workflowId]: position }));
  }, []);

  const handleWorkflowSizeChange = useCallback((workflowId: string, width: number, height: number) => {
    setWorkflowSizes(prev => ({ ...prev, [workflowId]: { width, height } }));
  }, []);

  const getWorkflowSize = useCallback((workflowId: string) => {
    return workflowSizes[workflowId] || { width: 900, height: 500 };
  }, [workflowSizes]);

  const handleAddText = useCallback(() => {
    const newBlock: TextBlockState = {
      type: "text",
      id: `text-${Date.now()}`,
      position: getNewBlockPosition(),
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
      position: getNewBlockPosition(),
      shape,
      width: isSquare ? 100 : 140,
      height: 100,
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
    setIsOverTrash(isMouseInTrashZone(mouseX, mouseY));
  }, []);
  
  const handleBlockDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleBlockDragEnd = useCallback((blockId: string, mouseX: number, mouseY: number) => {
    setIsDragging(false);
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
    <div style={{ height: "100%", width: "100%", position: "relative" }} onClick={handleCanvasClick}>
      <InfiniteCanvas>
        {/* Workflow blocks from server */}
        {workflows.map((workflow, index) => {
          const size = getWorkflowSize(workflow.id);
          return (
            <WorkflowBlock
              key={workflow.id}
              workflow={workflow}
              position={getWorkflowPos(workflow.id, index)}
              onPositionChange={(pos) => handleWorkflowPositionChange(workflow.id, pos)}
              width={size.width}
              height={size.height}
              onSizeChange={(w, h) => handleWorkflowSizeChange(workflow.id, w, h)}
              selected={selectedBlockId === workflow.id}
              onSelect={() => setSelectedBlockId(workflow.id)}
              isEditable={isEditable}
              onWorkflowUpdate={onWorkflowUpdate}
              onWorkflowDelete={onWorkflowDelete}
            />
          );
        })}

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
      {isDragging && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "var(--space-md) var(--space-xl)",
            background: isOverTrash ? "var(--error)" : "var(--bg-elevated)",
            border: `2px dashed ${isOverTrash ? "var(--error)" : "var(--border-subtle)"}`,
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            color: isOverTrash ? "white" : "var(--text-muted)",
            transition: "all var(--transition-fast)",
            zIndex: 1000,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {isOverTrash ? "Release to delete" : "Drag here to delete"}
        </div>
      )}
    </div>
  );
}

