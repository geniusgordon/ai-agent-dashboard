/**
 * Worktree Detail Page
 *
 * Shows worktree metadata, git branch info with recent commits,
 * and assigned agent sessions.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Download,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Play,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  BranchBadge,
  ConfirmDialog,
  ErrorDisplay,
  PageContainer,
  SessionCard,
  SessionDeleteDialog,
  SpawnAgentDialog,
  WorktreeDeleteDialog,
} from "@/components/dashboard";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useSessionDelete } from "@/hooks/useSessionDelete";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentSession } from "@/lib/agents/types";

export const Route = createFileRoute(
  "/dashboard/p/$projectId/worktrees/$worktreeId",
)({
  component: WorktreeDetailPage,
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

function WorktreeDetailPage() {
  const { projectId, worktreeId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ---- Queries ----

  const worktreeQuery = useQuery(
    trpc.worktrees.get.queryOptions({ id: worktreeId }),
  );
  const projectQuery = useQuery(
    trpc.projects.get.queryOptions({ id: projectId }),
  );
  const statusQuery = useQuery(
    trpc.worktrees.getStatus.queryOptions({ id: worktreeId }),
  );
  const assignmentsQuery = useQuery(
    trpc.worktrees.getAssignments.queryOptions({ worktreeId }),
  );
  const commitsQuery = useQuery(
    trpc.worktrees.getRecentCommits.queryOptions({ id: worktreeId }),
  );
  const branchCommitsQuery = useQuery(
    trpc.worktrees.getBranchCommits.queryOptions({ id: worktreeId }),
  );
  const sessionsQuery = useQuery(
    trpc.sessions.listSessions.queryOptions({ projectId }),
  );

  // ---- SSE refresh ----

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
          queryKey: trpc.worktrees.getAssignments.queryKey({ worktreeId }),
        });
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
      });
    },
  });

  // ---- Mutations ----

  const deleteWorktreeMutation = useMutation(
    trpc.worktrees.delete.mutationOptions({
      onSuccess: () => {
        navigate({
          to: "/dashboard/p/$projectId",
          params: { projectId },
        });
      },
    }),
  );

  const sessionDelete = useSessionDelete({
    additionalInvalidations: [
      { queryKey: trpc.worktrees.getAssignments.queryKey({ worktreeId }) },
    ],
  });

  const handleConfirmDelete = (deleteBranch: boolean) => {
    deleteWorktreeMutation.mutate({ id: worktreeId, deleteBranch });
  };

  // ---- Git push/pull ----
  const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
  const [pullConfirmOpen, setPullConfirmOpen] = useState(false);

  const pushMutation = useMutation(
    trpc.worktrees.pushToOrigin.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.getStatus.queryKey({ id: worktreeId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.getRecentCommits.queryKey({
            id: worktreeId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.getBranchCommits.queryKey({
            id: worktreeId,
          }),
        });
        toast.success("Pushed to origin");
      },
      onError: (error) => {
        toast.error("Push failed", { description: error.message });
      },
    }),
  );

  const pullMutation = useMutation(
    trpc.worktrees.pullFromOrigin.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.getStatus.queryKey({ id: worktreeId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.getRecentCommits.queryKey({
            id: worktreeId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.getBranchCommits.queryKey({
            id: worktreeId,
          }),
        });
        toast.success("Pulled from origin");
      },
      onError: (error) => {
        toast.error("Pull failed", { description: error.message });
      },
    }),
  );

  // ---- Loading / Error states ----

  if (worktreeQuery.isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading worktree...</div>
        </div>
      </PageContainer>
    );
  }

  if (worktreeQuery.isError) {
    return (
      <PageContainer>
        <ErrorDisplay
          error={worktreeQuery.error}
          title="Failed to load worktree"
          onRetry={() => worktreeQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (!worktreeQuery.data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-muted-foreground">Worktree not found</p>
          <Link
            to="/dashboard/p/$projectId"
            params={{ projectId }}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3" />
            Back to project
          </Link>
        </div>
      </PageContainer>
    );
  }

  const worktree = worktreeQuery.data;
  const assignments = assignmentsQuery.data ?? [];
  const commits = commitsQuery.data ?? [];
  const branchCommits = branchCommitsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const status = statusQuery.data;

  // Join assignments with session data
  const assignedSessionIds = new Set(assignments.map((a) => a.sessionId));
  const assignedSessions = sessions.filter((s) => assignedSessionIds.has(s.id));

  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <Link
            to="/dashboard/p/$projectId"
            params={{ projectId }}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="size-3" />
            {projectQuery.data?.name ?? "Project"}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-xl bg-git/10 shrink-0">
                <FolderGit2 className="size-5 sm:size-6 text-git-muted" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                    {worktree.name}
                  </h1>
                  {worktree.isMainWorktree && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                      main
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                  <BranchBadge branch={worktree.branch} size="md" />
                  <GitStatusPill status={status} />
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground font-mono truncate mt-2">
                  {worktree.path}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={pullMutation.isPending}
                onClick={() => setPullConfirmOpen(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pullMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Pull
              </button>

              <button
                type="button"
                disabled={pushMutation.isPending}
                onClick={() => setPushConfirmOpen(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pushMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Push
              </button>

              <button
                type="button"
                onClick={() => setShowSpawnDialog(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-action-success/20 text-action-success-hover border border-action-success/30 hover:bg-action-success/30 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Play className="size-3.5" />
                Spawn Agent
              </button>

              {!worktree.isMainWorktree && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Assigned Agents */}
        <AgentsSection
          sessions={assignedSessions}
          hasMultipleAgents={assignments.length > 1}
          projectId={projectId}
          onSpawn={() => setShowSpawnDialog(true)}
          onDeleteSession={sessionDelete.setSessionToDelete}
          deletingSessionId={sessionDelete.deletingSessionId}
        />

        {/* Branch Commits (since checkout) */}
        {!worktree.isMainWorktree && (
          <BranchCommitsSection
            commits={branchCommits}
            branch={worktree.branch}
          />
        )}

        {/* Full History */}
        <FullHistorySection
          commits={commits}
          defaultExpanded={worktree.isMainWorktree}
        />

        {/* Spawn Agent Dialog */}
        {showSpawnDialog && (
          <SpawnAgentDialog
            projectId={projectId}
            worktreeId={worktree.id}
            worktreePath={worktree.path}
            worktreeName={worktree.name}
            open
            onOpenChange={(open) => {
              if (!open) setShowSpawnDialog(false);
            }}
          />
        )}

        {/* Delete Worktree Dialog */}
        <WorktreeDeleteDialog
          worktree={showDeleteDialog ? worktree : null}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleConfirmDelete}
          isDeleting={deleteWorktreeMutation.isPending}
          assignedAgentCount={assignments.length}
        />

        {/* Delete Session Dialog */}
        <SessionDeleteDialog
          session={sessionDelete.sessionToDelete}
          open={sessionDelete.sessionToDelete !== null}
          onOpenChange={(open) => {
            if (!open) sessionDelete.setSessionToDelete(null);
          }}
          onConfirm={sessionDelete.confirmDelete}
          isDeleting={sessionDelete.isDeleting}
        />

        {/* Push confirm */}
        <ConfirmDialog
          open={pushConfirmOpen}
          onOpenChange={setPushConfirmOpen}
          title="Push to Origin"
          description={`Push ${worktree.branch} to origin?`}
          confirmLabel="Push"
          onConfirm={() => {
            setPushConfirmOpen(false);
            pushMutation.mutate({ id: worktreeId });
          }}
        />

        {/* Pull confirm */}
        <ConfirmDialog
          open={pullConfirmOpen}
          onOpenChange={setPullConfirmOpen}
          title="Pull from Origin"
          description={`Pull latest changes from origin into ${worktree.branch}?`}
          confirmLabel="Pull"
          onConfirm={() => {
            setPullConfirmOpen(false);
            pullMutation.mutate({ id: worktreeId });
          }}
        />
      </div>
    </PageContainer>
  );
}

// =============================================================================
// Git Status Pill
// =============================================================================

function GitStatusPill({
  status,
}: {
  status: { hasUncommittedChanges: boolean; branch: string | null } | undefined;
}) {
  if (!status) return null;

  if (status.hasUncommittedChanges) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-action-warning/10 text-action-warning-muted border border-action-warning/20">
        <CircleDot className="size-3" />
        Uncommitted changes
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-action-success/10 text-action-success-muted border border-action-success/20">
      <CircleDot className="size-3" />
      Clean
    </span>
  );
}

// =============================================================================
// Agents Section
// =============================================================================

function AgentsSection({
  sessions,
  hasMultipleAgents,
  projectId,
  onSpawn,
  onDeleteSession,
  deletingSessionId,
}: {
  sessions: AgentSession[];
  hasMultipleAgents: boolean;
  projectId: string;
  onSpawn: () => void;
  onDeleteSession: (session: AgentSession) => void;
  deletingSessionId?: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Users className="size-5 text-muted-foreground" />
        Assigned Agents
        <span className="text-sm text-muted-foreground font-normal">
          ({sessions.length})
        </span>
      </h2>

      {hasMultipleAgents && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-action-warning/10 border border-action-warning/20 flex items-center gap-2">
          <AlertTriangle className="size-4 text-action-warning-muted shrink-0" />
          <p className="text-sm text-action-warning-muted">
            Multiple agents are assigned to this worktree. They may conflict
            with each other's changes.
          </p>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border text-center">
          <Users className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No agents assigned</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Spawn an agent to start working on this worktree.
          </p>
          <button
            type="button"
            onClick={onSpawn}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Play className="size-4" />
            Spawn Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              projectId={projectId}
              onDelete={() => onDeleteSession(session)}
              isDeleting={deletingSessionId === session.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Commit Row
// =============================================================================

function CommitRow({
  commit,
}: {
  commit: { hash: string; message: string; authorName: string; date: string };
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-lg hover:bg-card/50 transition-colors">
      <code className="text-xs text-git-muted font-mono shrink-0">
        {commit.hash}
      </code>
      <span className="text-sm truncate flex-1 min-w-0">{commit.message}</span>
      <span className="text-xs text-muted-foreground shrink-0 hidden md:inline">
        {commit.authorName}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">
        {timeAgo(commit.date)}
      </span>
    </div>
  );
}

// =============================================================================
// Branch Commits Section (since checkout)
// =============================================================================

function BranchCommitsSection({
  commits,
  branch,
}: {
  commits: {
    hash: string;
    message: string;
    authorName: string;
    date: string;
  }[];
  branch: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <GitBranch className="size-5 text-muted-foreground" />
        Branch Commits
        <span className="text-sm text-muted-foreground font-normal">
          ({commits.length})
        </span>
      </h2>

      {commits.length === 0 ? (
        <div className="px-4 py-8 rounded-xl border border-dashed border-border text-center">
          <GitCommitHorizontal className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No commits on{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {branch}
            </code>{" "}
            since checkout
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {commits.map((commit) => (
            <CommitRow key={commit.hash} commit={commit} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Full History Section (collapsible)
// =============================================================================

function FullHistorySection({
  commits,
  defaultExpanded,
}: {
  commits: {
    hash: string;
    message: string;
    authorName: string;
    date: string;
  }[];
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (commits.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-lg font-semibold cursor-pointer hover:text-foreground/80 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-5 text-muted-foreground" />
        )}
        <GitCommitHorizontal className="size-5 text-muted-foreground" />
        Recent Commits
        <span className="text-sm text-muted-foreground font-normal">
          ({commits.length})
        </span>
      </button>

      {expanded && (
        <div className="space-y-1 mt-4">
          {commits.map((commit) => (
            <CommitRow key={commit.hash} commit={commit} />
          ))}
        </div>
      )}
    </div>
  );
}
