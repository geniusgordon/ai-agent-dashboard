/**
 * Custom hook encapsulating all session detail orchestration:
 * queries, mutations, SSE subscription, and event merge logic.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageAttachment } from "@/components/dashboard";
import { useTRPC } from "@/integrations/trpc/react";
import { extractContent } from "@/lib/agents/event-utils";
import type {
  AgentEvent,
  ApprovalRequest,
  PlanPayload,
} from "@/lib/agents/types";
import { useAgentEvents } from "./useAgentEvents";

const NEAR_BOTTOM_THRESHOLD = 100;

export function useSessionDetail(sessionId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const eventsRef = useRef(events);
  const [optimisticApproval, setOptimisticApproval] =
    useState<ApprovalRequest | null>(null);
  const [taskPanelCollapsed, setTaskPanelCollapsed] = useState(true);
  const initialScrollDone = useRef(false);
  const lastEventTimeRef = useRef(0);
  const scrollScheduledRef = useRef(false);

  // Reset local state when switching sessions
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      setEvents([]);
      setOptimisticApproval(null);
      setAutoScroll(true);
      autoScrollRef.current = true;
      setShowScrollButton(false);
      initialScrollDone.current = false;
    }
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const sessionQuery = useQuery(
    trpc.sessions.getSession.queryOptions({ sessionId }),
  );
  const session = sessionQuery.data;

  // Get client to check capabilities
  const clientQuery = useQuery({
    ...trpc.sessions.getClient.queryOptions({
      clientId: session?.clientId ?? "",
    }),
    enabled: !!session?.clientId,
  });
  const client = clientQuery.data;
  const supportsImages =
    client?.capabilities?.promptCapabilities?.image ?? false;

  const eventsQuery = useQuery(
    trpc.sessions.getSessionEvents.queryOptions({ sessionId }),
  );

  const approvalsQuery = useQuery(trpc.approvals.list.queryOptions());

  // Derive pendingApproval: query data is the authority, optimistic state
  // provides instant display from SSE before the query refetches.
  const queryApproval = approvalsQuery.data?.find(
    (a) => a.sessionId === sessionId,
  );
  const pendingApproval = queryApproval ?? optimisticApproval ?? null;

  // Keep eventsRef in sync for use in scroll handler
  eventsRef.current = events;

  // Load event history on mount and scroll to bottom
  useEffect(() => {
    if (
      eventsQuery.data &&
      eventsQuery.data.length > 0 &&
      events.length === 0
    ) {
      setEvents(
        eventsQuery.data.map((e) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        })),
      );
      // Scroll to bottom on initial load
      if (!initialScrollDone.current) {
        initialScrollDone.current = true;
        requestAnimationFrame(() => {
          logsEndRef.current?.scrollIntoView({ behavior: "instant" });
        });
      }
    }
  }, [eventsQuery.data, events.length]);

  // Track scroll position — callback ref attaches/detaches the listener
  // when the DOM element mounts/unmounts (survives conditional rendering).
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const logContainerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Detach previous listener
    if (scrollCleanupRef.current) {
      scrollCleanupRef.current();
      scrollCleanupRef.current = null;
    }

    logContainerRef.current = node;
    if (!node) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = node;
        const nearBottom =
          scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD;
        isNearBottomRef.current = nearBottom;

        // Show scroll button when user is away from bottom
        setShowScrollButton(!nearBottom && eventsRef.current.length > 0);

        // Auto-pause when user scrolls away from bottom
        if (!nearBottom && autoScrollRef.current) {
          autoScrollRef.current = false;
          setAutoScroll(false);
        }
        // Re-engage when user scrolls back to bottom
        if (nearBottom && !autoScrollRef.current) {
          autoScrollRef.current = true;
          setAutoScroll(true);
        }

        ticking = false;
      });
    };

    node.addEventListener("scroll", handleScroll, { passive: true });
    scrollCleanupRef.current = () =>
      node.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-scroll — reads from refs to avoid closure/re-render issues
  // ---------------------------------------------------------------------------

  const scheduleScroll = () => {
    if (!autoScrollRef.current || !logsEndRef.current) return;
    if (scrollScheduledRef.current) return;

    scrollScheduledRef.current = true;
    requestAnimationFrame(() => {
      scrollScheduledRef.current = false;
      if (!autoScrollRef.current || !logsEndRef.current) return;

      // Use instant scroll during rapid streaming to prevent jitter
      const now = Date.now();
      const timeSinceLastEvent = now - lastEventTimeRef.current;
      const behavior = timeSinceLastEvent < 150 ? "instant" : "smooth";

      logsEndRef.current.scrollIntoView({ behavior });
    });
  };

  const manualScrollToBottom = () => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // Re-engage auto-scroll
    autoScrollRef.current = true;
    setAutoScroll(true);
  };

  // ---------------------------------------------------------------------------
  // SSE event handling with merge logic
  // ---------------------------------------------------------------------------

  const handleEvent = (event: AgentEvent) => {
    // Mode-change events are internal signals — trigger a session re-fetch
    // but don't add them to the visible event log
    if (event.type === "mode-change") {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
      });
      return;
    }

    setEvents((prev) => {
      // Try to merge consecutive message/thinking chunks
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const lastPayload = last.payload as Record<string, unknown>;
        const newPayload = event.payload as Record<string, unknown>;

        const lastIsUser = lastPayload.isUser === true;
        const newIsUser = newPayload.isUser === true;
        const canMerge =
          last.type === event.type &&
          (event.type === "message" || event.type === "thinking") &&
          last.sessionId === event.sessionId &&
          lastIsUser === newIsUser;

        if (canMerge) {
          const lastContent = extractContent(lastPayload);
          const newContent = extractContent(newPayload);
          const merged = {
            ...last,
            payload: { ...lastPayload, content: lastContent + newContent },
            timestamp: event.timestamp,
          };
          return [...prev.slice(0, -1), merged];
        }
      }
      return [...prev, event];
    });

    lastEventTimeRef.current = Date.now();
    scheduleScroll();

    if (event.type === "complete" || event.type === "error") {
      setOptimisticApproval(null);
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
      });
    }
  };

  const handleApproval = (approval: ApprovalRequest) => {
    // Optimistic: show the banner immediately before query refetches
    setOptimisticApproval(approval);
    queryClient.invalidateQueries({
      queryKey: trpc.approvals.list.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
    });
  };

  // Connect SSE immediately — sessionId is known from the URL, no need to
  // wait for the session query.  Gating on `!!session` created a window where
  // approval events could arrive after the query resolved but before the
  // EventSource was established, causing missed banners.
  const { connected } = useAgentEvents({
    sessionId,
    onEvent: handleEvent,
    onApproval: handleApproval,
  });

  // When the SSE connection (re)establishes, refetch approvals to pick up
  // any that arrived during the connection gap (e.g. page navigation).
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !prevConnectedRef.current) {
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.list.queryKey(),
      });
    }
    prevConnectedRef.current = connected;
  }, [connected, queryClient, trpc.approvals.list]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  // Shared handler: optimistically dismiss the banner, then refetch
  const onApprovalResolved = (approvalId: string) => {
    setOptimisticApproval(null);
    // Optimistically remove from cache so banner disappears instantly
    // (before the refetch round-trip completes)
    queryClient.setQueryData(
      trpc.approvals.list.queryKey(),
      (old: ApprovalRequest[] | undefined) =>
        old?.filter((a) => a.id !== approvalId),
    );
    queryClient.invalidateQueries({
      queryKey: trpc.approvals.list.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
    });
  };

  const approveMutation = useMutation(
    trpc.approvals.approve.mutationOptions({
      onSuccess: (_data, variables) => {
        onApprovalResolved(variables.approvalId);
      },
    }),
  );

  const denyMutation = useMutation(
    trpc.approvals.deny.mutationOptions({
      onSuccess: (_data, variables) => {
        onApprovalResolved(variables.approvalId);
      },
    }),
  );

  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  const killSessionMutation = useMutation(
    trpc.sessions.killSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const completeSessionMutation = useMutation(
    trpc.sessions.completeSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const renameSessionMutation = useMutation(
    trpc.sessions.renameSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const setModeMutation = useMutation(
    trpc.sessions.setMode.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  const reconnectMutation = useMutation(
    trpc.sessions.reconnectSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listClients.queryKey(),
        });
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.sessions.deleteSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Action callbacks
  // ---------------------------------------------------------------------------

  const sendMessage = (message: string, images?: ImageAttachment[]) => {
    const contentBlocks = images?.map((img) => ({
      type: "image" as const,
      data: img.base64,
      mimeType: img.mimeType,
    }));
    sendMessageMutation.mutate({ sessionId, message, contentBlocks });

    // Re-engage auto-scroll and jump to bottom so the user sees the response
    autoScrollRef.current = true;
    setAutoScroll(true);
    requestAnimationFrame(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const approve = (approvalId: string, optionId: string) =>
    approveMutation.mutate({ approvalId, optionId });

  const deny = (approvalId: string) => denyMutation.mutate({ approvalId });

  const killSession = () => killSessionMutation.mutate({ sessionId });

  const completeSession = () => completeSessionMutation.mutate({ sessionId });

  const renameSession = (name: string) =>
    renameSessionMutation.mutate({ sessionId, name });

  const setMode = (modeId: string) =>
    setModeMutation.mutate({ sessionId, modeId });

  const reconnect = () => reconnectMutation.mutate({ sessionId });

  const deleteSession = () => deleteMutation.mutate({ sessionId });

  const clearLogs = () => setEvents([]);

  const toggleAutoScroll = () => {
    setAutoScroll((prev) => {
      const next = !prev;
      autoScrollRef.current = next;
      // When re-enabling, immediately scroll to bottom
      if (next) {
        requestAnimationFrame(() => {
          logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Derived: latest plan entries
  // ---------------------------------------------------------------------------

  let latestPlan: PlanPayload | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "plan") {
      latestPlan = events[i].payload as PlanPayload;
      break;
    }
  }

  const toggleTaskPanel = () => setTaskPanelCollapsed((prev) => !prev);

  // ---------------------------------------------------------------------------
  // Return value
  // ---------------------------------------------------------------------------

  return {
    // Data
    session,
    events,
    pendingApproval,
    connected,
    autoScroll,
    showScrollButton,
    supportsImages,
    latestPlan,
    taskPanelCollapsed,
    logsEndRef,
    logContainerRef: logContainerCallbackRef,

    // Loading states
    isLoading: sessionQuery.isLoading,
    isAgentBusy: session?.status === "running",
    isKilling: killSessionMutation.isPending,
    isCompleting: completeSessionMutation.isPending,
    isRenaming: renameSessionMutation.isPending,
    isApproving: approveMutation.isPending,
    isDenying: denyMutation.isPending,
    isSettingMode: setModeMutation.isPending,
    isReconnecting: reconnectMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Actions
    sendMessage,
    approve,
    deny,
    killSession,
    completeSession,
    renameSession,
    setMode,
    reconnect,
    deleteSession,
    clearLogs,
    toggleAutoScroll,
    toggleTaskPanel,
    manualScrollToBottom,
  };
}
