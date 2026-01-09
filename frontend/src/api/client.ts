/**
 * API client for backend endpoints.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

export interface OrgResponse {
  orgId: string;
}

export interface OrgsResponse {
  orgs: string[];
}

export interface MeetingsResponse {
  meetings: {
    meetingId: string;
    status: "active" | "finalized";
    orgId: string;
    title?: string;
    transcript?: string;
    totalChunks?: number;
  }[];
}

export interface WorkflowNode {
  id: string;
  type: "process" | "decision" | "terminal";
  label: string;
  variant?: "start" | "end";
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  title: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sources: string[];
}

export interface MeetingResponse {
  meeting: {
    meetingId: string;
    status: "active" | "finalized";
    orgId: string;
    title?: string;
    transcript?: string;
    totalChunks?: number;
  };
  currentState: {
    version: number;
    currentStateId: string;
    data: {
      meetingSummary: string;
      workflows: Workflow[];
      chunkIndex?: number;
      chunkText?: string;
    };
  };
}

export interface VersionInfo {
  version: number;
  currentStateId: string;
  chunkIndex?: number;
  chunkText?: string;
}

export interface MeetingVersionsResponse {
  meeting: MeetingResponse["meeting"];
  versions: VersionInfo[];
  totalVersions: number;
}

export interface CreateMeetingResponse {
  meetingId: string;
  currentStateId: string;
  totalChunks?: number;
}

export interface SSEMessage {
  type: "connected" | "processing_started" | "chunk_processed" | "processing_complete" | "keepalive";
  meetingId?: string;
  chunkIndex?: number;
  totalChunks?: number;
  version?: number;
  currentState?: MeetingResponse["currentState"];
  title?: string;
}

/**
 * Get the current user's organization.
 */
export async function getCurrentOrg(): Promise<OrgResponse> {
  const res = await fetch(`${API_BASE}/org`);
  if (!res.ok) throw new Error("Failed to fetch org");
  return res.json();
}

/**
 * Get all organizations.
 */
export async function getAllOrgs(): Promise<OrgsResponse> {
  const res = await fetch(`${API_BASE}/orgs`);
  if (!res.ok) throw new Error("Failed to fetch orgs");
  return res.json();
}

/**
 * Get all meetings for an organization.
 */
export async function getMeetingsByOrg(orgId: string): Promise<MeetingsResponse> {
  const res = await fetch(`${API_BASE}/meetings?orgId=${encodeURIComponent(orgId)}`);
  if (!res.ok) throw new Error("Failed to fetch meetings");
  return res.json();
}

/**
 * Get a specific meeting with its current state.
 * @param version - Optional specific version to fetch (defaults to latest)
 */
export async function getMeeting(meetingId: string, version?: number): Promise<MeetingResponse> {
  let url = `${API_BASE}/meeting?meetingId=${encodeURIComponent(meetingId)}`;
  if (version !== undefined) {
    url += `&version=${version}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch meeting");
  return res.json();
}

/**
 * Get all state versions for a meeting (for sidebar navigation).
 */
export async function getMeetingVersions(meetingId: string): Promise<MeetingVersionsResponse> {
  const res = await fetch(`${API_BASE}/meeting/${encodeURIComponent(meetingId)}/versions`);
  if (!res.ok) throw new Error("Failed to fetch meeting versions");
  return res.json();
}

/**
 * Create a new meeting, optionally with a transcript.
 */
export async function createMeeting(orgId: string, transcript?: string): Promise<CreateMeetingResponse> {
  const res = await fetch(`${API_BASE}/meeting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, transcript }),
  });
  if (!res.ok) throw new Error("Failed to create meeting");
  return res.json();
}

/**
 * Subscribe to real-time updates for a meeting via Server-Sent Events.
 * Returns an EventSource that emits SSEMessage events.
 */
export function subscribeMeetingUpdates(
  meetingId: string,
  onMessage: (message: SSEMessage) => void,
  onError?: (error: Event) => void
): EventSource {
  const eventSource = new EventSource(`${API_BASE}/meeting/${encodeURIComponent(meetingId)}/stream`);
  
  eventSource.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as SSEMessage;
      onMessage(message);
    } catch (e) {
      console.error("Failed to parse SSE message:", e);
    }
  };
  
  eventSource.onerror = (error) => {
    if (onError) {
      onError(error);
    } else {
      console.error("SSE error:", error);
    }
  };
  
  return eventSource;
}

// ==================== WORKFLOW ENDPOINTS ====================

export interface WorkflowResponse {
  workflow: Workflow;
}

export interface DeleteWorkflowResponse {
  success: boolean;
  deletedWorkflowId: string;
}

export interface CreateWorkflowRequest {
  title: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface UpdateWorkflowRequest {
  title?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

/**
 * Create a new workflow for a finalized meeting.
 */
export async function createWorkflow(
  meetingId: string,
  data: CreateWorkflowRequest
): Promise<WorkflowResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/workflow`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create workflow" }));
    throw new Error(error.error || "Failed to create workflow");
  }
  return res.json();
}

/**
 * Update a workflow for a finalized meeting.
 */
export async function updateWorkflow(
  meetingId: string,
  workflowId: string,
  data: UpdateWorkflowRequest
): Promise<WorkflowResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/workflow/${encodeURIComponent(workflowId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update workflow" }));
    throw new Error(error.error || "Failed to update workflow");
  }
  return res.json();
}

/**
 * Delete a workflow from a finalized meeting.
 */
export async function deleteWorkflow(
  meetingId: string,
  workflowId: string
): Promise<DeleteWorkflowResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/workflow/${encodeURIComponent(workflowId)}`,
    {
      method: "DELETE",
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to delete workflow" }));
    throw new Error(error.error || "Failed to delete workflow");
  }
  return res.json();
}

// ==================== MEETING SUMMARY ENDPOINT ====================

export interface UpdateSummaryRequest {
  meetingSummary: string;
}

export interface UpdateSummaryResponse {
  success: boolean;
  meetingSummary: string;
}

/**
 * Update the meeting summary for a finalized meeting.
 */
export async function updateMeetingSummary(
  meetingId: string,
  meetingSummary: string
): Promise<UpdateSummaryResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/summary`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingSummary }),
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update summary" }));
    throw new Error(error.error || "Failed to update summary");
  }
  return res.json();
}

// ==================== MEETING TITLE ENDPOINT ====================

export interface UpdateTitleResponse {
  success: boolean;
  title: string;
}

/**
 * Update the meeting title.
 */
export async function updateMeetingTitle(
  meetingId: string,
  title: string
): Promise<UpdateTitleResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/title`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update title" }));
    throw new Error(error.error || "Failed to update title");
  }
  return res.json();
}

// ==================== GENERATE DOCUMENT ENDPOINT ====================

export interface GenerateDocumentResponse {
  success: boolean;
  document: string;
}

/**
 * Generate a professional document from meeting data.
 */
export async function generateMeetingDocument(
  meetingId: string
): Promise<GenerateDocumentResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/generate-document`,
    {
      method: "POST",
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to generate document" }));
    throw new Error(error.error || "Failed to generate document");
  }
  return res.json();
}

// ==================== CHAT ENDPOINT ====================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatAction {
  type: "update_workflow" | "update_summary" | "none";
  workflowId?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  newSummary?: string;
}

export interface ChatResponse {
  message: string;
  action?: ChatAction;
}

/**
 * Send a chat message to the meeting assistant.
 */
export async function sendChatMessage(
  meetingId: string,
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const res = await fetch(
    `${API_BASE}/meeting/${encodeURIComponent(meetingId)}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    }
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to send message" }));
    throw new Error(error.error || "Failed to send message");
  }
  return res.json();
}
