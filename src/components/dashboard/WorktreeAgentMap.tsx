/**
 * Worktree Agent Map
 *
 * Visual overview of which agents are assigned to which worktrees.
 */

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, GitFork, Users } from "lucide-react";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentWorktreeAssignment, Worktree } from "@/lib/projects/types";
import { BranchBadge } from "./BranchBadge";

interface WorktreeAgentMapProps {
  projectId: string;
  worktrees: Worktree[];
}

export function WorktreeAgentMap({
  projectId,
  worktrees,
}: WorktreeAgentMapProps) {
  const trpc = useTRPC();

  const assignmentsQuery = useQuery(
    trpc.projects.getAssignments.queryOptions({ projectId }),
  );

  const assignments = assignmentsQuery.data ?? [];

  // Group assignments by worktree
  const assignmentsByWorktree = new Map<string, AgentWorktreeAssignment[]>();
  for (const a of assignments) {
    const existing = assignmentsByWorktree.get(a.worktreeId) ?? [];
    existing.push(a);
    assignmentsByWorktree.set(a.worktreeId, existing);
  }

  if (worktrees.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <GitFork className="size-4" />
        Agent Map
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {worktrees.map((wt) => {
          const wtAssignments = assignmentsByWorktree.get(wt.id) ?? [];
          const hasMultiple = wtAssignments.length > 1;

          return (
            <div
              key={wt.id}
              className={`p-3 rounded-lg border ${
                hasMultiple
                  ? "border-action-warning/40 bg-action-warning/5"
                  : "border-border bg-card/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <BranchBadge branch={wt.branch} size="sm" />
                {wt.isMainWorktree && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                    main
                  </span>
                )}
              </div>

              {wtAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">
                  No agents assigned
                </p>
              ) : (
                <div className="space-y-1">
                  {wtAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="text-xs flex items-center gap-1.5 text-muted-foreground"
                    >
                      <Users className="size-3" />
                      <span className="font-mono truncate">
                        {a.sessionId.slice(0, 12)}
                      </span>
                    </div>
                  ))}
                  {hasMultiple && (
                    <div className="flex items-center gap-1 text-[10px] text-action-warning-muted mt-1">
                      <AlertTriangle className="size-3" />
                      Multiple agents on same worktree
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
