/**
 * WebSocket Simulator for Frontend Development
 *
 * Sends fake meeting state updates every 2 seconds.
 * Run with: npx tsx test/ws-simulator.ts
 *
 * Requires: npm install -D tsx ws @types/ws
 */

import { WebSocketServer, WebSocket } from "ws";

interface Workflow {
  id: string;
  title: string;
  mermaidDiagram: string;
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
  "Meeting started. Participants are introducing themselves.",
  "Meeting started. Participants are introducing themselves. Discussion topic: Q1 product roadmap.",
  "Meeting started. Participants are introducing themselves. Discussion topic: Q1 product roadmap. Key priorities being identified.",
  "Q1 roadmap meeting. Focus areas: mobile app launch, API improvements, customer dashboard redesign. Timeline discussion underway.",
  "Q1 roadmap meeting. Focus areas: mobile app launch, API improvements, customer dashboard redesign. Mobile app targeted for February release. API v2 planned for March.",
  "Q1 roadmap finalized. Mobile app: Feb 15. API v2: Mar 1. Dashboard redesign: Mar 15. Dependencies identified between teams.",
];

const workflowStages: Workflow[][] = [
  [],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      mermaidDiagram: `flowchart TD
    A[Design Finalization] --> B[Development]`,
      sources: ["chunk_0", "chunk_1"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      mermaidDiagram: `flowchart TD
    A[Design Finalization] --> B[Development]
    B --> C[QA Testing]`,
      sources: ["chunk_0", "chunk_1", "chunk_2"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      mermaidDiagram: `flowchart TD
    A[Design Finalization] --> B[Development]
    B --> C[QA Testing]
    C --> D{Issues Found?}
    D -- Yes --> B
    D -- No --> E[Release]`,
      sources: ["chunk_0", "chunk_1", "chunk_2", "chunk_3"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      mermaidDiagram: `flowchart TD
    A[Design Finalization] --> B[Development]
    B --> C[QA Testing]
    C --> D{Issues Found?}
    D -- Yes --> B
    D -- No --> E[Release]`,
      sources: ["chunk_0", "chunk_1", "chunk_2", "chunk_3"],
    },
    {
      id: "wf-2",
      title: "API v2 Migration",
      mermaidDiagram: `flowchart TD
    A[API Design Review] --> B[Schema Updates]
    B --> C[Endpoint Development]`,
      sources: ["chunk_4", "chunk_5"],
    },
  ],
  [
    {
      id: "wf-1",
      title: "Mobile App Launch",
      mermaidDiagram: `flowchart TD
    A[Design Finalization] --> B[Development]
    B --> C[QA Testing]
    C --> D{Issues Found?}
    D -- Yes --> B
    D -- No --> E[Beta Release]
    E --> F[User Feedback]
    F --> G{Critical Issues?}
    G -- Yes --> B
    G -- No --> H[Production Release]`,
      sources: ["chunk_0", "chunk_1", "chunk_2", "chunk_3", "chunk_6"],
    },
    {
      id: "wf-2",
      title: "API v2 Migration",
      mermaidDiagram: `flowchart TD
    A[API Design Review] --> B[Schema Updates]
    B --> C[Endpoint Development]
    C --> D[Integration Testing]
    D --> E[Documentation]
    E --> F[Client SDK Updates]
    F --> G[Staged Rollout]`,
      sources: ["chunk_4", "chunk_5", "chunk_7", "chunk_8"],
    },
    {
      id: "wf-3",
      title: "Dashboard Redesign",
      mermaidDiagram: `flowchart TD
    A[User Research] --> B[Wireframes]
    B --> C[Visual Design]
    C --> D[Component Library]
    D --> E[Implementation]
    E --> F[A/B Testing]`,
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

