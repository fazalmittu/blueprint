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
    transcript?: string;
    totalChunks?: number;
  }[];
}

export interface MeetingResponse {
  meeting: {
    meetingId: string;
    status: "active" | "finalized";
    orgId: string;
    transcript?: string;
    totalChunks?: number;
  };
  currentState: {
    version: number;
    currentStateId: string;
    data: {
      meetingSummary: string;
      workflows: {
        id: string;
        title: string;
        mermaidDiagram: string;
        sources: string[];
      }[];
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
