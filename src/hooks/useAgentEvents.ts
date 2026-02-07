/**
 * React hook for subscribing to real-time agent events via SSE.
 *
 * Callbacks are stored in refs so the SSE connection only reconnects
 * when sessionId or enabled changes — not when handler identity changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, ApprovalRequest } from "../lib/agents/types";

interface UseAgentEventsOptions {
  sessionId?: string;
  onEvent?: (event: AgentEvent) => void;
  onApproval?: (approval: ApprovalRequest) => void;
  enabled?: boolean;
}

interface ConnectionState {
  connected: boolean;
  error: string | null;
}

export function useAgentEvents({
  sessionId,
  onEvent,
  onApproval,
  enabled = true,
}: UseAgentEventsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const onApprovalRef = useRef(onApproval);
  const [state, setState] = useState<ConnectionState>({
    connected: false,
    error: null,
  });

  // Keep refs in sync with latest callbacks
  onEventRef.current = onEvent;
  onApprovalRef.current = onApproval;

  const connect = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build URL with optional sessionId filter
    const url = sessionId
      ? `/api/events?sessionId=${encodeURIComponent(sessionId)}`
      : "/api/events";

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setState({ connected: true, error: null });
    };

    eventSource.onerror = () => {
      setState({ connected: false, error: "Connection lost" });
      // Attempt reconnect after 3 seconds
      setTimeout(() => {
        if (enabled && eventSourceRef.current === eventSource) {
          connect();
        }
      }, 3000);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          setState({ connected: true, error: null });
          return;
        }

        if (data.type === "approval-request") {
          onApprovalRef.current?.({
            ...data,
            createdAt: new Date(data.createdAt),
          });
          return;
        }

        // Regular agent event
        onEventRef.current?.({
          ...data,
          timestamp: new Date(data.timestamp),
        });
      } catch (e) {
        console.error("Error parsing SSE event:", e);
      }
    };
  }, [sessionId, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return state;
}
