/**
 * Project Detail Page
 *
 * Shows project info, worktree grid, agent map, and spawn flow.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FolderGit2, RefreshCw } from "lucide-react";
import { ErrorDisplay } from "@/components/dashboard/ErrorDisplay";
import { ProjectSpawnFlow } from "@/components/dashboard/ProjectSpawnFlow";
import { WorktreeAgentMap } from "@/components/dashboard/WorktreeAgentMap";
import { WorktreeCard } from "@/components/dashboard/WorktreeCard";
import { WorktreeCreateDialog } from "@/components/dashboard/WorktreeCreateDialog";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const projectQuery = useQuery(
    trpc.projects.get.queryOptions({ id: projectId }),
  );
  const worktreesQuery = useQuery(
    trpc.worktrees.list.queryOptions({ projectId }),
  );

  const syncMutation = useMutation(
    trpc.worktrees.sync.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.list.queryKey({ projectId }),
        });
      },
    }),
  );

  const deleteWorktreeMutation = useMutation(
    trpc.worktrees.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.list.queryKey({ projectId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getAssignments.queryKey({ projectId }),
        });
      },
    }),
  );

  const project = projectQuery.data;
  const worktrees = worktreesQuery.data ?? [];

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link
          to="/dashboard/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>
        <ErrorDisplay
          error={new Error("Project not found")}
          title="Project not found"
        />
      </div>
    );
  }

  const handleDeleteWorktree = (worktreeId: string, force = false) => {
    if (!confirm("Delete this worktree? This will remove the directory.")) {
      return;
    }
    deleteWorktreeMutation.mutate({ id: worktreeId, force });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/dashboard/projects"
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground mt-0.5"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FolderGit2 className="size-6 text-purple-400" />
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
            </div>
            {project.description && (
              <p className="text-muted-foreground text-sm mt-1">
                {project.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {project.repoPath}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => syncMutation.mutate({ projectId })}
            disabled={syncMutation.isPending}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
            title="Sync worktrees with filesystem"
          >
            <RefreshCw
              className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Error states */}
      {deleteWorktreeMutation.isError && (
        <ErrorDisplay
          error={deleteWorktreeMutation.error}
          title="Failed to delete worktree"
          onRetry={() => deleteWorktreeMutation.reset()}
        />
      )}

      {/* Worktrees */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Worktrees
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({worktrees.length})
            </span>
          </h2>
          <WorktreeCreateDialog projectId={projectId} />
        </div>

        {worktrees.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center">
            <p className="text-muted-foreground">No worktrees found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Click "Sync" to discover existing worktrees, or create a new one
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worktrees.map((wt) => (
              <WorktreeCard
                key={wt.id}
                worktree={wt}
                onSpawnAgent={() => {
                  // Scroll to spawn section
                  document
                    .getElementById("spawn-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                onDelete={() => handleDeleteWorktree(wt.id)}
                isDeleting={
                  deleteWorktreeMutation.isPending &&
                  deleteWorktreeMutation.variables?.id === wt.id
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Agent Map */}
      <WorktreeAgentMap projectId={projectId} worktrees={worktrees} />

      {/* Spawn */}
      <div id="spawn-section">
        <ProjectSpawnFlow projectId={projectId} worktrees={worktrees} />
      </div>
    </div>
  );
}
