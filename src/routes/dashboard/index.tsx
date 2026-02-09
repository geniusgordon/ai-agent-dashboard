/**
 * Dashboard Home Page
 *
 * The root landing page. Shows a project cards grid with stats when
 * projects exist, or an onboarding view when no projects are set up yet.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, FolderGit2, Plus, ShieldAlert } from "lucide-react";
import {
  ErrorDisplay,
  PageContainer,
  ProjectCard,
} from "../../components/dashboard";
import { Button } from "../../components/ui/button";
import { useAgentEvents } from "../../hooks/useAgentEvents";
import { useNotifications } from "../../hooks/useNotifications";
import { useTRPC } from "../../integrations/trpc/react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Core queries
  const projectsQuery = useQuery(trpc.projects.list.queryOptions());
  const sessionsQuery = useQuery(trpc.sessions.listSessions.queryOptions());
  const approvalsQuery = useQuery(trpc.approvals.list.queryOptions());

  const projects = projectsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];

  // Stats
  const activeAgents = sessions.filter(
    (s) =>
      s.isActive !== false &&
      (s.status === "running" ||
        s.status === "waiting-approval" ||
        s.status === "starting"),
  ).length;
  const pendingApprovals = approvals.length;

  // Desktop notifications
  const { notify, permission, requestPermission } = useNotifications();

  // Keep data fresh via SSE
  useAgentEvents({
    onEvent: (event) => {
      if (event.type === "complete" || event.type === "error") {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      }
    },
    onApproval: (approval) => {
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.list.queryKey(),
      });
      notify("Approval Required", {
        body: `${approval.toolCall.kind}: ${approval.toolCall.title}`,
        tag: approval.id,
      });
    },
  });

  // Loading state
  if (projectsQuery.isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </PageContainer>
    );
  }

  // Error state
  if (projectsQuery.isError) {
    return (
      <PageContainer>
        <ErrorDisplay
          error={projectsQuery.error}
          title="Failed to load projects"
          onRetry={() => projectsQuery.refetch()}
        />
      </PageContainer>
    );
  }

  // Empty state — onboarding
  if (projects.length === 0) {
    return (
      <PageContainer>
        <OnboardingView />
      </PageContainer>
    );
  }

  // Main view — project grid with stats
  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Your AI agent workspaces
            </p>
          </div>
          <div className="flex items-center gap-3">
            {permission !== "granted" && (
              <Button variant="ghost" size="sm" onClick={requestPermission}>
                Enable Notifications
              </Button>
            )}
            <Button asChild>
              <Link to="/dashboard/projects/new">
                <Plus className="size-4" />
                New Project
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<FolderGit2 className="size-5 text-git-muted" />}
            label="Projects"
            value={projects.length}
          />
          <StatCard
            icon={<Bot className="size-5 text-action-success-muted" />}
            label="Active Agents"
            value={activeAgents}
          />
          <StatCard
            icon={<ShieldAlert className="size-5 text-action-warning-muted" />}
            label="Pending Approvals"
            value={pendingApprovals}
          />
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {/* New project card */}
          <Link
            to="/dashboard/projects/new"
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-dashed border-border hover:border-primary/30 hover:bg-card/50 transition-all cursor-pointer group min-h-[160px]"
          >
            <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Plus className="size-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Add a project
            </span>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

// =============================================================================
// Stats Card
// =============================================================================

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/30">
      <div className="p-2.5 rounded-lg bg-card">{icon}</div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Onboarding View (no projects)
// =============================================================================

function OnboardingView() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="max-w-lg text-center space-y-6">
        {/* Logo / Hero */}
        <div className="mx-auto size-20 rounded-2xl bg-gradient-to-br from-action-success-muted to-action-success flex items-center justify-center text-white text-3xl font-bold shadow-lg">
          AI
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Agent Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage AI coding agents organized around your git repositories. Each
            project groups worktrees and agents for parallel development.
          </p>
        </div>

        {/* Action Card */}
        <Link
          to="/dashboard/projects/new"
          className="flex flex-col items-center gap-3 p-8 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-md transition-all group mt-8"
        >
          <div className="p-3 rounded-xl bg-git/10 group-hover:bg-git/20 transition-colors">
            <FolderGit2 className="size-6 text-git-muted" />
          </div>
          <div>
            <div className="font-semibold">Add a Project</div>
            <div className="text-xs text-muted-foreground mt-1">
              Point to any git repository to get started
            </div>
          </div>
        </Link>

        {/* How it works */}
        <div className="mt-8 p-6 rounded-xl border border-border bg-card/20 text-left">
          <h3 className="font-semibold text-sm mb-3">How it works</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                1
              </span>
              <span>
                <strong className="text-foreground">Create a project</strong>{" "}
                from a git repository
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                2
              </span>
              <span>
                <strong className="text-foreground">Add worktrees</strong> for
                parallel branches
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                3
              </span>
              <span>
                <strong className="text-foreground">Spawn AI agents</strong>{" "}
                (Claude Code, Gemini, Codex) per worktree
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
