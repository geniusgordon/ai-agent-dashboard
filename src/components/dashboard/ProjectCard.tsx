/**
 * Project Card Component
 *
 * Displays a project summary with worktree count and active agents.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FolderGit2, GitFork, Users } from "lucide-react";
import { useTRPC } from "@/integrations/trpc/react";
import type { Project } from "@/lib/projects/types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const trpc = useTRPC();

  const worktreesQuery = useQuery(
    trpc.worktrees.list.queryOptions({ projectId: project.id }),
  );
  const assignmentsQuery = useQuery(
    trpc.projects.getAssignments.queryOptions({ projectId: project.id }),
  );

  const worktreeCount = worktreesQuery.data?.length ?? 0;
  const agentCount = assignmentsQuery.data?.length ?? 0;

  return (
    <Link
      to="/dashboard/p/$projectId"
      params={{ projectId: project.id }}
      className="block p-5 rounded-xl border border-border bg-card/50 shadow-sm hover:shadow-md hover:bg-card hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="p-2 rounded-lg bg-git/10">
          <FolderGit2 className="size-5 text-git-muted" />
        </div>
        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          Open
          <ChevronRight className="size-3" />
        </span>
      </div>

      <h3 className="font-semibold text-foreground truncate mb-1">
        {project.name}
      </h3>

      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      <p className="text-xs text-muted-foreground font-mono truncate mb-3">
        {project.repoPath}
      </p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <GitFork className="size-3" />
          {worktreeCount} worktree{worktreeCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {agentCount} agent{agentCount !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
