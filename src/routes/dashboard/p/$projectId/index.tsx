/**
 * Project Overview Page
 *
 * Shows project header, worktree grid with spawn dialog, and recent activity.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Clock,
  FolderGit2,
  GitFork,
  GitMerge,
  Plus,
} from "lucide-react";
import { useState } from "react";
import {
  AgentBadge,
  BranchBadge,
  BranchList,
  CodeReviewDialog,
  ErrorDisplay,
  PageContainer,
  SpawnAgentDialog,
  StatusBadge,
  WorktreeCard,
  WorktreeCreateDialog,
  WorktreeDeleteDialog,
} from "@/components/dashboard";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";
import type { Worktree } from "@/lib/projects/types";

export const Route = createFileRoute("/dashboard/p/$projectId/")({
  component: ProjectOverviewPage,
});

// =============================================================================
// Helpers
// =============================================================================

function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// =============================================================================
// Page
// =============================================================================

function ProjectOverviewPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [spawningWorktreeId, setSpawningWorktreeId] = useState<string | null>(
    null,
  );
  const [worktreeToDelete, setWorktreeToDelete] = useState<Worktree | null>(
    null,
  );
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Query assignments for the worktree being deleted (for the warning)
  const deleteTargetAssignmentsQuery = useQuery(
    trpc.worktrees.getAssignments.queryOptions(
      { worktreeId: worktreeToDelete?.id ?? "" },
      { enabled: worktreeToDelete !== null },
    ),
  );

  // Queries
  const projectQuery = useQuery(
    trpc.projects.get.queryOptions({ id: projectId }),
  );
  const worktreesQuery = useQuery(
    trpc.worktrees.list.queryOptions({ projectId }),
  );
  const sessionsQuery = useQuery(
    trpc.sessions.listSessions.queryOptions({ projectId }),
  );

  // Keep fresh via SSE
  useAgentEvents({
    onEvent: (event) => {
      if (
        event.type === "complete" ||
        event.type === "error" ||
        event.type === "message"
      ) {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getAssignments.queryKey({ projectId }),
        });
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
      });
    },
  });

  // Mutations
  const deleteWorktreeMutation = useMutation(
    trpc.worktrees.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.list.queryKey({ projectId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.projects.listBranchesWithStatus.queryKey({
            projectId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.projects.listBranches.queryKey({ projectId }),
        });
        setWorktreeToDelete(null);
      },
      onError: () => setWorktreeToDelete(null),
    }),
  );

  const handleConfirmDelete = (deleteBranch: boolean) => {
    if (!worktreeToDelete) return;
    deleteWorktreeMutation.mutate({
      id: worktreeToDelete.id,
      deleteBranch,
    });
  };

  // Loading
  if (projectQuery.isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading project...</div>
        </div>
      </PageContainer>
    );
  }

  if (projectQuery.isError) {
    return (
      <PageContainer>
        <ErrorDisplay
          error={projectQuery.error}
          title="Failed to load project"
          onRetry={() => projectQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (!projectQuery.data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-muted-foreground">Project not found</p>
          <Link
            to="/dashboard"
            className="text-sm text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>
      </PageContainer>
    );
  }

  const project = projectQuery.data;
  const worktrees = worktreesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  // Recent sessions sorted by updatedAt descending
  const recentSessions = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 8);

  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Project Header */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 rounded-xl bg-git/10 shrink-0">
            <FolderGit2 className="size-5 sm:size-6 text-git-muted" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {project.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono truncate mt-0.5">
              {project.repoPath}
            </p>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Worktree Grid */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <GitFork className="size-4 sm:size-5 text-muted-foreground" />
              Worktrees
              <span className="text-sm text-muted-foreground font-normal">
                ({worktrees.length})
              </span>
            </h2>
            <WorktreeCreateDialog projectId={projectId} />
          </div>

          {worktrees.length === 0 ? (
            <div className="p-12 rounded-xl border border-dashed border-border text-center">
              <GitFork className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No worktrees yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                Create a worktree to start working with agents on a branch
              </p>
              <WorktreeCreateDialog
                projectId={projectId}
                trigger={
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="size-4" />
                    Create Worktree
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {worktrees.map((worktree) => (
                <WorktreeCard
                  key={worktree.id}
                  worktree={worktree}
                  projectId={projectId}
                  onSpawnAgent={() => setSpawningWorktreeId(worktree.id)}
                  onDelete={() => setWorktreeToDelete(worktree)}
                  isDeleting={
                    worktreeToDelete?.id === worktree.id &&
                    deleteWorktreeMutation.isPending
                  }
                />
              ))}

              {/* New worktree card */}
              <WorktreeCreateDialog
                projectId={projectId}
                trigger={
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border border-dashed border-border hover:border-primary/30 hover:bg-card/50 transition-all cursor-pointer group min-h-[140px]"
                  >
                    <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Plus className="size-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      New worktree
                    </span>
                  </button>
                }
              />
            </div>
          )}

          {/* Spawn agent modal */}
          {spawningWorktreeId &&
            (() => {
              const wt = worktrees.find((w) => w.id === spawningWorktreeId);
              if (!wt) return null;
              return (
                <SpawnAgentDialog
                  projectId={projectId}
                  worktreeId={wt.id}
                  worktreePath={wt.path}
                  worktreeName={wt.name}
                  open
                  onOpenChange={(open) => {
                    if (!open) setSpawningWorktreeId(null);
                  }}
                />
              );
            })()}
        </div>

        {/* Code Review */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitMerge className="size-5 text-muted-foreground" />
              Code Review
            </h2>
            <button
              type="button"
              onClick={() => setReviewDialogOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <GitMerge className="size-4" />
              New Review
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Select branches and spawn agents to review changes
          </p>
        </div>

        <CodeReviewDialog
          projectId={projectId}
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
        />

        {/* Branches */}
        <BranchList projectId={projectId} />

        {/* Delete Worktree Dialog */}
        <WorktreeDeleteDialog
          worktree={worktreeToDelete}
          open={worktreeToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setWorktreeToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          isDeleting={deleteWorktreeMutation.isPending}
          assignedAgentCount={deleteTargetAssignmentsQuery.data?.length ?? 0}
        />

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Clock className="size-5 text-muted-foreground" />
              Recent Activity
            </h2>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  to="/dashboard/p/$projectId/sessions/$sessionId"
                  params={{ projectId, sessionId: session.id }}
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-border transition-all group"
                >
                  {/* Agent + Name */}
                  <AgentBadge type={session.agentType} size="sm" iconOnly />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {session.name || session.agentType}
                      </span>
                      <StatusBadge status={session.status} />
                    </div>

                    {/* Branch + Error details */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                      {session.worktreeBranch && (
                        <BranchBadge
                          branch={session.worktreeBranch}
                          size="sm"
                        />
                      )}
                      {session.status === "error" && session.error && (
                        <span className="text-xs text-status-error truncate flex items-center gap-1 min-w-0">
                          <AlertCircle className="size-3 shrink-0" />
                          <span className="truncate">{session.error}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                    {timeAgo(session.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
