import { useParams } from "react-router-dom";
import { useMeetingSocket } from "./useMeetingSocket";
import { Canvas } from "./Canvas";
import type { ConnectionStatus } from "@/types";

/**
 * Renders connection status indicator.
 */
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const statusConfig = {
    connecting: { color: "var(--warning)", label: "Connecting..." },
    connected: { color: "var(--success)", label: "Connected" },
    disconnected: { color: "var(--text-muted)", label: "Disconnected" },
    error: { color: "var(--error)", label: "Error" },
  };

  const config = statusConfig[status];

  return (
    <div
      style={{
        position: "fixed",
        bottom: "var(--space-md)",
        right: "var(--space-md)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        padding: "var(--space-sm) var(--space-md)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        fontSize: "0.75rem",
        fontFamily: "var(--font-mono)",
        color: "var(--text-secondary)",
        zIndex: 1000,
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: config.color,
        }}
      />
      {config.label}
    </div>
  );
}

/**
 * Loading state while waiting for first message.
 */
function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-lg)",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "2px solid var(--border-subtle)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          fontFamily: "var(--font-mono)",
        }}
      >
        Waiting for meeting data...
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Error state when meeting ID is missing.
 */
function MissingMeetingId() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--error)",
        fontFamily: "var(--font-mono)",
      }}
    >
      Missing meeting ID
    </div>
  );
}

/**
 * Inner component that uses the meeting socket hook.
 * Separated to ensure hooks are called unconditionally.
 */
function MeetingContent({ meetingId }: { meetingId: string }) {
  const { state, status } = useMeetingSocket(meetingId);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      {state ? <Canvas state={state} /> : <LoadingState />}
      <StatusIndicator status={status} />
    </div>
  );
}

/**
 * Meeting page - smart container.
 * Manages WebSocket connection and holds state.
 */
export function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();

  if (!meetingId) {
    return <MissingMeetingId />;
  }

  return <MeetingContent meetingId={meetingId} />;
}
