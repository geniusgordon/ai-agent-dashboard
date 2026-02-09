/**
 * Project Sessions Page
 *
 * Lists sessions scoped to the current project, grouped by worktree.
 * Includes status filter, search, and collapsible worktree sections.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  MessageSquare,
  Search,
} from "lucide-react";
import { useState } from "react";
import { PageContainer, SessionCard } from "@/components/dashboard";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentSession } from "@/lib/agents/types";
import type { AgentWorktreeAssignment, Worktree } from "@/lib/projects/types";

export const Route = createFileRoute("/dashboard/p/$projectId/sessions/")({
  component: ProjectSessionsPage,
});

type StatusFilter = "all" | "running" | "completed";

function ProjectSessionsPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [collapsedWorktrees, setCollapsedWorktrees] = useState<Set<string>>(
    new Set(["__unassigned"]),
  );

  // Queries
  const sessionsQuery = useQuery(
    trpc.sessions.listSessions.queryOptions({ projectId }),
  );
  const worktreesQuery = useQuery(
    trpc.worktrees.list.queryOptions({ projectId }),
  );
  const assignmentsQuery = useQuery(
    trpc.projects.getAssignments.queryOptions({ projectId }),
  );

  // Keep fresh via SSE
  useAgentEvents({
    onEvent: (event) => {
      if (event.type === "complete" || event.type === "error") {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
        });
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
      });
    },
  });

  const sessions = sessionsQuery.data ?? [];
  const worktrees = worktreesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    if (
      filter === "running" &&
      !["running", "waiting-approval", "starting"].includes(session.status)
    )
      return false;
    if (
      filter === "completed" &&
      !["completed", "error", "killed"].includes(session.status)
    )
      return false;

    if (search) {
      const q = search.toLowerCase();
      const matchesId = session.id.toLowerCase().includes(q);
      const matchesName = session.name?.toLowerCase().includes(q);
      const matchesCwd = session.cwd.toLowerCase().includes(q);
      const matchesAgent = session.agentType.toLowerCase().includes(q);
      if (!matchesId && !matchesName && !matchesCwd && !matchesAgent)
        return false;
    }

    return true;
  });

  // Group by worktree
  const groups = groupByWorktree(filteredSessions, worktrees, assignments);

  const toggleWorktree = (id: string) => {
    setCollapsedWorktrees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter counts
  const runningCount = sessions.filter((s) =>
    ["running", "waiting-approval", "starting"].includes(s.status),
  ).length;
  const completedCount = sessions.filter((s) =>
    ["completed", "error", "killed"].includes(s.status),
  ).length;

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Agent sessions in this project
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="pl-9 pr-4 py-2 rounded-lg w-full bg-card border border-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { key: "all", label: "All", count: sessions.length },
                { key: "running", label: "Running", count: runningCount },
                { key: "completed", label: "Completed", count: completedCount },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  filter === f.key
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        {/* Session Groups */}
        {filteredSessions.length === 0 ? (
          <div className="p-12 rounded-xl border border-dashed border-border text-center">
            {search || filter !== "all" ? (
              <>
                <Search className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No sessions match</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Try a different search term or filter.
                </p>
              </>
            ) : (
              <>
                <MessageSquare className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No sessions in this project
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Spawn an agent from the{" "}
                  <Link
                    to="/dashboard/p/$projectId"
                    params={{ projectId }}
                    className="text-primary hover:underline"
                  >
                    Overview
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <WorktreeSessionGroup
                key={group.id}
                group={group}
                projectId={projectId}
                isCollapsed={collapsedWorktrees.has(group.id)}
                onToggle={() => toggleWorktree(group.id)}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

// =============================================================================
// Worktree Session Group
// =============================================================================

interface SessionGroup {
  id: string;
  label: string;
  branch: string | null;
  sessions: AgentSession[];
}

function WorktreeSessionGroup({
  group,
  projectId,
  isCollapsed,
  onToggle,
}: {
  group: SessionGroup;
  projectId: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 mb-3 group cursor-pointer"
      >
        <Chevron className="size-4 text-muted-foreground" />
        <GitBranch className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{group.label}</span>
        <span className="text-xs text-muted-foreground">
          ({group.sessions.length})
        </span>
      </button>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
          {group.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Grouping Logic
// =============================================================================

function groupByWorktree(
  sessions: AgentSession[],
  worktrees: Worktree[],
  assignments: AgentWorktreeAssignment[],
): SessionGroup[] {
  // Map: sessionId -> worktreeId
  const sessionToWorktree = new Map(
    assignments.map((a) => [a.sessionId, a.worktreeId]),
  );
  // Map: worktreeId -> Worktree
  const worktreeById = new Map(worktrees.map((w) => [w.id, w]));

  // Group sessions
  const grouped = new Map<string, AgentSession[]>();
  const unassigned: AgentSession[] = [];

  for (const session of sessions) {
    const worktreeId = sessionToWorktree.get(session.id);
    if (worktreeId && worktreeById.has(worktreeId)) {
      const list = grouped.get(worktreeId) ?? [];
      list.push(session);
      grouped.set(worktreeId, list);
    } else {
      unassigned.push(session);
    }
  }

  // Build groups, worktrees with sessions first (sorted by branch name)
  const groups: SessionGroup[] = [];

  const sortedWorktreeIds = [...grouped.keys()].sort((a, b) => {
    const wa = worktreeById.get(a);
    const wb = worktreeById.get(b);
    return (wa?.branch ?? "").localeCompare(wb?.branch ?? "");
  });

  for (const wtId of sortedWorktreeIds) {
    const wt = worktreeById.get(wtId)!;
    groups.push({
      id: wtId,
      label: wt.branch,
      branch: wt.branch,
      sessions: grouped.get(wtId) ?? [],
    });
  }

  if (unassigned.length > 0) {
    groups.push({
      id: "__unassigned",
      label: "Unassigned",
      branch: null,
      sessions: unassigned,
    });
  }

  return groups;
}
