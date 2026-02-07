/**
 * Project Overview Page
 *
 * Shows project header, worktree grid, spawn flow, and recent activity.
 * This is a placeholder — full implementation in Phase 4.
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderGit2 } from "lucide-react";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/p/$projectId/")({
  component: ProjectOverviewPage,
});

function ProjectOverviewPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();

  const projectQuery = useQuery(
    trpc.projects.get.queryOptions({ id: projectId }),
  );

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (!projectQuery.data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Project not found</div>
      </div>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FolderGit2 className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.repoPath}</p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Project overview — worktree grid, spawn flow, and activity coming in
        Phase 4.
      </div>
    </div>
  );
}
