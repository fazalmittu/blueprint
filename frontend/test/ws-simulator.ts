/**
 * WebSocket Simulator for Frontend Development
 *
 * Sends fake meeting state updates every 2 seconds.
 * Run with: npx tsx test/ws-simulator.ts
 *
 * Requires: npm install -D tsx ws @types/ws
 */

import { WebSocketServer, WebSocket } from "ws";

interface WorkflowNode {
  id: string;
  type: "process" | "decision" | "terminal";
  label: string;
  variant?: "start" | "end";
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface Workflow {
  id: string;
  title: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sources: string[];
}

interface CurrentState {
  meetingSummary: string;
  workflows: Workflow[];
}

interface SocketEvent {
  type: "full_state";
  state: CurrentState;
}

// Simulated meeting data that evolves over time
const summaryStages = [
  "• Meeting started\n• Participants are introducing themselves",
  "• Meeting started\n• Participants are introducing themselves\n• Discussion topic: Q1 product roadmap",
  "• Meeting started\n• Participants are introducing themselves\n• Discussion topic: Q1 product roadmap\n• Key priorities being identified",
  "• Q1 roadmap meeting\n• Focus areas: mobile app launch, API improvements, customer dashboard redesign\n• Timeline discussion underway",
  "• Q1 roadmap meeting\n• Focus areas: mobile app launch, API improvements, customer dashboard redesign\n• Mobile app targeted for February release\n• API v2 planned for March",
  "• Q1 roadmap finalized\n• Mobile app: Feb 15\n• API v2: Mar 1\n• Dashboard redesign: Mar 15\n• Dependencies identified between teams",
];

const workflowStages: Workflow[][] = [
  [],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      nodes: [
        { id: "n1", type: "terminal", label: "Design Finalization", variant: "start" },
        { id: "n2", type: "process", label: "Development" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
      ],
      sources: ["chunk_0", "chunk_1"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      nodes: [
        { id: "n1", type: "terminal", label: "Design Finalization", variant: "start" },
        { id: "n2", type: "process", label: "Development" },
        { id: "n3", type: "terminal", label: "QA Testing", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
      sources: ["chunk_0", "chunk_1", "chunk_2"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      nodes: [
        { id: "n1", type: "terminal", label: "Design Finalization", variant: "start" },
        { id: "n2", type: "process", label: "Development" },
        { id: "n3", type: "process", label: "QA Testing" },
        { id: "n4", type: "decision", label: "Issues Found?" },
        { id: "n5", type: "terminal", label: "Release", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n2", label: "Yes" },
        { id: "e5", source: "n4", target: "n5", label: "No" },
      ],
      sources: ["chunk_0", "chunk_1", "chunk_2", "chunk_3"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      nodes: [
        { id: "n1", type: "terminal", label: "Design Finalization", variant: "start" },
        { id: "n2", type: "process", label: "Development" },
        { id: "n3", type: "process", label: "QA Testing" },
        { id: "n4", type: "decision", label: "Issues Found?" },
        { id: "n5", type: "terminal", label: "Release", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n2", label: "Yes" },
        { id: "e5", source: "n4", target: "n5", label: "No" },
      ],
      sources: ["chunk_0", "chunk_1", "chunk_2", "chunk_3"],
    },
    {
      id: "wf-2",
      title: "API v2 Migration",
      nodes: [
        { id: "n1", type: "terminal", label: "API Design Review", variant: "start" },
        { id: "n2", type: "process", label: "Schema Updates" },
        { id: "n3", type: "terminal", label: "Endpoint Development", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
      sources: ["chunk_4", "chunk_5"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      nodes: [
        { id: "n1", type: "terminal", label: "Design Finalization", variant: "start" },
        { id: "n2", type: "process", label: "Development" },
        { id: "n3", type: "process", label: "QA Testing" },
        { id: "n4", type: "decision", label: "Issues Found?" },
        { id: "n5", type: "process", label: "Beta Release" },
        { id: "n6", type: "process", label: "User Feedback" },
        { id: "n7", type: "decision", label: "Critical Issues?" },
        { id: "n8", type: "terminal", label: "Production Release", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n2", label: "Yes" },
        { id: "e5", source: "n4", target: "n5", label: "No" },
        { id: "e6", source: "n5", target: "n6" },
        { id: "e7", source: "n6", target: "n7" },
        { id: "e8", source: "n7", target: "n2", label: "Yes" },
        { id: "e9", source: "n7", target: "n8", label: "No" },
      ],
      sources: ["chunk_0", "chunk_1", "chunk_2", "chunk_3", "chunk_6"],
    },
    {
      id: "wf-2",
      title: "API v2 Migration",
      nodes: [
        { id: "n1", type: "terminal", label: "API Design Review", variant: "start" },
        { id: "n2", type: "process", label: "Schema Updates" },
        { id: "n3", type: "process", label: "Endpoint Development" },
        { id: "n4", type: "process", label: "Integration Testing" },
        { id: "n5", type: "process", label: "Documentation" },
        { id: "n6", type: "process", label: "Client SDK Updates" },
        { id: "n7", type: "terminal", label: "Staged Rollout", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6" },
        { id: "e6", source: "n6", target: "n7" },
      ],
      sources: ["chunk_4", "chunk_5", "chunk_7", "chunk_8"],
    },
    {
      id: "wf-3",
      title: "Dashboard Redesign",
      nodes: [
        { id: "n1", type: "terminal", label: "User Research", variant: "start" },
        { id: "n2", type: "process", label: "Wireframes" },
        { id: "n3", type: "process", label: "Visual Design" },
        { id: "n4", type: "process", label: "Component Library" },
        { id: "n5", type: "process", label: "Implementation" },
        { id: "n6", type: "terminal", label: "A/B Testing", variant: "end" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6" },
      ],
      sources: ["chunk_9", "chunk_10"],
    },
  ],
];

let stageIndex = 0;
const clients = new Set<WebSocket>();

function getCurrentState(): CurrentState {
  return {
    meetingSummary: summaryStages[stageIndex] ?? summaryStages[summaryStages.length - 1],
    workflows: workflowStages[stageIndex] ?? workflowStages[workflowStages.length - 1],
  };
}

function broadcastState() {
  const event: SocketEvent = {
    type: "full_state",
    state: getCurrentState(),
  };

  const message = JSON.stringify(event);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  console.log(`[${new Date().toISOString()}] Broadcast stage ${stageIndex + 1}/${summaryStages.length}`);
}

// Start WebSocket server
const PORT = 8000;
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🚀 WebSocket simulator running on ws://localhost:${PORT}`);
console.log(`   Connect to: ws://localhost:${PORT}/ws/{meetingId}`);
console.log(`   Updates every 2 seconds\n`);

wss.on("connection", (ws, req) => {
  const url = req.url ?? "/";
  console.log(`[+] Client connected: ${url}`);
  clients.add(ws);

  // Send current state immediately on connect
  const event: SocketEvent = {
    type: "full_state",
    state: getCurrentState(),
  };
  ws.send(JSON.stringify(event));

  ws.on("close", () => {
    console.log(`[-] Client disconnected: ${url}`);
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error(`[!] WebSocket error:`, error);
    clients.delete(ws);
  });
});

// Advance stage and broadcast every 2 seconds until final stage
const interval = setInterval(() => {
  if (stageIndex < summaryStages.length - 1) {
    stageIndex++;
    broadcastState();
  } else {
    // Stop at final stage - let user interact
    clearInterval(interval);
    console.log("\n✓ Final state reached. Canvas is now static. Interact freely!\n");
    console.log("  Press Ctrl+C to stop the server.\n");
  }
}, 2000);
