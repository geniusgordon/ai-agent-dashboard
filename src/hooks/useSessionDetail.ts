/**
 * Custom hook encapsulating all session detail orchestration:
 * queries, mutations, SSE subscription, and event merge logic.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageAttachment } from "@/components/dashboard";
import { useTRPC } from "@/integrations/trpc/react";
import { extractContent } from "@/lib/agents/event-utils";
import type { AgentEvent, ApprovalRequest } from "@/lib/agents/types";
import { useAgentEvents } from "./useAgentEvents";

export function useSessionDetail(sessionId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(null);
  const initialScrollDone = useRef(false);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const sessionQuery = useQuery(
    trpc.sessions.getSession.queryOptions({ sessionId }),
  );
  const session = sessionQuery.data;

  // Get client to check capabilities
  const clientQuery = useQuery({
    ...trpc.sessions.getClient.queryOptions({ clientId: session?.clientId ?? "" }),
    enabled: !!session?.clientId,
  });
  const client = clientQuery.data;
  const supportsImages = client?.capabilities?.promptCapabilities?.image ?? false;

  const eventsQuery = useQuery(
    trpc.sessions.getSessionEvents.queryOptions({ sessionId }),
  );

  const approvalsQuery = useQuery(trpc.approvals.list.queryOptions());

  // Load pending approval on mount
  useEffect(() => {
    if (approvalsQuery.data) {
      const approval = approvalsQuery.data.find(
        (a) => a.sessionId === sessionId,
      );
      if (approval && !pendingApproval) {
        setPendingApproval(approval);
      }
    }
  }, [approvalsQuery.data, sessionId, pendingApproval]);

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

  // Track scroll position to detect if user is near bottom
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsNearBottom(nearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------

  const scrollToBottom = useCallback(() => {
    // Only auto-scroll if user is near bottom AND autoScroll is enabled
    if (autoScroll && isNearBottom && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll, isNearBottom]);

  // ---------------------------------------------------------------------------
  // SSE event handling with merge logic
  // ---------------------------------------------------------------------------

  const handleEvent = useCallback(
    (event: AgentEvent) => {
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

      requestAnimationFrame(scrollToBottom);

      if (event.type === "complete" || event.type === "error") {
        setPendingApproval(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      }
    },
    [queryClient, sessionId, trpc.sessions.getSession, scrollToBottom],
  );

  const handleApproval = useCallback(
    (approval: ApprovalRequest) => {
      setPendingApproval(approval);
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
      });
    },
    [queryClient, sessionId, trpc.sessions.getSession],
  );

  const { connected } = useAgentEvents({
    sessionId,
    onEvent: handleEvent,
    onApproval: handleApproval,
    enabled: !!session,
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const approveMutation = useMutation(
    trpc.approvals.approve.mutationOptions({
      onSuccess: () => {
        setPendingApproval(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
        });
      },
    }),
  );

  const denyMutation = useMutation(
    trpc.approvals.deny.mutationOptions({
      onSuccess: () => {
        setPendingApproval(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
        });
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
  };

  const approve = (approvalId: string, optionId: string) =>
    approveMutation.mutate({ approvalId, optionId });

  const deny = (approvalId: string) => denyMutation.mutate({ approvalId });

  const killSession = () => killSessionMutation.mutate({ sessionId });

  const renameSession = (name: string) =>
    renameSessionMutation.mutate({ sessionId, name });

  const setMode = (modeId: string) =>
    setModeMutation.mutate({ sessionId, modeId });

  const reconnect = () => reconnectMutation.mutate({ sessionId });

  const deleteSession = () => deleteMutation.mutate({ sessionId });

  const clearLogs = () => setEvents([]);

  const toggleAutoScroll = () => setAutoScroll((prev) => !prev);

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
    supportsImages,
    logsEndRef,
    logContainerRef,

    // Loading states
    isLoading: sessionQuery.isLoading,
    isAgentBusy: session?.status === "running",
    isKilling: killSessionMutation.isPending,
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
    renameSession,
    setMode,
    reconnect,
    deleteSession,
    clearLogs,
    toggleAutoScroll,
  };
}
