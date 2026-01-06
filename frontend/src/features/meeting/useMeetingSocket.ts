import { useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { SocketEvent, CurrentStateData, ConnectionStatus } from "@/types";

interface UseMeetingSocketReturn {
  state: CurrentStateData | null;
  status: ConnectionStatus;
  reconnect: () => void;
}

/**
 * Meeting-specific WebSocket hook.
 * Subscribes to meeting updates and maintains current state.
 */
export function useMeetingSocket(meetingId: string): UseMeetingSocketReturn {
  const [state, setState] = useState<CurrentStateData | null>(null);

  const handleMessage = useCallback((event: SocketEvent) => {
    if (event.type === "full_state") {
      setState(event.state);
    }
  }, []);

  const { status, reconnect } = useWebSocket<SocketEvent>({
    url: `ws://localhost:8000/ws/${meetingId}`,
    onMessage: handleMessage,
  });

  return { state, status, reconnect };
}

