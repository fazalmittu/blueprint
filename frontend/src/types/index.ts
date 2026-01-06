/**
 * Type exports for the frontend application.
 * Generated types come from JSON schemas via ./scripts/generate_types.sh
 */

// Re-export generated types
export type {
  Workflow,
  CurrentState,
  CurrentStateVersion,
  Meeting,
  SocketEvent,
  ProcessRequest,
  ProcessResponse,
  CurrentStateData,
} from "./generated";

// Frontend-specific types (not from schemas)

/**
 * WebSocket connection states
 */
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
