/**
 * Code Review List
 *
 * Flat list of independent code reviews. Each row shows status, and when
 * the review's session is terminal, offers merge / cleanup actions inline.
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
import { useTRPC } from "@/integrations/trpc/react";
import type { SessionStatus } from "@/lib/agents/types";
import type { CodeReview, CodeReviewStatus } from "@/lib/projects/types";
import { StatusBadge } from "./StatusBadge";

interface CodeReviewListProps {
  reviews: CodeReview[];
  projectId: string;
}

function isTerminalStatus(
  sessionStatus: SessionStatus | undefined,
  reviewStatus: CodeReviewStatus,
): boolean {
  return (
    sessionStatus === "completed" ||
    sessionStatus === "error" ||
    sessionStatus === "killed" ||
    sessionStatus === "idle" ||
    reviewStatus === "merged" ||
    reviewStatus === "error"
  );
}

export function CodeReviewList({ reviews, projectId }: CodeReviewListProps) {
  const trpc = useTRPC();

  // Session data is kept fresh by the parent page's useAgentEvents hook
  const sessionsQuery = useQuery(
    trpc.sessions.listSessions.queryOptions({ projectId }),
  );
  const sessionMap = new Map((sessionsQuery.data ?? []).map((s) => [s.id, s]));

  const activeReviews = reviews.filter((r) => r.status !== "merged");

  if (activeReviews.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1">
      {activeReviews.map((review) => {
        const session = review.sessionId
          ? sessionMap.get(review.sessionId)
          : undefined;
        const sessionStatus: SessionStatus | undefined = session?.status;
        const terminal = isTerminalStatus(sessionStatus, review.status);

        return (
          <CodeReviewRow
            key={review.id}
            review={review}
            projectId={projectId}
            sessionStatus={sessionStatus}
            isTerminal={terminal}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// Single Review Row
// =============================================================================

function CodeReviewRow({
  review,
  projectId,
  sessionStatus,
  isTerminal,
}: {
  review: CodeReview;
  projectId: string;
  sessionStatus: SessionStatus | undefined;
  isTerminal: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [mergeResult, setMergeResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [cleanupDone, setCleanupDone] = useState(false);

  const mergeMutation = useMutation(trpc.codeReviews.merge.mutationOptions());
  const cleanupMutation = useMutation(
    trpc.codeReviews.cleanup.mutationOptions(),
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.codeReviews.list.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.listBranchesWithStatus.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.worktrees.list.queryKey({ projectId }),
    });
  };

  const handleMerge = async () => {
    const result = await mergeMutation.mutateAsync({
      reviewId: review.id,
    });
    setMergeResult(result);
    invalidateAll();
  };

  const handleCleanup = async () => {
    await cleanupMutation.mutateAsync({
      reviewId: review.id,
      deleteWorktree: true,
      deleteBranch: true,
    });
    setCleanupDone(true);
    invalidateAll();
  };

  const isMerged = mergeResult?.success || review.status === "merged";
  const mergeFailed = mergeResult?.success === false;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card/80 transition-colors">
      {/* Status indicator */}
      {isMerged && <Check className="size-4 text-emerald-400 shrink-0" />}
      {mergeFailed && <X className="size-4 text-destructive shrink-0" />}
      {!isMerged && !mergeFailed && !isTerminal && (
        <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />
      )}
      {!isMerged && !mergeFailed && isTerminal && (
        <div className="size-4 shrink-0" />
      )}

      {/* Branch name */}
      <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm font-mono truncate flex-1">
        {review.branchName}
      </span>

      {/* Session status badge */}
      {sessionStatus && !isMerged && <StatusBadge status={sessionStatus} />}

      {/* Merge error */}
      {mergeFailed && mergeResult?.error && (
        <span className="text-xs text-destructive truncate max-w-48">
          {mergeResult.error.includes("CONFLICT")
            ? "Merge conflict"
            : "Merge failed"}
        </span>
      )}

      {/* Actions */}
      {isTerminal && !isMerged && !mergeFailed && (
        <button
          type="button"
          onClick={handleMerge}
          disabled={mergeMutation.isPending}
          className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <GitMerge className="size-3" />
          {mergeMutation.isPending ? "Merging..." : "Merge"}
        </button>
      )}

      {isMerged && !cleanupDone && (
        <button
          type="button"
          onClick={handleCleanup}
          disabled={cleanupMutation.isPending}
          className="px-2 py-1 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Trash2 className="size-3" />
          {cleanupMutation.isPending ? "..." : "Cleanup"}
        </button>
      )}

      {cleanupDone && (
        <span className="text-xs text-muted-foreground shrink-0">
          Cleaned up
        </span>
      )}

      {/* Link to session */}
      {review.sessionId && (
        <Link
          to="/dashboard/p/$projectId/sessions/$sessionId"
          params={{ projectId, sessionId: review.sessionId }}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="View review"
        >
          <ExternalLink className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
