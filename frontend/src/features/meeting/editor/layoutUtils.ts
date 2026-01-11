import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";
import type { Workflow } from "../../../types/generated";

// Initialize ELK
const elk = new ELK();

// Node dimensions for layout calculation
const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const DECISION_WIDTH = 120;
const DECISION_HEIGHT = 120;
const TERMINAL_WIDTH = 160;
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
 * Convert our workflow nodes/edges to React Flow format with ELK layout.
 * ELK provides much better layout for complex graphs with proper edge routing.
 */
export async function workflowToReactFlowAsync(workflow: Workflow): Promise<{
  nodes: Node[];
  edges: Edge[];
}> {
  // Build a map to track which nodes have back-edges (loops) coming into them
  const backEdgeTargets = new Set<string>();
  const nodeIndexMap = new Map<string, number>();
  workflow.nodes.forEach((node: WorkflowNode, idx: number) => {
    nodeIndexMap.set(node.id, idx);
  });
  
  // Detect back-edges: edges where target appears before source in node order (loops)
  workflow.edges.forEach((edge: WorkflowEdge) => {
    const sourceIdx = nodeIndexMap.get(edge.source) ?? 0;
    const targetIdx = nodeIndexMap.get(edge.target) ?? 0;
    if (targetIdx < sourceIdx) {
      backEdgeTargets.add(edge.target);
    }
  });

  // Build ELK graph structure with port constraints for all nodes
  const elkNodes = workflow.nodes.map((node: WorkflowNode) => {
    const dims = getNodeDimensions(node.type);
    const hasBackEdge = backEdgeTargets.has(node.id);
    
    // For decision nodes, add specific ports for yes/no branches
    if (node.type === "decision") {
      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        properties: {
          "elk.portConstraints": "FIXED_SIDE",
        },
        ports: [
          { id: `${node.id}_in_top`, properties: { "elk.port.side": "NORTH" } },
          { id: `${node.id}_in_left`, properties: { "elk.port.side": "WEST" } },
          { id: `${node.id}_yes`, properties: { "elk.port.side": "SOUTH" } },
          { id: `${node.id}_no`, properties: { "elk.port.side": "SOUTH" } },
          { id: `${node.id}_default`, properties: { "elk.port.side": "SOUTH" } },
        ],
      };
    }
    
    // For nodes with back-edges, add ports on multiple sides
    if (hasBackEdge) {
      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        properties: {
          "elk.portConstraints": "FIXED_SIDE",
        },
        ports: [
          { id: `${node.id}_in_top`, properties: { "elk.port.side": "NORTH" } },
          { id: `${node.id}_in_left`, properties: { "elk.port.side": "WEST" } },
          { id: `${node.id}_out`, properties: { "elk.port.side": "SOUTH" } },
        ],
      };
    }
    
    // Regular nodes - simple top input, bottom output
    return {
      id: node.id,
      width: dims.width,
      height: dims.height,
      properties: {
        "elk.portConstraints": "FIXED_SIDE",
      },
      ports: [
        { id: `${node.id}_in`, properties: { "elk.port.side": "NORTH" } },
        { id: `${node.id}_out`, properties: { "elk.port.side": "SOUTH" } },
      ],
    };
  });

  // Build edges with proper port assignments
  const elkEdges = workflow.edges.map((edge: WorkflowEdge) => {
    const sourceNode = workflow.nodes.find((n: WorkflowNode) => n.id === edge.source);
    const targetNode = workflow.nodes.find((n: WorkflowNode) => n.id === edge.target);
    const sourceIdx = nodeIndexMap.get(edge.source) ?? 0;
    const targetIdx = nodeIndexMap.get(edge.target) ?? 0;
    const isBackEdge = targetIdx < sourceIdx;
    
    // Determine source port
    let sourcePort: string;
    if (sourceNode?.type === "decision" && edge.label) {
      const labelLower = edge.label.toLowerCase();
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
    
    // Determine target port - use left side for back-edges
    let targetPort: string;
    if (isBackEdge) {
      targetPort = `${edge.target}_in_left`;
    } else if (targetNode?.type === "decision") {
      targetPort = `${edge.target}_in_top`;
    } else if (backEdgeTargets.has(edge.target)) {
      targetPort = `${edge.target}_in_top`;
    } else {
      targetPort = `${edge.target}_in`;
    }
    
    return {
      id: edge.id,
      sources: [sourcePort],
      targets: [targetPort],
    };
  });

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.alignment": "CENTER",
      "elk.spacing.nodeNode": "50",
      "elk.spacing.edgeNode": "30",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.layered.spacing.edgeNodeBetweenLayers": "30",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
      "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
      "elk.layered.mergeEdges": "true",
      "elk.layered.feedbackEdges": "true",
      "elk.padding": "[top=50,left=50,bottom=50,right=50]",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  // Run ELK layout
  const layoutedGraph = await elk.layout(elkGraph);

  // Convert to React Flow nodes
  const nodes: Node[] = workflow.nodes.map((node: WorkflowNode) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    return {
      id: node.id,
      type: node.type,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0,
      },
      data: {
        label: node.label,
        variant: node.variant,
      },
    };
  });

  // Convert to React Flow edges
  const edges: Edge[] = workflow.edges.map((edge: WorkflowEdge) => {
    const sourceNode = workflow.nodes.find((n: WorkflowNode) => n.id === edge.source);
    const isFromDecision = sourceNode?.type === "decision";
    
    // Detect back-edges for target handle assignment
    const sourceIdx = nodeIndexMap.get(edge.source) ?? 0;
    const targetIdx = nodeIndexMap.get(edge.target) ?? 0;
    const isBackEdge = targetIdx < sourceIdx;

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
    
    // Determine target handle - use "left" for back-edges, "top" for forward
    const targetHandle = isBackEdge ? "left" : "top";

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
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

  return { nodes, edges };
}

/**
 * Synchronous version that uses ELK layout (returns promise).
 * This is a wrapper for backward compatibility.
 */
export function workflowToReactFlow(workflow: Workflow): {
  nodes: Node[];
  edges: Edge[];
} {
  // Build node index map for back-edge detection
  const nodeIndexMap = new Map<string, number>();
  workflow.nodes.forEach((node: WorkflowNode, idx: number) => {
    nodeIndexMap.set(node.id, idx);
  });

  // For synchronous calls, use a simpler initial layout
  // The async version should be used when possible
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Simple initial positions - will be replaced by async layout
  let yOffset = 0;
  workflow.nodes.forEach((node: WorkflowNode) => {
    const dims = getNodeDimensions(node.type);
    nodes.push({
      id: node.id,
      type: node.type,
      position: {
        x: 200,
        y: yOffset,
      },
      data: {
        label: node.label,
        variant: node.variant,
      },
    });
    yOffset += dims.height + 60;
  });

  workflow.edges.forEach((edge: WorkflowEdge) => {
    const sourceNode = workflow.nodes.find((n: WorkflowNode) => n.id === edge.source);
    const isFromDecision = sourceNode?.type === "decision";
    
    // Detect back-edges
    const sourceIdx = nodeIndexMap.get(edge.source) ?? 0;
    const targetIdx = nodeIndexMap.get(edge.target) ?? 0;
    const isBackEdge = targetIdx < sourceIdx;

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
    
    const targetHandle = isBackEdge ? "left" : "top";

    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle,
      targetHandle,
      label: edge.label,
      type: "smoothstep",
      animated: false,
      style: { strokeWidth: 2, stroke: "#94a3b8" },
      labelStyle: { fontWeight: 500, fontSize: 11 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.95 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    });
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
 * Re-layout existing React Flow nodes/edges using ELK
 */
export async function relayoutNodesAsync(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  // Build a map to track which nodes have back-edges (loops) coming into them
  const backEdgeTargets = new Set<string>();
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((node, idx) => {
    nodeIndexMap.set(node.id, idx);
  });
  
  // Detect back-edges: edges where target appears before source in node order
  edges.forEach((edge) => {
    const sourceIdx = nodeIndexMap.get(edge.source) ?? 0;
    const targetIdx = nodeIndexMap.get(edge.target) ?? 0;
    if (targetIdx < sourceIdx) {
      backEdgeTargets.add(edge.target);
    }
  });

  // Build ELK nodes with port constraints
  const elkNodes = nodes.map((node) => {
    const dims = getNodeDimensions(node.type || "process");
    const hasBackEdge = backEdgeTargets.has(node.id);
    
    if (node.type === "decision") {
      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        properties: {
          "elk.portConstraints": "FIXED_SIDE",
        },
        ports: [
          { id: `${node.id}_in_top`, properties: { "elk.port.side": "NORTH" } },
          { id: `${node.id}_in_left`, properties: { "elk.port.side": "WEST" } },
          { id: `${node.id}_yes`, properties: { "elk.port.side": "SOUTH" } },
          { id: `${node.id}_no`, properties: { "elk.port.side": "SOUTH" } },
          { id: `${node.id}_default`, properties: { "elk.port.side": "SOUTH" } },
        ],
      };
    }
    
    if (hasBackEdge) {
      return {
        id: node.id,
        width: dims.width,
        height: dims.height,
        properties: {
          "elk.portConstraints": "FIXED_SIDE",
        },
        ports: [
          { id: `${node.id}_in_top`, properties: { "elk.port.side": "NORTH" } },
          { id: `${node.id}_in_left`, properties: { "elk.port.side": "WEST" } },
          { id: `${node.id}_out`, properties: { "elk.port.side": "SOUTH" } },
        ],
      };
    }
    
    return {
      id: node.id,
      width: dims.width,
      height: dims.height,
      properties: {
        "elk.portConstraints": "FIXED_SIDE",
      },
      ports: [
        { id: `${node.id}_in`, properties: { "elk.port.side": "NORTH" } },
        { id: `${node.id}_out`, properties: { "elk.port.side": "SOUTH" } },
      ],
    };
  });

  // Build edges with proper port assignments
  const elkEdges = edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceIdx = nodeIndexMap.get(edge.source) ?? 0;
    const targetIdx = nodeIndexMap.get(edge.target) ?? 0;
    const isBackEdge = targetIdx < sourceIdx;
    
    // Determine source port
    let sourcePort: string;
    if (sourceNode?.type === "decision" && edge.label) {
      const labelStr = String(edge.label).toLowerCase();
      if (labelStr === "yes" || labelStr === "y" || labelStr === "true") {
        sourcePort = `${edge.source}_yes`;
      } else if (labelStr === "no" || labelStr === "n" || labelStr === "false") {
        sourcePort = `${edge.source}_no`;
      } else {
        sourcePort = `${edge.source}_default`;
      }
    } else {
      sourcePort = `${edge.source}_out`;
    }
    
    // Determine target port
    let targetPort: string;
    if (isBackEdge) {
      targetPort = `${edge.target}_in_left`;
    } else if (targetNode?.type === "decision") {
      targetPort = `${edge.target}_in_top`;
    } else if (backEdgeTargets.has(edge.target)) {
      targetPort = `${edge.target}_in_top`;
    } else {
      targetPort = `${edge.target}_in`;
    }
    
    return {
      id: edge.id,
      sources: [sourcePort],
      targets: [targetPort],
    };
  });

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.alignment": "CENTER",
      "elk.spacing.nodeNode": "50",
      "elk.spacing.edgeNode": "30",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.layered.spacing.edgeNodeBetweenLayers": "30",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
      "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
      "elk.layered.mergeEdges": "true",
      "elk.layered.feedbackEdges": "true",
      "elk.padding": "[top=50,left=50,bottom=50,right=50]",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(elkGraph);

  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    return {
      ...node,
      position: {
        x: elkNode?.x ?? node.position.x,
        y: elkNode?.y ?? node.position.y,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Synchronous relayout - returns original nodes (use async version for actual layout)
 */
export function relayoutNodes(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  // For sync version, just return as-is
  // Use relayoutNodesAsync for actual layout
  return { nodes, edges };
}