/**
 * Code Review Panel
 *
 * Shows live progress of a batch code review, then merge controls when done.
 * Renders inline on the project page (not a dialog).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ExternalLink,
  GitBranch,
  GitMerge,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentEvent, SessionStatus } from "@/lib/agents/types";
import type { CodeReview, CodeReviewBranchStatus } from "@/lib/projects/types";
import { StatusBadge } from "./StatusBadge";

interface CodeReviewPanelProps {
  review: CodeReview;
  projectId: string;
  onClose: () => void;
}

type BranchMergeState = "pending" | "success" | "failed";

export function CodeReviewPanel({
  review,
  projectId,
  onClose,
}: CodeReviewPanelProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [mergeResults, setMergeResults] = useState<
    Map<string, { state: BranchMergeState; error?: string }>
  >(new Map());
  const [cleanupDone, setCleanupDone] = useState(false);

  // Session IDs from the persisted review branches
  const sessionIds = review.branches
    .map((b) => b.sessionId)
    .filter((id): id is string => id !== null);

  // Fetch session status for each review branch
  const sessionsQuery = useQuery(
    trpc.sessions.listSessions.queryOptions({ projectId }),
  );

  // Build a map of sessionId → session for quick lookup
  const sessionMap = new Map((sessionsQuery.data ?? []).map((s) => [s.id, s]));

  // Track completion via SSE — invalidate both sessions and review data
  useAgentEvents({
    onEvent: (event: AgentEvent) => {
      if (event.type === "complete" || event.type === "error") {
        if (sessionIds.includes(event.sessionId)) {
          queryClient.invalidateQueries({
            queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.codeReviews.list.queryKey({ projectId }),
          });
        }
      }
    },
  });

  // Compute status per branch — derive from session when available
  const branchStatuses = review.branches.map((branch) => {
    const session = branch.sessionId
      ? sessionMap.get(branch.sessionId)
      : undefined;
    // Use session status if available, otherwise fall back to persisted branch status
    const sessionStatus: SessionStatus | undefined = session?.status;
    const branchStatus: CodeReviewBranchStatus = branch.status;
    const isTerminal =
      sessionStatus === "completed" ||
      sessionStatus === "error" ||
      sessionStatus === "killed" ||
      sessionStatus === "idle" ||
      branchStatus === "merged" ||
      branchStatus === "error";
    return { ...branch, session, sessionStatus, branchStatus, isTerminal };
  });

  const completedCount = branchStatuses.filter((b) => b.isTerminal).length;
  const totalCount = branchStatuses.length;
  const allDone = completedCount === totalCount;

  // Mutations
  const mergeMutation = useMutation(
    trpc.codeReviews.mergeBranches.mutationOptions(),
  );
  const cleanupMutation = useMutation(
    trpc.codeReviews.cleanup.mutationOptions(),
  );

  const handleMerge = async () => {
    const branchNames = Array.from(mergeSelection);
    if (branchNames.length === 0) return;

    const result = await mergeMutation.mutateAsync({
      projectId,
      baseBranch: review.baseBranch,
      branchNames,
      reviewId: review.id,
    });

    const newResults = new Map(mergeResults);
    for (const r of result.results) {
      newResults.set(r.branchName, {
        state: r.success ? "success" : "failed",
        error: r.error,
      });
    }
    setMergeResults(newResults);

    // Invalidate to refresh branch list and review status
    queryClient.invalidateQueries({
      queryKey: trpc.projects.listBranchesWithStatus.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.worktrees.list.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.codeReviews.list.queryKey({ projectId }),
    });
  };

  const mergedBranches = Array.from(mergeResults.entries())
    .filter(([, r]) => r.state === "success")
    .map(([name]) => name);

  const handleCleanup = async () => {
    if (mergedBranches.length === 0) return;

    await cleanupMutation.mutateAsync({
      projectId,
      branchNames: mergedBranches,
      deleteWorktrees: true,
      deleteBranches: true,
    });

    setCleanupDone(true);

    queryClient.invalidateQueries({
      queryKey: trpc.worktrees.list.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.listBranchesWithStatus.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.listBranches.queryKey({ projectId }),
    });
  };

  const toggleMerge = (branchName: string) => {
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(branchName)) {
        next.delete(branchName);
      } else {
        next.add(branchName);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitMerge className="size-5 text-purple-400" />
          <h3 className="font-semibold">Code Review</h3>
          <span className="text-sm text-muted-foreground">
            {allDone
              ? `${totalCount} review${totalCount !== 1 ? "s" : ""} complete`
              : `${completedCount}/${totalCount} complete`}
          </span>
          {!allDone && (
            <Loader2 className="size-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Branch list */}
      <div className="space-y-1">
        {branchStatuses.map((entry) => {
          const mergeResult = mergeResults.get(entry.branchName);
          const isMerged =
            mergeResult?.state === "success" || entry.branchStatus === "merged";
          const showCheckbox = allDone && !isMerged && !mergeResult;

          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card/80 transition-colors"
            >
              {/* Merge checkbox (only when all reviews done) */}
              {showCheckbox && (
                <button
                  type="button"
                  onClick={() => toggleMerge(entry.branchName)}
                  className="shrink-0 cursor-pointer"
                >
                  <div
                    className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                      mergeSelection.has(entry.branchName)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {mergeSelection.has(entry.branchName) && (
                      <Check
                        className="size-3 text-primary-foreground"
                        strokeWidth={3}
                      />
                    )}
                  </div>
                </button>
              )}

              {/* Merge result icon */}
              {isMerged && (
                <Check className="size-4 text-emerald-400 shrink-0" />
              )}
              {mergeResult?.state === "failed" && (
                <X className="size-4 text-destructive shrink-0" />
              )}

              {/* Branch name */}
              <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono truncate flex-1">
                {entry.branchName}
              </span>

              {/* Status — show session status when available, skip merged branches */}
              {entry.session && entry.sessionStatus && !isMerged && (
                <StatusBadge status={entry.sessionStatus} />
              )}

              {/* Merge error */}
              {mergeResult?.state === "failed" && mergeResult.error && (
                <span className="text-xs text-destructive truncate max-w-48">
                  {mergeResult.error.includes("CONFLICT")
                    ? "Merge conflict"
                    : "Merge failed"}
                </span>
              )}

              {/* Link to session */}
              {entry.sessionId && (
                <Link
                  to="/dashboard/p/$projectId/sessions/$sessionId"
                  params={{ projectId, sessionId: entry.sessionId }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="View review"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {allDone && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {mergedBranches.length === 0 ? (
            <button
              type="button"
              onClick={handleMerge}
              disabled={mergeSelection.size === 0 || mergeMutation.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
            >
              <GitMerge className="size-4" />
              {mergeMutation.isPending
                ? "Merging..."
                : `Merge ${mergeSelection.size > 0 ? mergeSelection.size : ""} selected`}
            </button>
          ) : (
            <>
              <span className="text-sm text-emerald-400">
                {mergedBranches.length} merged
              </span>
              {!cleanupDone && (
                <button
                  type="button"
                  onClick={handleCleanup}
                  disabled={cleanupMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  {cleanupMutation.isPending
                    ? "Cleaning..."
                    : "Clean up worktrees & branches"}
                </button>
              )}
              {cleanupDone && (
                <span className="text-sm text-muted-foreground">
                  Cleaned up
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
