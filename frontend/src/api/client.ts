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
  }[];
}

export interface MeetingResponse {
  meeting: {
    meetingId: string;
    status: "active" | "finalized";
    orgId: string;
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
    };
  };
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
 */
export async function getMeeting(meetingId: string): Promise<MeetingResponse> {
  const res = await fetch(`${API_BASE}/meeting?meetingId=${encodeURIComponent(meetingId)}`);
  if (!res.ok) throw new Error("Failed to fetch meeting");
  return res.json();
}

