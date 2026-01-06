/**
 * Auto-generated types from JSON schemas.
 * DO NOT EDIT - Run ./scripts/generate_types.sh to regenerate.
 */

export type { Workflow } from "./workflow";
export type { CurrentState } from "./currentState";
export type { CurrentStateVersion } from "./currentStateVersion";
export type { Meeting } from "./meeting";
export type { SocketEvent } from "./socketEvent";
export type { ProcessRequest } from "./processRequest";
export type { ProcessResponse } from "./processResponse";

// Re-export the state object from SocketEvent as CurrentState for convenience
// This is the actual shape of state data (meetingSummary + workflows)
import type { SocketEvent } from "./socketEvent";
export type CurrentStateData = SocketEvent["state"];
