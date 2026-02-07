/**
 * Project List Page
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderGit2, Plus } from "lucide-react";
import { ErrorDisplay } from "@/components/dashboard/ErrorDisplay";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/projects/")({
  component: ProjectListPage,
});

function ProjectListPage() {
  const trpc = useTRPC();
  const projectsQuery = useQuery(trpc.projects.list.queryOptions());
  const projects = projectsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your codebases and worktrees
          </p>
        </div>
        <Link
          to="/dashboard/projects/new"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="size-4" />
          New Project
        </Link>
      </div>

      {/* Error */}
      {projectsQuery.isError && (
        <ErrorDisplay
          error={projectsQuery.error}
          title="Failed to load projects"
          onRetry={() => projectsQuery.refetch()}
        />
      )}

      {/* Project Grid */}
      {projects.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border text-center">
          <FolderGit2 className="size-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No projects yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create your first project to start managing worktrees
          </p>
          <Link
            to="/dashboard/projects/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="size-4" />
            Create Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
