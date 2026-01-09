import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { Workflow } from "../../../types/generated";

// Node dimensions for layout calculation
const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const DECISION_WIDTH = 160;
const DECISION_HEIGHT = 80;
const TERMINAL_WIDTH = 120;
const TERMINAL_HEIGHT = 40;

type WorkflowNode = Workflow["nodes"][0];
type WorkflowEdge = Workflow["edges"][0];

function getNodeDimensions(nodeType: string): { width: number; height: number } {
  switch (nodeType) {
    case "decision":
      return { width: DECISION_WIDTH, height: DECISION_HEIGHT };
    case "terminal":
      return { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT };
    default:
      return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
}

/**
 * Convert our workflow nodes/edges to React Flow format with dagre layout
 */
export function workflowToReactFlow(workflow: Workflow): {
  nodes: Node[];
  edges: Edge[];
} {
  // Create dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB", // Top to bottom layout
    align: "UL", // Align nodes to upper-left for cleaner vertical alignment
    nodesep: 80, // Horizontal spacing between nodes
    ranksep: 60, // Vertical spacing between ranks
    marginx: 40,
    marginy: 40,
  });

  // Add nodes to dagre
  workflow.nodes.forEach((node: WorkflowNode) => {
    const dims = getNodeDimensions(node.type);
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  });

  // Add edges to dagre
  workflow.edges.forEach((edge: WorkflowEdge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Convert to React Flow nodes
  const nodes: Node[] = workflow.nodes.map((node: WorkflowNode) => {
    const dagreNode = dagreGraph.node(node.id);
    const dims = getNodeDimensions(node.type);

    return {
      id: node.id,
      type: node.type, // Maps to our custom node types
      position: {
        // dagre returns center positions, React Flow uses top-left
        x: dagreNode.x - dims.width / 2,
        y: dagreNode.y - dims.height / 2,
      },
      data: {
        label: node.label,
        variant: node.variant,
      },
    };
  });

  // Convert to React Flow edges
  // For decision nodes, use specific handles based on label (Yes/No)
  const edges: Edge[] = workflow.edges.map((edge: WorkflowEdge) => {
    const sourceNode = workflow.nodes.find((n: WorkflowNode) => n.id === edge.source);
    const isFromDecision = sourceNode?.type === "decision";
    
    // Determine source handle based on label for decision nodes
    let sourceHandle: string | undefined;
    if (isFromDecision && edge.label) {
      const labelLower = edge.label.toLowerCase();
      if (labelLower === "yes" || labelLower === "y" || labelLower === "true") {
        sourceHandle = "yes";
      } else if (labelLower === "no" || labelLower === "n" || labelLower === "false") {
        sourceHandle = "no";
      } else {
        sourceHandle = "default";
      }
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      label: edge.label,
      type: "smoothstep",
      pathOptions: { borderRadius: 16 }, // Smoother corners
      animated: false,
      style: { strokeWidth: 2, stroke: "#94a3b8" },
      labelStyle: { fontWeight: 500, fontSize: 11 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.95 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    };
  });

  return { nodes, edges };
}

/**
 * Convert React Flow nodes/edges back to our workflow format
 */
export function reactFlowToWorkflow(
  nodes: Node[],
  edges: Edge[],
  workflowId: string,
  workflowTitle: string,
  sources: string[]
): Workflow {
  return {
    id: workflowId,
    title: workflowTitle,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type as "process" | "decision" | "terminal",
      label: (node.data as { label: string }).label || "Untitled",
      variant: (node.data as { variant?: "start" | "end" }).variant,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label as string | undefined,
    })),
    sources,
  };
}

/**
 * Re-layout existing React Flow nodes/edges using dagre
 */
export function relayoutNodes(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    align: "UL",
    nodesep: 80,
    ranksep: 60,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes
  nodes.forEach((node) => {
    const dims = getNodeDimensions(node.type || "process");
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  });

  // Add edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Update positions
  const layoutedNodes = nodes.map((node) => {
    const dagreNode = dagreGraph.node(node.id);
    const dims = getNodeDimensions(node.type || "process");
    return {
      ...node,
      position: {
        x: dagreNode.x - dims.width / 2,
        y: dagreNode.y - dims.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

