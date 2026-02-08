/**
 * Dashboard Sidebar Navigation
 *
 * Context-aware sidebar that adapts based on the current route:
 * - Home (`/dashboard`): Shows global nav with logo header
 * - Project (`/dashboard/p/$projectId`): Shows project switcher + project-scoped nav
 *
 * Built on shadcn Sidebar primitives — handles mobile Sheet overlay,
 * collapsible icon mode, cookie persistence, and Ctrl+B shortcut.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router";
import {
  Bot,
  GitBranch,
  Hexagon,
  Home,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  Sidebar as SidebarRoot,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTheme } from "@/hooks/useTheme";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentSession, AgentType } from "@/lib/agents/types";
import type { AgentWorktreeAssignment, Worktree } from "@/lib/projects/types";
import { ProjectSwitcher } from "./ProjectSwitcher";

// =============================================================================
// Constants
// =============================================================================

const ACTIVE_STATUSES = new Set([
  "running",
  "waiting-approval",
  "starting",
  "idle",
]);

const agentIcons: Record<AgentType, typeof Bot> = {
  gemini: Sparkles,
  "claude-code": Bot,
  codex: Hexagon,
};

const statusColors: Record<string, string> = {
  running: "text-status-running",
  "waiting-approval": "text-status-waiting",
  starting: "text-status-starting",
  idle: "text-muted-foreground",
};

// =============================================================================
// Sidebar
// =============================================================================

export function Sidebar() {
  const matchRoute = useMatchRoute();
  const { theme, toggleTheme } = useTheme();
  const { setOpenMobile } = useSidebar();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Detect if we're in a project context by trying to match the layout route
  const projectMatch = matchRoute({
    to: "/dashboard/p/$projectId",
    fuzzy: true,
  });
  const projectId =
    projectMatch && typeof projectMatch === "object"
      ? (projectMatch as { projectId: string }).projectId
      : null;

  // Derive active sessionId from the current URL path.
  // useLocation subscribes to route changes, ensuring re-renders on navigation.
  const location = useLocation();
  const activeSessionId = (() => {
    const segments = location.pathname.split("/");
    const sessionsIdx = segments.lastIndexOf("sessions");
    if (sessionsIdx !== -1 && sessionsIdx < segments.length - 1) {
      return segments[sessionsIdx + 1] || null;
    }
    return null;
  })();

  // Fetch current project when in project context
  const projectQuery = useQuery({
    ...trpc.projects.get.queryOptions({ id: projectId ?? "" }),
    enabled: !!projectId,
  });

  // Fetch sessions for active agents display
  const sessionsQuery = useQuery(trpc.sessions.listSessions.queryOptions());

  // Fetch worktrees + assignments when in project context
  const worktreesQuery = useQuery({
    ...trpc.worktrees.list.queryOptions({ projectId: projectId ?? "" }),
    enabled: !!projectId,
  });
  const assignmentsQuery = useQuery({
    ...trpc.projects.getAssignments.queryOptions({
      projectId: projectId ?? "",
    }),
    enabled: !!projectId,
  });

  // Fetch pending approvals for badge display
  const approvalsQuery = useQuery(
    projectId
      ? trpc.approvals.list.queryOptions({ projectId })
      : trpc.approvals.list.queryOptions(),
  );
  const approvalCount = approvalsQuery.data?.length ?? 0;

  // Keep sidebar fresh via SSE
  useAgentEvents({
    onEvent: (event) => {
      if (
        event.type === "complete" ||
        event.type === "error" ||
        event.type === "thinking" ||
        event.type === "message"
      ) {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
        if (projectId) {
          queryClient.invalidateQueries({
            queryKey: trpc.projects.getAssignments.queryKey({
              projectId,
            }),
          });
        }
      }
      // Refetch approvals when a session completes/errors (approval may have been resolved)
      if (event.type === "complete" || event.type === "error") {
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
        });
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.list.queryKey(),
      });
    },
  });

  const allSessions = sessionsQuery.data ?? [];
  const activeSessions = allSessions.filter(
    (s) => s.isActive !== false && ACTIVE_STATUSES.has(s.status),
  );

  const handleNavClick = () => setOpenMobile(false);

  return (
    <SidebarRoot collapsible="icon">
      {/* Header: Logo or Project Switcher */}
      <SidebarHeader>
        {projectId ? (
          <ProjectSwitcher
            currentProjectId={projectId}
            currentProject={projectQuery.data ?? null}
          />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/dashboard" onClick={handleNavClick}>
                  <div className="size-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    AI
                  </div>
                  <span className="font-semibold text-base tracking-tight truncate">
                    Agent Dashboard
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation — context-dependent */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectId ? (
                <ProjectNav
                  projectId={projectId}
                  approvalCount={approvalCount}
                  onNavigate={handleNavClick}
                />
              ) : (
                <GlobalNav onNavigate={handleNavClick} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Agents Section */}
        {projectId ? (
          <ProjectAgents
            projectId={projectId}
            worktrees={worktreesQuery.data ?? []}
            assignments={assignmentsQuery.data ?? []}
            sessions={activeSessions}
            activeSessionId={activeSessionId}
            onNavigate={handleNavClick}
          />
        ) : (
          activeSessions.length > 0 && (
            <GlobalActiveAgents
              sessions={activeSessions}
              activeSessionId={activeSessionId}
              onNavigate={handleNavClick}
            />
          )
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarMenu>
          {projectId && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Home">
                <Link to="/dashboard" onClick={handleNavClick}>
                  <Home />
                  <span>Home</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === "dark" ? "Light Mode" : "Dark Mode"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}

// =============================================================================
// Global Navigation (Home page)
// =============================================================================

function GlobalNav({ onNavigate }: { onNavigate: () => void }) {
  const matchRoute = useMatchRoute();

  const isNewProject = !!matchRoute({
    to: "/dashboard/projects/new" as const,
    fuzzy: false,
  });

  const items = [
    {
      to: "/dashboard" as const,
      label: "Home",
      icon: LayoutDashboard,
      // Active for all /dashboard/* routes, unless a more specific item matches
      isActive:
        !isNewProject &&
        !!matchRoute({ to: "/dashboard" as const, fuzzy: true }),
    },
    {
      to: "/dashboard/projects/new" as const,
      label: "New Project",
      icon: Plus,
      isActive: isNewProject,
    },
  ];

  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            asChild
            isActive={item.isActive}
            tooltip={item.label}
          >
            <Link to={item.to} onClick={onNavigate}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}

// =============================================================================
// Project-Scoped Navigation
// =============================================================================

function ProjectNav({
  projectId,
  approvalCount,
  onNavigate,
}: {
  projectId: string;
  approvalCount: number;
  onNavigate: () => void;
}) {
  const matchRoute = useMatchRoute();

  const items = [
    { segment: "" as const, label: "Overview", icon: LayoutDashboard },
    { segment: "sessions" as const, label: "Sessions", icon: MessageSquare },
    { segment: "approvals" as const, label: "Approvals", icon: ShieldCheck },
  ];

  return (
    <>
      {items.map((item) => {
        const to =
          item.segment === ""
            ? ("/dashboard/p/$projectId" as const)
            : item.segment === "sessions"
              ? ("/dashboard/p/$projectId/sessions" as const)
              : ("/dashboard/p/$projectId/approvals" as const);

        const isActive = !!matchRoute({
          to,
          params: { projectId },
          fuzzy: item.segment !== "",
        });

        return (
          <SidebarMenuItem key={item.segment}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
              <Link to={to} params={{ projectId }} onClick={onNavigate}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
            {item.segment === "approvals" && approvalCount > 0 && (
              <SidebarMenuBadge>
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 px-1.5 text-[11px]"
                >
                  {approvalCount}
                </Badge>
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </>
  );
}

// =============================================================================
// Project Agents (grouped by worktree)
// =============================================================================

function ProjectAgents({
  projectId,
  worktrees,
  assignments,
  sessions,
  activeSessionId,
  onNavigate,
}: {
  projectId: string;
  worktrees: Worktree[];
  assignments: AgentWorktreeAssignment[];
  sessions: AgentSession[];
  activeSessionId: string | null;
  onNavigate: () => void;
}) {
  // Build a map: worktreeId -> session[]
  const sessionMap = new Map<string, AgentSession[]>();
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  for (const assignment of assignments) {
    const session = sessionById.get(assignment.sessionId);
    if (session && ACTIVE_STATUSES.has(session.status)) {
      const list = sessionMap.get(assignment.worktreeId) ?? [];
      list.push(session);
      sessionMap.set(assignment.worktreeId, list);
    }
  }

  // Only show worktrees that have active agents
  const activeWorktrees = worktrees.filter((w) => sessionMap.has(w.id));

  if (activeWorktrees.length === 0) return null;

  return (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Active Agents</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {activeWorktrees.map((worktree) => (
              <WorktreeAgentGroup
                key={worktree.id}
                projectId={projectId}
                worktree={worktree}
                sessions={sessionMap.get(worktree.id) ?? []}
                activeSessionId={activeSessionId}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function WorktreeAgentGroup({
  projectId,
  worktree,
  sessions,
  activeSessionId,
  onNavigate,
}: {
  projectId: string;
  worktree: Worktree;
  sessions: AgentSession[];
  activeSessionId: string | null;
  onNavigate: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={worktree.branch} size="sm">
        <GitBranch className="text-muted-foreground" />
        <span className="truncate font-medium">{worktree.branch}</span>
      </SidebarMenuButton>
      <SidebarMenuSub>
        {sessions.map((session) => {
          const Icon = agentIcons[session.agentType];
          const colorClass =
            statusColors[session.status] ?? "text-muted-foreground";

          return (
            <SidebarMenuSubItem key={session.id}>
              <SidebarMenuSubButton
                asChild
                size="sm"
                isActive={session.id === activeSessionId}
              >
                <Link
                  to="/dashboard/p/$projectId/sessions/$sessionId"
                  params={{ projectId, sessionId: session.id }}
                  onClick={onNavigate}
                >
                  <Icon className={`size-3.5 ${colorClass}`} />
                  <span className="truncate">
                    {session.name || session.agentType}
                  </span>
                  <StatusDot status={session.status} />
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        })}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

// =============================================================================
// Global Active Agents (flat list, shown on home page)
// =============================================================================

function GlobalActiveAgents({
  sessions,
  activeSessionId,
  onNavigate,
}: {
  sessions: AgentSession[];
  activeSessionId: string | null;
  onNavigate: () => void;
}) {
  return (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Active Sessions</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {sessions.map((session) => (
              <ActiveSessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function ActiveSessionItem({
  session,
  isActive,
  onNavigate,
}: {
  session: AgentSession;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = agentIcons[session.agentType];
  const colorClass = statusColors[session.status] ?? "text-muted-foreground";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={session.name || session.id.slice(0, 8)}
        size="sm"
      >
        <Link
          to="/dashboard/sessions/$sessionId"
          params={{ sessionId: session.id }}
          onClick={onNavigate}
        >
          <Icon className={colorClass} />
          <span className="truncate">
            {session.name || session.id.slice(0, 8)}
          </span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuBadge>
        <StatusDot status={session.status} />
      </SidebarMenuBadge>
    </SidebarMenuItem>
  );
}

// =============================================================================
// Shared
// =============================================================================

function StatusDot({ status }: { status: string }) {
  const colorClass = statusColors[status] ?? "text-muted-foreground";
  const pulse =
    status === "running" ||
    status === "waiting-approval" ||
    status === "starting";

  return (
    <span className={`relative flex size-2 ${colorClass}`}>
      {pulse && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
      )}
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}
