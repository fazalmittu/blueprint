import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import type { ConnectionStatus } from "@/types";

interface UseWebSocketOptions<T> {
  url: string;
  onMessage: (data: T) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  reconnect: () => void;
}

/**
 * Generic WebSocket hook with automatic reconnection.
 * Uses external store pattern for status to avoid setState in effects.
 */
export function useWebSocket<T>({
  url,
  onMessage,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
}: UseWebSocketOptions<T>): UseWebSocketReturn {
  // External store for status (avoids setState in effect body)
  const statusRef = useRef<ConnectionStatus>("connecting");
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => statusRef.current, []);

  const setStatus = useCallback((newStatus: ConnectionStatus) => {
    statusRef.current = newStatus;
    listenersRef.current.forEach((listener) => listener());
  }, []);

  // Refs for WebSocket management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  // Sync callbacks to refs
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  });

  // Connection effect
  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Set status via external store (not setState)
      setStatus("connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          setStatus("connected");
          reconnectAttemptsRef.current = 0;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as T;
          onMessageRef.current(data);
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };

      ws.onerror = (event) => {
        if (isMounted) {
          setStatus("error");
        }
        onErrorRef.current?.(event);
      };

      ws.onclose = () => {
        if (isMounted) {
          setStatus("disconnected");

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = window.setTimeout(() => {
              if (isMounted) {
                connect();
              }
            }, reconnectInterval);
          }
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, reconnectInterval, maxReconnectAttempts, setStatus]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T;
        onMessageRef.current(data);
      } catch (e) {
        console.error("[WebSocket] Failed to parse message:", e);
      }
    };

    ws.onerror = (event) => {
      setStatus("error");
      onErrorRef.current?.(event);
    };

    ws.onclose = () => {
      setStatus("disconnected");
    };
  }, [url, setStatus]);

  const status = useSyncExternalStore(subscribe, getSnapshot);

  return { status, reconnect };
}
