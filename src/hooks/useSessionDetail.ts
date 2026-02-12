/**
 * Custom hook encapsulating all session detail orchestration:
 * queries, mutations, SSE subscription, and event merge logic.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ImageAttachment } from "@/components/dashboard";
import type { SessionLogScrollHandle } from "@/components/dashboard/SessionLog";
import { useTRPC } from "@/integrations/trpc/react";
import { extractContent, extractPlanFilePath } from "@/lib/agents/event-utils";
import type {
  AgentEvent,
  ApprovalRequest,
  CommandsUpdatePayload,
  PlanPayload,
  UsageUpdatePayload,
} from "@/lib/agents/types";
import { useAgentEvents } from "./useAgentEvents";

const NEAR_BOTTOM_THRESHOLD = 100;

export function useSessionDetail(sessionId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const scrollRef = useRef<SessionLogScrollHandle>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
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
  /** Track toolCallIds for plan file writes so we can invalidate on completion */
  const planWriteToolCallIds = useRef(new Set<string>());

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

  // Load event history from query data on mount AND after SSE-reconnection
  // invalidation.  We track `dataUpdatedAt` so that when the query refetches
  // (e.g. after navigating back to this page) we always pick up the latest
  // server-side snapshot — even if local events already exist.
  const lastDataUpdatedAtRef = useRef(0);
  useEffect(() => {
    if (!eventsQuery.data || eventsQuery.data.length === 0) return;
    const isNewData =
      eventsQuery.dataUpdatedAt !== lastDataUpdatedAtRef.current;
    if (events.length === 0 || isNewData) {
      lastDataUpdatedAtRef.current = eventsQuery.dataUpdatedAt;
      setEvents(
        eventsQuery.data.map((e) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        })),
      );
    }
    // Scroll to bottom on initial load
    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToBottom("auto");
      });
    }
  }, [eventsQuery.data, eventsQuery.dataUpdatedAt, events.length]);

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
        }
        // Re-engage when user scrolls back to bottom
        if (nearBottom && !autoScrollRef.current) {
          autoScrollRef.current = true;
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
    if (!autoScrollRef.current || !scrollRef.current) return;
    if (scrollScheduledRef.current) return;

    scrollScheduledRef.current = true;
    // Double-rAF: the first rAF fires before React paints the new state,
    // the second fires after the DOM has been updated with the new event.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollScheduledRef.current = false;
        if (!autoScrollRef.current || !scrollRef.current) return;

        // Use auto (instant) scroll during rapid streaming to prevent jitter
        const now = Date.now();
        const timeSinceLastEvent = now - lastEventTimeRef.current;
        const behavior = timeSinceLastEvent < 150 ? "auto" : "smooth";

        scrollRef.current.scrollToBottom(behavior);
      });
    });
  };

  const manualScrollToBottom = () => {
    scrollRef.current?.scrollToBottom("smooth");
    // Re-engage auto-scroll
    autoScrollRef.current = true;
  };

  // ---------------------------------------------------------------------------
  // SSE event handling with merge logic
  // ---------------------------------------------------------------------------

  const handleEvent = (event: AgentEvent) => {
    // Mode/config-change events are internal signals — trigger a session re-fetch
    // but don't add them to the visible event log
    if (event.type === "mode-change" || event.type === "config-update") {
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

    // Track plan file writes so we can refetch plan content on completion
    if (event.type === "tool-call") {
      const tcPayload = event.payload as Record<string, unknown>;
      if (
        typeof tcPayload.title === "string" &&
        /\.claude\/plans\/.*\.md$/.test(tcPayload.title)
      ) {
        planWriteToolCallIds.current.add(tcPayload.toolCallId as string);
      }
    }
    if (event.type === "tool-update") {
      const tuPayload = event.payload as Record<string, unknown>;
      const toolCallId = tuPayload.toolCallId as string;
      if (
        tuPayload.status === "completed" &&
        planWriteToolCallIds.current.has(toolCallId)
      ) {
        planWriteToolCallIds.current.delete(toolCallId);
        queryClient.invalidateQueries({
          queryKey: [["sessions", "readPlanFile"]],
        });
      }
    }

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

  // When the SSE connection (re)establishes, refetch events and approvals to
  // pick up any that arrived during the connection gap (e.g. page navigation).
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !prevConnectedRef.current) {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.getSessionEvents.queryKey({ sessionId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.list.queryKey(),
      });
    }
    prevConnectedRef.current = connected;
  }, [
    connected,
    queryClient,
    trpc.sessions.getSessionEvents,
    trpc.approvals.list,
    sessionId,
  ]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  // Shared handler: optimistically dismiss the banner, then refetch
  const onApprovalResolved = (approvalId: string) => {
    setOptimisticApproval(null);
    // Optimistically remove from cache so banner disappears instantly
    // (before the refetch round-trip completes)
    queryClient.setQueryData(trpc.approvals.list.queryKey(), (old) =>
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

  const setModelMutation = useMutation(
    trpc.sessions.setModel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  const setThoughtLevelMutation = useMutation(
    trpc.sessions.setThoughtLevel.mutationOptions({
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

  const cancelSessionMutation = useMutation(
    trpc.sessions.cancelSession.mutationOptions({
      onSuccess: () => {
        setOptimisticApproval(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
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

  // Git action mutations
  const pushToOriginMutation = useMutation(
    trpc.sessions.pushToOrigin.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [["sessions", "getGitInfo"]],
        });
        toast.success("Pushed to origin");
      },
      onError: (error) => {
        toast.error("Push failed", {
          description: error.message,
        });
      },
    }),
  );

  const sendCommitPromptMutation = useMutation(
    trpc.sessions.sendCommitPrompt.mutationOptions({
      onSuccess: () => {
        autoScrollRef.current = true;
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  const sendMergePromptMutation = useMutation(
    trpc.sessions.sendMergePrompt.mutationOptions({
      onSuccess: () => {
        autoScrollRef.current = true;
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  const sendPRPromptMutation = useMutation(
    trpc.sessions.sendPRPrompt.mutationOptions({
      onSuccess: () => {
        autoScrollRef.current = true;
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  // Reset all local + mutation state when switching sessions so spinners,
  // banners, and other transient UI from Session A don't leak into Session B.
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      setEvents([]);
      setOptimisticApproval(null);
      autoScrollRef.current = true;
      setShowScrollButton(false);
      initialScrollDone.current = false;
      planWriteToolCallIds.current.clear();
      reconnectMutation.reset();
      cancelSessionMutation.reset();
      killSessionMutation.reset();
      completeSessionMutation.reset();
      renameSessionMutation.reset();
      setModeMutation.reset();
      setModelMutation.reset();
      setThoughtLevelMutation.reset();
      approveMutation.reset();
      denyMutation.reset();
      pushToOriginMutation.reset();
      sendCommitPromptMutation.reset();
      sendMergePromptMutation.reset();
      sendPRPromptMutation.reset();
    }
  }, [
    sessionId,
    reconnectMutation,
    cancelSessionMutation,
    killSessionMutation,
    completeSessionMutation,
    renameSessionMutation,
    setModeMutation,
    setModelMutation,
    setThoughtLevelMutation,
    approveMutation,
    denyMutation,
    pushToOriginMutation,
    sendCommitPromptMutation,
    sendMergePromptMutation,
    sendPRPromptMutation,
  ]);

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

    // Re-engage auto-scroll so the incoming SSE echo of this message
    // (and the subsequent agent response) will auto-scroll via scheduleScroll.
    autoScrollRef.current = true;
  };

  const approve = (approvalId: string, optionId: string) =>
    approveMutation.mutate({ approvalId, optionId });

  const deny = (approvalId: string) => denyMutation.mutate({ approvalId });

  const cancelSession = () => cancelSessionMutation.mutate({ sessionId });

  const killSession = () => killSessionMutation.mutate({ sessionId });

  const completeSession = () => completeSessionMutation.mutate({ sessionId });

  const renameSession = (name: string) =>
    renameSessionMutation.mutate({ sessionId, name });

  const setMode = (modeId: string) =>
    setModeMutation.mutate({ sessionId, modeId });

  const setModel = (model: string) =>
    setModelMutation.mutate({ sessionId, model });

  const setThoughtLevel = (thoughtLevel: string) =>
    setThoughtLevelMutation.mutate({ sessionId, thoughtLevel });

  const reconnect = () => reconnectMutation.mutate({ sessionId });

  const deleteSession = () => deleteMutation.mutate({ sessionId });

  const pushToOrigin = () =>
    pushToOriginMutation.mutate({ sessionId, setUpstream: true });

  const sendCommitPrompt = () => sendCommitPromptMutation.mutate({ sessionId });

  const sendMergePrompt = (targetBranch: string) =>
    sendMergePromptMutation.mutate({ sessionId, targetBranch });

  const sendPRPrompt = (baseBranch: string) =>
    sendPRPromptMutation.mutate({ sessionId, baseBranch });

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

  // Derived: plan document file path (from tool-call events)
  const planFilePath = extractPlanFilePath(events);

  // Derived: latest usage info + available commands (single reverse pass)
  let usageInfo: UsageUpdatePayload | undefined =
    session?.usageInfo ?? undefined;
  let availableCommands = session?.availableCommands;
  let foundUsage = false;
  let foundCommands = false;
  for (let i = events.length - 1; i >= 0; i--) {
    if (!foundUsage && events[i].type === "usage-update") {
      const p = events[i].payload as UsageUpdatePayload;
      // Only use session-level usage (has size > 0), not per-turn
      if (p.size > 0) {
        usageInfo = p;
        foundUsage = true;
      }
    }
    if (!foundCommands && events[i].type === "commands-update") {
      availableCommands = (events[i].payload as CommandsUpdatePayload).commands;
      foundCommands = true;
    }
    if (foundUsage && foundCommands) break;
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
    showScrollButton,
    supportsImages,
    latestPlan,
    planFilePath,
    usageInfo,
    availableCommands,
    taskPanelCollapsed,
    scrollRef,
    logContainerRef: logContainerCallbackRef,

    // Loading states
    isLoading: sessionQuery.isLoading,
    isAgentBusy: session?.status === "running",
    isCancelling: cancelSessionMutation.isPending,
    isKilling: killSessionMutation.isPending,
    isCompleting: completeSessionMutation.isPending,
    isRenaming: renameSessionMutation.isPending,
    isApproving: approveMutation.isPending,
    isDenying: denyMutation.isPending,
    isSettingMode: setModeMutation.isPending,
    isSettingModel: setModelMutation.isPending,
    isSettingThoughtLevel: setThoughtLevelMutation.isPending,
    isReconnecting: reconnectMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isPushing: pushToOriginMutation.isPending,
    isSendingCommit: sendCommitPromptMutation.isPending,
    isSendingMerge: sendMergePromptMutation.isPending,
    isSendingPR: sendPRPromptMutation.isPending,

    // Actions
    sendMessage,
    approve,
    deny,
    cancelSession,
    killSession,
    completeSession,
    renameSession,
    setMode,
    setModel,
    setThoughtLevel,
    reconnect,
    deleteSession,
    pushToOrigin,
    sendCommitPrompt,
    sendMergePrompt,
    sendPRPrompt,
    toggleTaskPanel,
    manualScrollToBottom,
  };
}
