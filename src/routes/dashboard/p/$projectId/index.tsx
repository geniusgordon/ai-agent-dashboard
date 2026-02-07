/**
 * Project Overview Page
 *
 * Shows project header, worktree grid with inline spawn, and recent activity.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Clock,
  FolderGit2,
  GitFork,
  Hexagon,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
  AgentBadge,
  BranchList,
  ErrorDisplay,
  WorktreeCard,
  WorktreeCreateDialog,
  WorktreeDeleteDialog,
} from "@/components/dashboard";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
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

const agentIcons: Record<AgentType, typeof Bot> = {
  gemini: Sparkles,
  "claude-code": Bot,
  codex: Hexagon,
};

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
          queryKey: trpc.projects.listBranchesWithStatus.queryKey({ projectId }),
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
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <ErrorDisplay
        error={projectQuery.error}
        title="Failed to load project"
        onRetry={() => projectQuery.refetch()}
      />
    );
  }

  if (!projectQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-muted-foreground">Project not found</p>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
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
    <div className="space-y-8">
      {/* Project Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3 rounded-xl bg-purple-500/10 shrink-0">
            <FolderGit2 className="size-6 text-purple-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground font-mono truncate mt-0.5">
              {project.repoPath}
            </p>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {project.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Worktree Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitFork className="size-5 text-muted-foreground" />
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
              <div key={worktree.id} className="space-y-2">
                <WorktreeCard
                  worktree={worktree}
                  onSpawnAgent={() =>
                    setSpawningWorktreeId(
                      spawningWorktreeId === worktree.id ? null : worktree.id,
                    )
                  }
                  onDelete={() => setWorktreeToDelete(worktree)}
                  isDeleting={worktreeToDelete?.id === worktree.id && deleteWorktreeMutation.isPending}
                />
                {/* Inline spawn: agent type picker */}
                {spawningWorktreeId === worktree.id && (
                  <InlineSpawnPicker
                    projectId={projectId}
                    worktreeId={worktree.id}
                    worktreePath={worktree.path}
                    onDone={() => setSpawningWorktreeId(null)}
                  />
                )}
              </div>
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
      </div>

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
      />

      {/* Recent Activity */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Clock className="size-5 text-muted-foreground" />
            Recent Activity
          </h2>
          <div className="space-y-1">
            {recentSessions.map((session) => {
              const Icon = agentIcons[session.agentType];
              return (
                <Link
                  key={session.id}
                  to="/dashboard/p/$projectId/sessions/$sessionId"
                  params={{ projectId, sessionId: session.id }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card/50 transition-colors group"
                >
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">
                    <span className="font-medium">
                      {session.name || session.agentType}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {session.status}
                    </span>
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {timeAgo(session.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Inline Spawn Picker
// =============================================================================

const agentTypes: AgentType[] = ["gemini", "claude-code", "codex"];

function InlineSpawnPicker({
  projectId,
  worktreeId,
  worktreePath,
  onDone,
}: {
  projectId: string;
  worktreeId: string;
  worktreePath: string;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [spawningType, setSpawningType] = useState<AgentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spawnMutation = useMutation(
    trpc.sessions.spawnClient.mutationOptions(),
  );
  const createSessionMutation = useMutation(
    trpc.sessions.createSession.mutationOptions(),
  );
  const assignMutation = useMutation(
    trpc.worktrees.assignAgent.mutationOptions(),
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getAssignments.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.worktrees.getAssignments.queryKey({ worktreeId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listClients.queryKey(),
    });
  };

  const handleSpawn = async (agentType: AgentType) => {
    setSpawningType(agentType);
    setError(null);

    try {
      const client = await spawnMutation.mutateAsync({
        agentType,
        cwd: worktreePath,
      });
      const session = await createSessionMutation.mutateAsync({
        clientId: client.id,
      });
      await assignMutation.mutateAsync({
        sessionId: session.id,
        clientId: client.id,
        worktreeId,
        projectId,
      });
      invalidateAll();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to spawn agent");
      invalidateAll();
    } finally {
      setSpawningType(null);
    }
  };

  return (
    <div className="px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Pick an agent:
        </span>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Cancel
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {agentTypes.map((type) => {
          const isSpawning = spawningType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleSpawn(type)}
              disabled={spawningType !== null}
              className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <AgentBadge type={type} size="sm" />
              <span className="text-xs text-muted-foreground">
                {isSpawning ? "Starting..." : "Start"}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
