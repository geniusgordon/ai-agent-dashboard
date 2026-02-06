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

      // Refresh session status when complete or error
      if (event.type === "complete" || event.type === "error") {
        setPendingApproval(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }),
        });
      }
    },
    [queryClient, sessionId, trpc.sessions.getSession],
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  const handleSendMessage = (e: React.FormEvent) => {
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
    <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <Link
            to="/dashboard/sessions"
            className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="size-4 sm:size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <AgentBadge type={session.agentType} size="sm" />
              <StatusBadge status={session.status} />
              {connected ? (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                  </span>
                  Live
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
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
                className="flex items-center gap-2 mt-1"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-2 py-1 text-sm bg-card border border-input rounded text-foreground"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-xs text-green-400 hover:text-green-300"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p
                className="font-mono text-sm text-muted-foreground mt-1 cursor-pointer hover:text-foreground inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditName(session.name || "");
                  setIsEditingName(true);
                }}
                title="Click to rename"
              >
                {session.name || session.id.slice(0, 8)}
                <Pencil className="size-3 text-muted-foreground/50" />
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setEvents([])}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1.5"
            title="Clear logs"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`
              p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm transition-colors cursor-pointer inline-flex items-center gap-1.5
              ${
                autoScroll
                  ? "bg-green-500/20 text-green-400"
                  : "bg-secondary/50 text-muted-foreground"
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
              Auto-scroll {autoScroll ? "ON" : "OFF"}
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
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
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
        <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="size-5 text-amber-400 animate-pulse" />
                <span className="font-medium text-amber-200">
                  {pendingApproval.toolCall.title}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Kind: {pendingApproval.toolCall.kind}
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
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
                      disabled:opacity-50
                      ${
                        isDeny
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : isAllow
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
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
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background/50 font-mono text-sm relative">
        {/* Sticky log header */}
        <div className="sticky top-0 z-10 px-4 py-2 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Session Log
          </span>
          <span className="text-xs text-muted-foreground">
            {events.length} events
          </span>
        </div>

        <div className="p-4">
          {events.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              <MessageSquare className="size-8 mx-auto mb-3 text-muted-foreground/50" />
              <p>No messages yet.</p>
              <p className="text-xs mt-2">
                Send a message below to start the conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
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
          <form onSubmit={handleSendMessage} className="mt-2 sm:mt-4 shrink-0">
            <div className="flex gap-2 p-2 rounded-xl border border-border bg-card">
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
                  flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base
                  bg-transparent border-none
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
                  px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base
                  bg-green-600 text-white
                  hover:bg-green-500 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
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
    ? { icon: User, color: "text-cyan-400", borderColor: "border-l-primary" }
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
        flex gap-2 py-2 px-3 rounded-lg border-l-2
        ${config.borderColor}
        ${isUser ? "bg-primary/5" : isError ? "bg-destructive/5" : ""}
        ${isThinking ? "opacity-80" : ""}
        ${config.color}
      `}
    >
      <span className="shrink-0 text-muted-foreground text-xs font-mono w-16 pt-0.5">
        {formatTime(event.timestamp)}
      </span>
      <Icon className="size-4 shrink-0 mt-0.5" />
      <span className="whitespace-pre-wrap break-words flex-1">{content}</span>
    </div>
  );
}
