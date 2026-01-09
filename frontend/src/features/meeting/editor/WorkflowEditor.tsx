import { useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ProcessNode } from "./nodes/ProcessNode";
import { DecisionNode } from "./nodes/DecisionNode";
import { TerminalNode } from "./nodes/TerminalNode";
import { useSaveState } from "../../../hooks/useSaveState";

// Node types for React Flow
const nodeTypes: NodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  terminal: TerminalNode,
};

interface WorkflowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => Promise<void> | void;
  onCancel?: () => void;
  readOnly?: boolean;
}

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

/**
 * Visual workflow editor using React Flow.
 * Allows adding nodes, connecting them, and editing labels.
 */
export function WorkflowEditor({
  initialNodes = [],
  initialEdges = [],
  onSave,
  onCancel,
  readOnly = false,
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Use shared save state hook
  const { hasUnsavedChanges, isSaving, markChanged, save } = useSaveState<{
    nodes: Node[];
    edges: Edge[];
  }>({
    onSave: onSave ? async (data) => onSave(data.nodes, data.edges) : undefined,
    enableKeyboardShortcut: !readOnly,
  });

  // Handle Cmd+S keyboard shortcut
  useEffect(() => {
    if (readOnly || !onSave) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          await save({ nodes, edges });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, onSave, hasUnsavedChanges, save, nodes, edges]);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection) => {
      const edge = {
        ...connection,
        id: `edge_${Date.now()}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "var(--border-strong)", strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(edge, eds));
      markChanged();
    },
    [setEdges, markChanged]
  );

  // Handle node label changes
  const handleLabelChange = useCallback(
    (nodeId: string, newLabel: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, label: newLabel } }
            : node
        )
      );
      markChanged();
    },
    [setNodes, markChanged]
  );

  // Enhanced nodes with label change callback
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onLabelChange: (label: string) => handleLabelChange(node.id, label),
        },
      })),
    [nodes, handleLabelChange]
  );

  // Add new node
  const addNode = useCallback(
    (type: "process" | "decision" | "start" | "end") => {
      const id = getNodeId();
      const position = { x: 250, y: 150 + nodes.length * 80 };

      let newNode: Node;
      if (type === "start" || type === "end") {
        newNode = {
          id,
          type: "terminal",
          position,
          data: {
            label: type === "start" ? "Start" : "End",
            variant: type,
          },
        };
      } else if (type === "decision") {
        newNode = {
          id,
          type: "decision",
          position,
          data: { label: "Condition?" },
        };
      } else {
        newNode = {
          id,
          type: "process",
          position,
          data: { label: "New Step" },
        };
      }

      setNodes((nds) => [...nds, newNode]);
      markChanged();
    },
    [nodes.length, setNodes, markChanged]
  );

  // Delete selected nodes/edges
  const onDelete = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
    markChanged();
  }, [setNodes, setEdges, markChanged]);

  // Handle keyboard shortcuts
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && !readOnly) {
        onDelete();
      }
    },
    [onDelete, readOnly]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    await save({ nodes, edges });
  }, [nodes, edges, save]);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
        style={{
          background: "var(--bg-secondary)",
        }}
      >
        <Background color="var(--canvas-dot)" gap={20} />
        <Controls
          showInteractive={!readOnly}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
          }}
        />
        <MiniMap
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
          }}
          nodeColor={(node) => {
            if (node.type === "terminal") {
              return node.data.variant === "start" ? "#4ade80" : "#f87171";
            }
            if (node.type === "decision") return "#fbbf24";
            return "var(--accent)";
          }}
        />

        {/* Toolbar panel */}
        {!readOnly && (
          <Panel position="top-left">
            <div
              style={{
                display: "flex",
                gap: "var(--space-xs)",
                padding: "var(--space-sm)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <button
                onClick={() => addNode("start")}
                style={toolbarButtonStyle}
                title="Add Start"
              >
                <span style={{ color: "#10b981" }}>●</span> Start
              </button>
              <button
                onClick={() => addNode("process")}
                style={toolbarButtonStyle}
                title="Add Process"
              >
                <span style={{ color: "var(--accent)" }}>■</span> Process
              </button>
              <button
                onClick={() => addNode("decision")}
                style={toolbarButtonStyle}
                title="Add Decision"
              >
                <span style={{ color: "#f59e0b" }}>◆</span> Decision
              </button>
              <button
                onClick={() => addNode("end")}
                style={toolbarButtonStyle}
                title="Add End"
              >
                <span style={{ color: "#ef4444" }}>●</span> End
              </button>
            </div>
          </Panel>
        )}

        {/* Save/Cancel panel */}
        {!readOnly && (
          <Panel position="top-right">
            <div
              style={{
                display: "flex",
                gap: "var(--space-sm)",
                padding: "var(--space-sm)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <button
                onClick={onCancel}
                style={{
                  ...toolbarButtonStyle,
                  background: "var(--bg-tertiary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
                style={{
                  ...toolbarButtonStyle,
                  background: hasUnsavedChanges && !isSaving ? "var(--accent)" : "var(--bg-tertiary)",
                  color: hasUnsavedChanges && !isSaving ? "white" : "var(--text-muted)",
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

const toolbarButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-primary)",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--text-secondary)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-xs)",
  transition: "all var(--transition-fast)",
};

