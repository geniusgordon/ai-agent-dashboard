/**
 * Session Detail Page - Live Streaming Logs
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Loader2,
  MessageSquare,
  Pause,
  Pencil,
  Send,
  Square,
  Trash2,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentBadge, StatusBadge } from "../../../components/dashboard";
import { useAgentEvents } from "../../../hooks/useAgentEvents";
import { useTRPC } from "../../../integrations/trpc/react";
import type { AgentEvent, ApprovalRequest } from "../../../lib/agents/types";

export const Route = createFileRoute("/dashboard/sessions/$sessionId")({
  component: SessionDetailPage,
});

// Helper to extract content from various payload formats
function extractContent(payload: Record<string, unknown>): string {
  if (typeof payload.content === "string") {
    return payload.content;
  }
  if (typeof payload.content === "object" && payload.content !== null) {
    const nested = payload.content as Record<string, unknown>;
    return (nested.text as string) ?? "";
  }
  return "";
}

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  // Query pending approvals for this session
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

  // Query session
  const sessionQuery = useQuery(
    trpc.sessions.getSession.queryOptions({ sessionId }),
  );
  const session = sessionQuery.data;

  // Query event history
  const eventsQuery = useQuery(
    trpc.sessions.getSessionEvents.queryOptions({ sessionId }),
  );

  // Load history on mount
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
    }
  }, [eventsQuery.data, events.length]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  // Handle incoming events - merge consecutive message chunks
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      setEvents((prev) => {
        // Try to merge with last event if both are message/thinking chunks
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const lastPayload = last.payload as Record<string, unknown>;
          const newPayload = event.payload as Record<string, unknown>;

          // Only merge if same type, same session, and same sender (user vs agent)
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

      // Auto-scroll on new events
      requestAnimationFrame(scrollToBottom);

      // Refresh session status when complete or error
      if (event.type === "complete" || event.type === "error") {
        setPendingApproval(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      }
    },
    [queryClient, sessionId, trpc.sessions.getSession, scrollToBottom],
  );

  // Handle approval requests
  const handleApproval = useCallback(
    (approval: ApprovalRequest) => {
      setPendingApproval(approval);
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
      });
    },
    [queryClient, sessionId, trpc.sessions.getSession],
  );

  // Subscribe to real-time events
  const { connected } = useAgentEvents({
    sessionId,
    onEvent: handleEvent,
    onApproval: handleApproval,
    enabled: !!session,
  });

  // Approval mutations
  const approveMutation = useMutation(
    trpc.approvals.approve.mutationOptions({
      onMutate: () => {
        setPendingApproval(null);
      },
      onSuccess: () => {
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
      onMutate: () => {
        setPendingApproval(null);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
        });
      },
    }),
  );

  // Send message mutation
  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      },
    }),
  );

  // Kill session mutation
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

  // Rename session mutation
  const renameSessionMutation = useMutation(
    trpc.sessions.renameSession.mutationOptions({
      onSuccess: () => {
        setIsEditingName(false);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const handleSendMessage = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Add user message to events immediately
    setEvents((prev) => [
      ...prev,
      {
        type: "message" as const,
        clientId: session?.clientId ?? "",
        sessionId,
        timestamp: new Date(),
        payload: { content: inputMessage, isUser: true },
      },
    ]);

    sendMessageMutation.mutate({ sessionId, message: inputMessage });
    setInputMessage("");
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="size-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">Session not found</p>
        <p className="text-sm text-muted-foreground font-mono">{sessionId}</p>
        <Link
          to="/dashboard/sessions"
          className="mt-4 inline-flex items-center gap-1.5 text-primary hover:text-primary/80"
        >
          <ArrowLeft className="size-4" />
          Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem-2rem)] sm:h-[calc(100vh-3.5rem-3rem)] lg:h-[calc(100vh-3.5rem-4rem)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            to="/dashboard/sessions"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200 cursor-pointer shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <AgentBadge type={session.agentType} size="sm" />
              <StatusBadge status={session.status} />
              {connected ? (
                <span
                  className="text-xs font-medium text-green-400 flex items-center gap-1.5"
                  style={{ textShadow: "0 0 8px rgba(74, 222, 128, 0.5)" }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                  </span>
                  Live
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Connecting
                </span>
              )}
            </div>
            {/* Editable Session Name */}
            {isEditingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  renameSessionMutation.mutate({ sessionId, name: editName });
                }}
                className="flex items-center gap-2 mt-1.5"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-2.5 py-1 text-sm bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow duration-200"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-xs font-medium text-green-400 hover:text-green-300 transition-colors duration-200 cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="font-mono text-sm text-muted-foreground mt-1 cursor-pointer hover:text-foreground inline-flex items-center gap-1.5 transition-colors duration-200"
                onClick={() => {
                  setEditName(session.name || "");
                  setIsEditingName(true);
                }}
                title="Click to rename"
              >
                {session.name || session.id.slice(0, 8)}
                <Pencil className="size-3 text-muted-foreground/50" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEvents([])}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5"
            title="Clear logs"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`
              p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5
              ${
                autoScroll
                  ? "bg-green-500/20 text-green-400"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }
            `}
            title={`Auto-scroll ${autoScroll ? "ON" : "OFF"}`}
          >
            {autoScroll ? (
              <ArrowDownToLine className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {autoScroll ? "Auto-scroll" : "Paused"}
            </span>
          </button>
          {session.status !== "completed" && session.status !== "killed" && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Kill this session?")) {
                  killSessionMutation.mutate({ sessionId });
                }
              }}
              disabled={killSessionMutation.isPending}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              title="Kill session"
            >
              <Square className="size-3.5" />
              <span className="hidden sm:inline">
                {killSessionMutation.isPending ? "Killing..." : "Kill"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Pending Approval Banner */}
      {pendingApproval && (
        <div className="p-3 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="size-4 text-amber-400 animate-pulse shrink-0" />
                <span className="font-semibold text-sm text-amber-200 break-words">
                  {pendingApproval.toolCall.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {pendingApproval.toolCall.kind}
              </p>
            </div>
            <div className="flex gap-2">
              {pendingApproval.options.map((option) => {
                const isAllow = option.kind.includes("allow");
                const isDeny = option.kind === "deny";
                return (
                  <button
                    key={option.optionId}
                    type="button"
                    onClick={() =>
                      isDeny
                        ? denyMutation.mutate({
                            approvalId: pendingApproval.id,
                          })
                        : approveMutation.mutate({
                            approvalId: pendingApproval.id,
                            optionId: option.optionId,
                          })
                    }
                    disabled={
                      approveMutation.isPending || denyMutation.isPending
                    }
                    className={`
                      flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                      disabled:opacity-50
                      ${
                        isDeny
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : isAllow
                            ? "bg-green-600 text-white hover:bg-green-500"
                            : "bg-secondary text-foreground hover:bg-secondary/80"
                      }
                    `}
                  >
                    {option.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background/50 font-mono text-sm relative shadow-lg">
        {/* Sticky log header */}
        <div className="sticky top-0 z-10 px-4 py-2.5 bg-background/90 backdrop-blur-md border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Session Log
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {events.length} events
          </span>
        </div>

        <div className="p-3">
          {events.length === 0 ? (
            <div className="text-muted-foreground text-center py-16">
              <MessageSquare className="size-10 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1.5 text-muted-foreground/70">
                Send a message below to start the conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {events.map((event, i) => (
                <LogEntry
                  key={`${event.timestamp.toString()}-${i}`}
                  event={event}
                />
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {session.status !== "completed" &&
        session.status !== "killed" &&
        session.status !== "error" && (
          <form onSubmit={handleSendMessage} className="shrink-0">
            <div className="flex gap-2 p-2 rounded-xl border border-border bg-card shadow-md">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  pendingApproval
                    ? "Waiting for approval..."
                    : "Send a message..."
                }
                disabled={sendMessageMutation.isPending || !!pendingApproval}
                className="
                  flex-1 px-4 py-2.5 rounded-lg text-sm
                  bg-transparent border-none font-sans
                  text-foreground placeholder-muted-foreground
                  focus:outline-none
                  disabled:opacity-50
                "
              />
              <button
                type="submit"
                disabled={
                  !inputMessage.trim() ||
                  sendMessageMutation.isPending ||
                  !!pendingApproval
                }
                className="
                  px-5 py-2.5 rounded-lg font-semibold text-sm
                  bg-green-600 text-white
                  hover:bg-green-500 hover:-translate-y-px
                  active:translate-y-0
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  cursor-pointer shrink-0 inline-flex items-center gap-2
                "
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </form>
        )}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const eventConfig: Record<
  string,
  { icon: typeof Brain; color: string; borderColor: string }
> = {
  thinking: {
    icon: Brain,
    color: "text-purple-400",
    borderColor: "border-l-purple-500/50",
  },
  message: {
    icon: MessageSquare,
    color: "text-foreground",
    borderColor: "border-l-blue-500/50",
  },
  "tool-call": {
    icon: Wrench,
    color: "text-blue-400",
    borderColor: "border-l-blue-500/50",
  },
  "tool-update": {
    icon: Wrench,
    color: "text-blue-300",
    borderColor: "border-l-blue-500/50",
  },
  plan: {
    icon: ClipboardList,
    color: "text-yellow-400",
    borderColor: "border-l-yellow-500/50",
  },
  complete: {
    icon: CheckCircle2,
    color: "text-green-400",
    borderColor: "border-l-green-500/50",
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    borderColor: "border-l-red-500/50",
  },
};

const defaultConfig = {
  icon: Inbox,
  color: "text-muted-foreground",
  borderColor: "border-l-border",
};

function LogEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const isUser = payload.isUser === true;

  const config = isUser
    ? {
        icon: User,
        color: "text-cyan-400",
        borderColor: "border-l-cyan-500/60",
      }
    : (eventConfig[event.type] ?? defaultConfig);

  const isThinking = event.type === "thinking";
  const isError = event.type === "error";

  // Extract content
  let content: string;
  if (typeof payload.content === "string") {
    content = payload.content;
  } else if (typeof payload.content === "object" && payload.content !== null) {
    const nested = payload.content as Record<string, unknown>;
    content = (nested.text as string) ?? JSON.stringify(nested);
  } else if (typeof payload.stopReason === "string") {
    content = payload.stopReason;
  } else if (typeof payload.message === "string") {
    content = payload.message;
  } else {
    content = JSON.stringify(payload);
  }

  const Icon = config.icon;

  return (
    <div
      className={`
        group flex gap-2.5 py-2 px-3 rounded-md border-l-2
        transition-colors duration-200
        hover:bg-accent/50
        ${config.borderColor}
        ${isUser ? "bg-primary/5" : isError ? "bg-destructive/5" : ""}
        ${isThinking ? "opacity-70 italic" : ""}
        ${config.color}
      `}
    >
      <span className="shrink-0 text-muted-foreground/70 text-[11px] tabular-nums w-[4.5rem] pt-0.5 select-none">
        {formatTime(event.timestamp)}
      </span>
      <Icon className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      <span className="whitespace-pre-wrap break-words flex-1 text-[13px] leading-relaxed">
        {content}
      </span>
    </div>
  );
}
