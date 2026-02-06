/**
 * Sessions List Page
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../../integrations/trpc/react";
import { SessionCard } from "../../../components/dashboard";

export const Route = createFileRoute("/dashboard/sessions/")({
  component: SessionsPage,
});

function SessionsPage() {
  const trpc = useTRPC();
  const [filter, setFilter] = useState<"all" | "running" | "completed">("all");

  const sessionsQuery = useQuery(trpc.sessions.listSessions.queryOptions());
  const sessions = sessionsQuery.data ?? [];

  const filteredSessions = sessions.filter((session) => {
    if (filter === "all") return true;
    if (filter === "running") return ["running", "waiting-approval", "starting"].includes(session.status);
    if (filter === "completed") return ["completed", "error", "killed"].includes(session.status);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-slate-400 mt-1">
            View and manage all agent sessions
          </p>
        </div>
        
        {sessionsQuery.isLoading && (
          <span className="text-sm text-slate-500">Loading...</span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "running", "completed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
              ${filter === f
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
              }
            `}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "all" && ` (${sessions.length})`}
            {f === "running" && ` (${sessions.filter(s => ["running", "waiting-approval", "starting"].includes(s.status)).length})`}
            {f === "completed" && ` (${sessions.filter(s => ["completed", "error", "killed"].includes(s.status)).length})`}
          </button>
        ))}
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="
          p-12 rounded-xl border border-dashed border-slate-700
          text-center text-slate-500
        ">
          <div className="text-4xl mb-4">◉</div>
          <p className="text-lg">No sessions found</p>
          <p className="text-sm mt-1">
            {filter !== "all"
              ? `No ${filter} sessions. Try a different filter.`
              : "Start an agent from the Overview page to create sessions."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
