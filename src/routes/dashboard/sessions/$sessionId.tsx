/**
 * Session Detail Page - Live Streaming Logs
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../../integrations/trpc/react";
import { useAgentEvents } from "../../../hooks/useAgentEvents";
import { AgentBadge, StatusBadge } from "../../../components/dashboard";
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
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);

  // Query pending approvals for this session
  const approvalsQuery = useQuery(trpc.approvals.list.queryOptions());

  // Load pending approval on mount
  useEffect(() => {
    if (approvalsQuery.data) {
      const approval = approvalsQuery.data.find(a => a.sessionId === sessionId);
      if (approval && !pendingApproval) {
        setPendingApproval(approval);
      }
    }
  }, [approvalsQuery.data, sessionId, pendingApproval]);

  // Query session
  const sessionQuery = useQuery(
    trpc.sessions.getSession.queryOptions({ sessionId })
  );
  const session = sessionQuery.data;

  // Query event history
  const eventsQuery = useQuery(
    trpc.sessions.getSessionEvents.queryOptions({ sessionId })
  );

  // Load history on mount
  useEffect(() => {
    if (eventsQuery.data && eventsQuery.data.length > 0 && events.length === 0) {
      setEvents(eventsQuery.data.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })));
    }
  }, [eventsQuery.data]);

  // Handle incoming events - merge consecutive message chunks
  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => {
      // Try to merge with last event if both are message/thinking chunks
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const canMerge = 
          last.type === event.type && 
          (event.type === "message" || event.type === "thinking") &&
          last.sessionId === event.sessionId;
        
        if (canMerge) {
          const lastPayload = last.payload as Record<string, unknown>;
          const newPayload = event.payload as Record<string, unknown>;
          const lastContent = extractContent(lastPayload);
          const newContent = extractContent(newPayload);
          
          // Merge contents
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
        queryKey: trpc.sessions.getSession.queryKey({ sessionId }) 
      });
    }
  }, [queryClient, sessionId, trpc.sessions.getSession]);

  // Handle approval requests
  const handleApproval = useCallback((approval: ApprovalRequest) => {
    setPendingApproval(approval);
    queryClient.invalidateQueries({ 
      queryKey: trpc.sessions.getSession.queryKey({ sessionId }) 
    });
  }, [queryClient, sessionId, trpc.sessions.getSession]);

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
      onSuccess: () => {
        setPendingApproval(null);
        queryClient.invalidateQueries({ 
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }) 
        });
      },
    })
  );

  const denyMutation = useMutation(
    trpc.approvals.deny.mutationOptions({
      onSuccess: () => {
        setPendingApproval(null);
        queryClient.invalidateQueries({ 
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }) 
        });
      },
    })
  );

  // Send message mutation
  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }) 
        });
      },
    })
  );

  // Kill session mutation
  const killSessionMutation = useMutation(
    trpc.sessions.killSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ 
          queryKey: trpc.sessions.getSession.queryKey({ sessionId }) 
        });
        queryClient.invalidateQueries({ 
          queryKey: trpc.sessions.listSessions.queryKey() 
        });
      },
    })
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    // Add user message to events immediately
    setEvents(prev => [...prev, {
      type: "message" as const,
      clientId: session?.clientId ?? "",
      sessionId,
      timestamp: new Date(),
      payload: { content: inputMessage, isUser: true },
    }]);

    sendMessageMutation.mutate({ sessionId, message: inputMessage });
    setInputMessage("");
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-slate-600 border-t-green-500 rounded-full mx-auto mb-4" />
        <p className="text-slate-400">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-2">Session not found</p>
        <p className="text-sm text-slate-500 font-mono">{sessionId}</p>
        <Link
          to="/dashboard/sessions"
          className="mt-4 inline-block text-green-400 hover:text-green-300"
        >
          ← Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/sessions"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <AgentBadge type={session.agentType} size="sm" />
              <StatusBadge status={session.status} />
              {sendMessageMutation.isPending && (
                <span className="text-xs text-yellow-400 animate-pulse">Processing...</span>
              )}
              {connected ? (
                <span className="text-xs text-green-400">● Live</span>
              ) : (
                <span className="text-xs text-slate-500">○ Connecting...</span>
              )}
            </div>
            <p className="font-mono text-sm text-slate-400 mt-1">{session.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEvents([])}
            className="px-3 py-1.5 rounded-lg text-sm bg-slate-700/50 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`
              px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer
              ${autoScroll
                ? "bg-green-500/20 text-green-400"
                : "bg-slate-700/50 text-slate-400"
              }
            `}
          >
            Auto-scroll {autoScroll ? "ON" : "OFF"}
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
              className="px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
            >
              {killSessionMutation.isPending ? "Killing..." : "Kill"}
            </button>
          )}
        </div>
      </div>

      {/* Pending Approval Banner */}
      {pendingApproval && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 animate-pulse">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-400">⚠️</span>
                <span className="font-medium text-amber-200">{pendingApproval.toolCall.title}</span>
              </div>
              <p className="text-sm text-slate-400">
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
                        ? denyMutation.mutate({ approvalId: pendingApproval.id })
                        : approveMutation.mutate({ approvalId: pendingApproval.id, optionId: option.optionId })
                    }
                    disabled={approveMutation.isPending || denyMutation.isPending}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
                      disabled:opacity-50
                      ${isDeny
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : isAllow
                          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
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
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 font-mono text-sm">
        {events.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            <p>No messages yet.</p>
            <p className="text-xs mt-2">Send a message below to start the conversation.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, i) => (
              <LogEntry key={`${event.timestamp.toString()}-${i}`} event={event} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {session.status !== "completed" && session.status !== "killed" && session.status !== "error" && (
        <form onSubmit={handleSendMessage} className="mt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={pendingApproval ? "Waiting for approval..." : "Send a message..."}
              disabled={sendMessageMutation.isPending || !!pendingApproval}
              className="
                flex-1 px-4 py-3 rounded-lg
                bg-slate-800 border border-slate-700
                text-slate-100 placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                disabled:opacity-50
              "
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || sendMessageMutation.isPending || !!pendingApproval}
              className="
                px-6 py-3 rounded-lg font-medium
                bg-green-600 text-white
                hover:bg-green-500 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer
              "
            >
              {sendMessageMutation.isPending ? "..." : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LogEntry({ event }: { event: AgentEvent }) {
  const config: Record<string, { prefix: string; color: string }> = {
    thinking: { prefix: "💭", color: "text-purple-400" },
    message: { prefix: "💬", color: "text-slate-100" },
    "tool-call": { prefix: "🔧", color: "text-blue-400" },
    "tool-update": { prefix: "🔧", color: "text-blue-300" },
    plan: { prefix: "📋", color: "text-yellow-400" },
    complete: { prefix: "✅", color: "text-green-400" },
    error: { prefix: "❌", color: "text-red-400" },
  };

  const { prefix, color } = config[event.type] ?? { prefix: "📨", color: "text-slate-400" };
  const payload = event.payload as Record<string, unknown>;
  
  // Extract content - handle nested objects from ACP
  let content: string;
  if (typeof payload.content === "string") {
    content = payload.content;
  } else if (typeof payload.content === "object" && payload.content !== null) {
    // ACP format: { type: "text", text: "..." }
    const nested = payload.content as Record<string, unknown>;
    content = (nested.text as string) ?? JSON.stringify(nested);
  } else if (typeof payload.stopReason === "string") {
    content = payload.stopReason;
  } else if (typeof payload.message === "string") {
    content = payload.message;
  } else {
    content = JSON.stringify(payload);
  }

  const isUser = payload.isUser === true;

  return (
    <div className={`flex gap-2 ${isUser ? "text-cyan-400" : color}`}>
      <span className="shrink-0">{isUser ? "👤" : prefix}</span>
      <span className="whitespace-pre-wrap break-words">{content}</span>
    </div>
  );
}
