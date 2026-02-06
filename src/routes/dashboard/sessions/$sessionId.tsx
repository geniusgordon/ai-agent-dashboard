/**
 * Session Detail Page - Live Streaming Logs
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AgentBadge, StatusBadge } from "../../../components/dashboard";
import type { AgentSession, AgentEvent } from "../../../lib/agents/types";

export const Route = createFileRoute("/dashboard/sessions/$sessionId")({
  component: SessionDetailPage,
});

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // TODO: Replace with tRPC query
  const [session] = useState<AgentSession | null>(null);
  const [events] = useState<AgentEvent[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    // TODO: Call tRPC mutation
    console.log("Sending message:", inputMessage);
    setInputMessage("");
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Loading session...</p>
        <p className="text-sm text-slate-500 mt-2 font-mono">{sessionId}</p>
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
            </div>
            <p className="font-mono text-sm text-slate-400 mt-1">{session.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 font-mono text-sm">
        {events.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            Waiting for events...
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, i) => (
              <LogEntry key={i} event={event} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {session.status !== "completed" && session.status !== "killed" && (
        <form onSubmit={handleSendMessage} className="mt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Send a message..."
              className="
                flex-1 px-4 py-3 rounded-lg
                bg-slate-800 border border-slate-700
                text-slate-100 placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
              "
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="
                px-6 py-3 rounded-lg font-medium
                bg-green-600 text-white
                hover:bg-green-500 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer
              "
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LogEntry({ event }: { event: AgentEvent }) {
  const config = {
    thinking: { prefix: "💭", color: "text-purple-400" },
    message: { prefix: "💬", color: "text-slate-100" },
    "tool-call": { prefix: "🔧", color: "text-blue-400" },
    "tool-update": { prefix: "🔧", color: "text-blue-300" },
    plan: { prefix: "📋", color: "text-yellow-400" },
    complete: { prefix: "✅", color: "text-green-400" },
    error: { prefix: "❌", color: "text-red-400" },
  };

  const { prefix, color } = config[event.type] ?? { prefix: "📨", color: "text-slate-400" };
  const payload = event.payload as { content?: string; stopReason?: string; message?: string };
  const content = payload.content ?? payload.stopReason ?? payload.message ?? JSON.stringify(payload);

  return (
    <div className={`flex gap-2 ${color}`}>
      <span className="shrink-0">{prefix}</span>
      <span className="whitespace-pre-wrap break-words">{content}</span>
    </div>
  );
}
