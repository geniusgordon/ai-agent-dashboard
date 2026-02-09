/**
 * Worktree Card Component
 *
 * Displays a worktree with its branch, assigned agents, and actions.
 * Clicking the card navigates to the worktree detail page.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Play, Trash2, Users } from "lucide-react";
import { useTRPC } from "@/integrations/trpc/react";
import type { Worktree } from "@/lib/projects/types";
import { BranchBadge } from "./BranchBadge";

interface WorktreeCardProps {
  worktree: Worktree;
  projectId: string;
  onSpawnAgent?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function WorktreeCard({
  worktree,
  projectId,
  onSpawnAgent,
  onDelete,
  isDeleting,
}: WorktreeCardProps) {
  const trpc = useTRPC();

  const assignmentsQuery = useQuery(
    trpc.worktrees.getAssignments.queryOptions({
      worktreeId: worktree.id,
    }),
  );

  const assignments = assignmentsQuery.data ?? [];
  const hasMultipleAgents = assignments.length > 1;

  const stopNav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to="/dashboard/p/$projectId/worktrees/$worktreeId"
      params={{ projectId, worktreeId: worktree.id }}
      className={`block p-5 rounded-xl border border-border bg-card/50 transition-all duration-200 hover:bg-card hover:border-primary/20 cursor-pointer group border-l-2 ${
        hasMultipleAgents
          ? "border-l-action-warning"
          : assignments.length > 0
            ? "border-l-git"
            : "border-l-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">{worktree.name}</h4>
            {worktree.isMainWorktree && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                main
              </span>
            )}
          </div>
          <BranchBadge branch={worktree.branch} size="sm" />
        </div>

        {!worktree.isMainWorktree && (
          <button
            type="button"
            onClick={(e) => {
              stopNav(e);
              onDelete?.();
            }}
            disabled={isDeleting}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete worktree"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {/* Path */}
      <p className="text-xs text-muted-foreground font-mono truncate mb-3">
        {worktree.path}
      </p>

      {/* Agents + Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignments.length > 0 ? (
            <>
              <Users className="size-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {assignments.length} agent{assignments.length !== 1 ? "s" : ""}
              </span>
              {hasMultipleAgents && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-action-warning/10 text-action-warning-muted shrink-0">
                  <AlertTriangle className="size-3" />
                  <span className="hidden sm:inline">shared</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No agents</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onSpawnAgent && (
            <button
              type="button"
              onClick={(e) => {
                stopNav(e);
                onSpawnAgent();
              }}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-action-success/20 text-action-success-hover border border-action-success/30 hover:bg-action-success/30 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Play className="size-3" />
              <span className="hidden sm:inline">Spawn</span>
            </button>
          )}
          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
}
