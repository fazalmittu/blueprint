import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";
import type { Workflow } from "../../../types/generated";

// Initialize ELK
const elk = new ELK();

// Base dimensions
const MIN_NODE_WIDTH = 150;
const MAX_NODE_WIDTH = 300;
const NODE_HEIGHT = 60;
const CHAR_WIDTH = 7; // Approximate width per character
const PADDING = 40; // Horizontal padding for text

// Decision nodes are diamonds
const DECISION_SIZE = 120; // Visual size of diamond container
const DECISION_BOUNDING_BOX = DECISION_SIZE; // Match visual size, rely on spacing

const TERMINAL_WIDTH = 90;
const TERMINAL_HEIGHT = 50;

type WorkflowNode = Workflow["nodes"][0];
type WorkflowEdge = Workflow["edges"][0];

/**
 * Calculate node width based on text content
 */
function calculateNodeWidth(label: string, nodeType: string): number {
  if (nodeType === "terminal") {
    return TERMINAL_WIDTH;
  }
  if (nodeType === "decision") {
    return DECISION_BOUNDING_BOX; // Use bounding box for layout
  }
  
  // For process nodes, calculate based on text length
  const textWidth = label.length * CHAR_WIDTH + PADDING;
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, textWidth));
}

function getNodeDimensions(node: WorkflowNode | Node, isReactFlow = false): { width: number; height: number } {
  const nodeType = isReactFlow ? (node as Node).type || "process" : (node as WorkflowNode).type;
  const label = isReactFlow 
    ? ((node as Node).data as { label?: string })?.label || ""
    : (node as WorkflowNode).label;
  
  switch (nodeType) {
    case "decision":
      return { width: DECISION_BOUNDING_BOX, height: DECISION_BOUNDING_BOX };
    case "terminal":
      return { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT };
    default:
      return { width: calculateNodeWidth(label, nodeType), height: NODE_HEIGHT };
  }
}

// Common ELK layout options for horizontal layout
const elkLayoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "100", // Vertical spacing between nodes in same layer
  "elk.spacing.edgeNode": "50",
  "elk.layered.spacing.nodeNodeBetweenLayers": "150", // Horizontal spacing between layers
  "elk.layered.spacing.edgeNodeBetweenLayers": "50",
  "elk.edgeRouting": "POLYLINE", // Simpler edge routing
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
  "elk.padding": "[top=50,left=50,bottom=50,right=50]",
};

/**
 * Build ELK nodes for horizontal layout.
 */
function buildElkNodes(nodes: WorkflowNode[] | Node[], isReactFlow = false) {
  return nodes.map((node) => {
    const dims = getNodeDimensions(node, isReactFlow);
    const nodeType = isReactFlow ? (node as Node).type || "process" : (node as WorkflowNode).type;
    
    // Decision nodes have special ports for branches
    if (nodeType === "decision") {
      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        properties: {
          "elk.portConstraints": "FIXED_SIDE",
        },
        ports: [
          { id: `${node.id}_in`, properties: { "elk.port.side": "WEST" } },
          { id: `${node.id}_yes`, properties: { "elk.port.side": "NORTH" } },
          { id: `${node.id}_no`, properties: { "elk.port.side": "SOUTH" } },
          { id: `${node.id}_default`, properties: { "elk.port.side": "EAST" } },
        ],
      };
    }
    
    // Regular nodes: input on left, output on right
    return {
      id: node.id,
      width: dims.width,
      height: dims.height,
      properties: {
        "elk.portConstraints": "FIXED_SIDE",
      },
      ports: [
        { id: `${node.id}_in`, properties: { "elk.port.side": "WEST" } },
        { id: `${node.id}_out`, properties: { "elk.port.side": "EAST" } },
      ],
    };
  });
}

/**
 * Build ELK edges with proper port assignments
 */
function buildElkEdges(
  edges: WorkflowEdge[] | Edge[],
  nodes: WorkflowNode[] | Node[],
  isReactFlow = false
) {
  return edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const sourceType = isReactFlow 
      ? (sourceNode as Node)?.type 
      : (sourceNode as WorkflowNode)?.type;
    
    // Determine source port
    let sourcePort: string;
    if (sourceType === "decision" && edge.label) {
      const labelLower = String(edge.label).toLowerCase();
      if (labelLower === "yes" || labelLower === "y" || labelLower === "true") {
        sourcePort = `${edge.source}_yes`;
      } else if (labelLower === "no" || labelLower === "n" || labelLower === "false") {
        sourcePort = `${edge.source}_no`;
      } else {
        sourcePort = `${edge.source}_default`;
      }
    } else {
      sourcePort = `${edge.source}_out`;
    }
    
    return {
      id: edge.id,
      sources: [sourcePort],
      targets: [`${edge.target}_in`],
    };
  });
}

/**
 * Create styled edges for React Flow
 */
function createStyledEdges(
  workflowEdges: WorkflowEdge[],
  workflowNodes: WorkflowNode[]
): Edge[] {
  return workflowEdges.map((edge) => {
    const sourceNode = workflowNodes.find((n) => n.id === edge.source);
    const isFromDecision = sourceNode?.type === "decision";

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
      animated: false,
      style: { strokeWidth: 2, stroke: "#94a3b8" },
      labelStyle: { fontWeight: 500, fontSize: 11 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.95 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    };
  });
}

/**
 * Convert our workflow nodes/edges to React Flow format with ELK layout.
 * Uses horizontal (left-to-right) layout with center alignment.
 */
export async function workflowToReactFlowAsync(workflow: Workflow): Promise<{
  nodes: Node[];
  edges: Edge[];
}> {
  const elkNodes = buildElkNodes(workflow.nodes);
  const elkEdges = buildElkEdges(workflow.edges, workflow.nodes);

  const elkGraph = {
    id: "root",
    layoutOptions: elkLayoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  // Run ELK layout
  const layoutedGraph = await elk.layout(elkGraph);

  // Find max node height for vertical centering
  const allHeights = workflow.nodes.map(n => getNodeDimensions(n).height);
  const maxNodeHeight = Math.max(...allHeights);
  const centerY = maxNodeHeight / 2;

  // Convert to React Flow nodes with center alignment
  const nodes: Node[] = workflow.nodes.map((node: WorkflowNode) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    const dims = getNodeDimensions(node);
    
    // Calculate Y so node center aligns with centerY
    const y = centerY - dims.height / 2;
    
    return {
      id: node.id,
      type: node.type,
      position: {
        x: elkNode?.x ?? 0,
        y: y,
      },
      data: {
        label: node.label,
        variant: node.variant,
        width: dims.width, // Pass calculated width to component
      },
    };
  });

  const edges = createStyledEdges(workflow.edges, workflow.nodes);

  return { nodes, edges };
}

/**
 * Synchronous version - returns placeholder positions.
 */
export function workflowToReactFlow(workflow: Workflow): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  let xOffset = 0;
  
  const allHeights = workflow.nodes.map(n => getNodeDimensions(n).height);
  const maxNodeHeight = Math.max(...allHeights);
  const centerY = maxNodeHeight / 2;
  
  workflow.nodes.forEach((node: WorkflowNode) => {
    const dims = getNodeDimensions(node);
    const y = centerY - dims.height / 2;
    
    nodes.push({
      id: node.id,
      type: node.type,
      position: {
        x: xOffset,
        y: y,
      },
      data: {
        label: node.label,
        variant: node.variant,
        width: dims.width,
      },
    });
    xOffset += dims.width + 60;
  });

  const edges = createStyledEdges(workflow.edges, workflow.nodes);

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
 * Re-layout existing React Flow nodes/edges using ELK
 */
export async function relayoutNodesAsync(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const elkNodes = buildElkNodes(nodes, true);
  const elkEdges = buildElkEdges(edges, nodes, true);

  const elkGraph = {
    id: "root",
    layoutOptions: elkLayoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(elkGraph);

  const allHeights = nodes.map(n => getNodeDimensions(n, true).height);
  const maxNodeHeight = Math.max(...allHeights);
  const centerY = maxNodeHeight / 2;

  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    const dims = getNodeDimensions(node, true);
    const y = centerY - dims.height / 2;
    
    return {
      ...node,
      position: {
        x: elkNode?.x ?? node.position.x,
        y: y,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Synchronous relayout - returns original nodes
 */
export function relayoutNodes(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  return { nodes, edges };
}
