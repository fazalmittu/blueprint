import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Workflow } from "@/types";
import { DraggableBlock, type Position } from "./DraggableBlock";
import { BlockHeader } from "./BlockHeader";
import { WorkflowEditor } from "../editor";
import { workflowToReactFlow } from "../editor/layoutUtils";
import { ProcessNode, DecisionNode, TerminalNode } from "../editor/nodes";

// Node types for React Flow
const nodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  terminal: TerminalNode,
};

interface WorkflowBlockProps {
  workflow: Workflow;
  position: Position;
  onPositionChange: (position: Position) => void;
  width?: number;
  height?: number;
  onSizeChange?: (width: number, height: number) => void;
  selected?: boolean;
  onSelect?: () => void;
  isEditable?: boolean;
  onWorkflowUpdate?: (workflowId: string, nodes: Node[], edges: Edge[]) => void;
  onWorkflowDelete?: (workflowId: string) => void;
}

/**
 * Workflow block that displays a workflow diagram using React Flow.
 * Can be minimized to show only the header.
 * When isEditable=true and meeting is finalized, shows edit button.
 */
export function WorkflowBlock({
  workflow,
  position,
  onPositionChange,
  width = 480,
  height = 360,
  onSizeChange,
  selected = false,
  onSelect,
  isEditable = false,
  onWorkflowUpdate,
  onWorkflowDelete,
}: WorkflowBlockProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Convert workflow to React Flow format with layout
  const { nodes: displayNodes, edges: displayEdges } = useMemo(
    () => workflowToReactFlow(workflow),
    [workflow]
  );

  const toggleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      onWorkflowUpdate?.(workflow.id, nodes, edges);
      setIsEditing(false);
    },
    [workflow.id, onWorkflowUpdate]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("Delete this workflow?")) {
        onWorkflowDelete?.(workflow.id);
      }
    },
    [workflow.id, onWorkflowDelete]
  );

  // Resize handling
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = width;
      const startHeight = height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
        const newHeight = Math.max(200, startHeight + (moveEvent.clientY - startY));
        onSizeChange?.(newWidth, newHeight);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, height, onSizeChange]
  );

  const HeaderActions = (
    <div style={{ display: "flex", gap: "var(--space-xs)" }}>
      {isEditable && !isEditing && (
        <>
          <button
            onClick={handleEdit}
            style={iconButtonStyle}
            title="Edit workflow"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            style={{ ...iconButtonStyle, color: "var(--error)" }}
            title="Delete workflow"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </>
      )}
      <button
        onClick={toggleMinimize}
        style={iconButtonStyle}
        title={isMinimized ? "Expand" : "Minimize"}
      >
        {isMinimized ? "+" : "−"}
      </button>
    </div>
  );

  // Edit mode - full screen editor (rendered via portal to escape stacking contexts)
  const editorOverlay = isEditing
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            background: "var(--bg-primary)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Editor header */}
          <div
            style={{
              padding: "var(--space-md)",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-elevated)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Editing: {workflow.title}
              </h2>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                }}
              >
                Double-click nodes to edit labels. Drag between handles to
                connect.
              </p>
            </div>
          </div>

          {/* Editor content - use flex-grow with min-height 0 to allow proper sizing */}
          <div style={{ flex: "1 1 0%", minHeight: 0, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <WorkflowEditor
                initialNodes={displayNodes}
                initialEdges={displayEdges}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
              />
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {/* Portal overlay for editor */}
      {editorOverlay}

      {/* CSS to hide handles in read-only mode */}
      <style>{`
        .workflow-readonly .react-flow__handle {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>

      {/* Normal workflow block */}
      <DraggableBlock
        position={position}
        onPositionChange={onPositionChange}
        width={width}
        selected={selected}
        onSelect={onSelect}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          height: isMinimized ? "auto" : height,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <BlockHeader title={workflow.title} actions={HeaderActions} />

        {!isMinimized && (
          <>
            {/* Diagram - rendered with React Flow in read-only mode */}
            <div
              className="workflow-readonly"
              style={{
                background: "var(--bg-primary)",
                flex: 1,
                minHeight: 0,
              }}
            >
              <ReactFlowProvider>
                <ReactFlow
                  nodes={displayNodes}
                  edges={displayEdges}
                  nodeTypes={nodeTypes}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag={true}
                  panOnScroll={true}
                  zoomOnScroll={true}
                  zoomOnPinch={true}
                  zoomOnDoubleClick={true}
                  preventScrolling={true}
                  minZoom={0.2}
                  maxZoom={2}
                  fitView
                  fitViewOptions={{
                    padding: 0.3,
                    maxZoom: 1,
                    minZoom: 0.3,
                  }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="var(--border-subtle)" gap={16} size={1} />
                </ReactFlow>
              </ReactFlowProvider>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "var(--space-sm) var(--space-md)",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-secondary)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {workflow.sources.length} sources
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-xs)",
                }}
              >
                {workflow.sources.slice(0, 3).map((source) => (
                  <span
                    key={source}
                    style={{
                      fontSize: "0.625rem",
                      padding: "2px 6px",
                      background: "var(--accent-subtle)",
                      color: "var(--accent)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {source}
                  </span>
                ))}
                {workflow.sources.length > 3 && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      padding: "2px 6px",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    +{workflow.sources.length - 3}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Resize handle */}
        {!isMinimized && onSizeChange && (
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 16,
              height: 16,
              cursor: "nwse-resize",
              background: isResizing ? "var(--accent)" : "transparent",
              borderRadius: "0 0 var(--radius-lg) 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ opacity: selected ? 0.6 : 0.3 }}
            >
              <path
                d="M7 1L1 7M7 4L4 7M7 7L7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </DraggableBlock>
    </>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-muted)",
  fontSize: "0.875rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  transition: "all var(--transition-fast)",
};
