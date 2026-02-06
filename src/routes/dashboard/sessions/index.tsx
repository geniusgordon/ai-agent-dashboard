/**
 * Sessions List Page
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Search } from "lucide-react";
import { useState } from "react";
import { SessionCard } from "../../../components/dashboard";
import { useAgentEvents } from "../../../hooks/useAgentEvents";
import { useTRPC } from "../../../integrations/trpc/react";

export const Route = createFileRoute("/dashboard/sessions/")({
  component: SessionsPage,
});

function SessionsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "running" | "completed">("all");
  const [search, setSearch] = useState("");

  const sessionsQuery = useQuery(trpc.sessions.listSessions.queryOptions());
  const sessions = sessionsQuery.data ?? [];

  // Subscribe to real-time events for status updates
  useAgentEvents({
    onEvent: (event) => {
      if (event.type === "complete" || event.type === "error") {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
    },
  });

  const filteredSessions = sessions.filter((session) => {
    // Status filter
    if (
      filter === "running" &&
      !["running", "waiting-approval", "starting"].includes(session.status)
    ) {
      return false;
    }
    if (
      filter === "completed" &&
      !["completed", "error", "killed"].includes(session.status)
    ) {
      return false;
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesId = session.id.toLowerCase().includes(searchLower);
      const matchesName = session.name?.toLowerCase().includes(searchLower);
      const matchesCwd = session.cwd.toLowerCase().includes(searchLower);
      const matchesAgent = session.agentType
        .toLowerCase()
        .includes(searchLower);
      if (!matchesId && !matchesName && !matchesCwd && !matchesAgent) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all agent sessions
          </p>
        </div>

        {sessionsQuery.isLoading && (
          <span className="text-sm text-muted-foreground">Loading...</span>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="
              pl-9 pr-4 py-2 rounded-lg w-full
              bg-card border border-input
              text-foreground placeholder-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
            "
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2">
          {(["all", "running", "completed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
              ${
                filter === f
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }
            `}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "all" && ` (${sessions.length})`}
              {f === "running" &&
                ` (${sessions.filter((s) => ["running", "waiting-approval", "starting"].includes(s.status)).length})`}
              {f === "completed" &&
                ` (${sessions.filter((s) => ["completed", "error", "killed"].includes(s.status)).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border text-center">
          {search ? (
            <>
              <Search className="size-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No sessions found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Try a different search term or filter.
              </p>
            </>
          ) : (
            <>
              <MessageSquare className="size-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No sessions found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {filter !== "all"
                  ? `No ${filter} sessions. Try a different filter.`
                  : "Start an agent from the Overview page to create sessions."}
              </p>
            </>
          )}
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
