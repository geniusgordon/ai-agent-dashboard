/**
 * Dashboard Sidebar Navigation
 *
 * Built on shadcn Sidebar primitives — handles mobile Sheet overlay,
 * collapsible icon mode, cookie persistence, and Ctrl+B shortcut.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Bot,
  Hexagon,
  LayoutDashboard,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
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
  SidebarRail,
  Sidebar as SidebarRoot,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTheme } from "@/hooks/useTheme";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentSession, AgentType } from "@/lib/agents/types";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    to: "/dashboard/sessions",
    label: "Sessions",
    icon: MessageSquare,
    exact: false,
  },
  {
    to: "/dashboard/approvals",
    label: "Approvals",
    icon: ShieldCheck,
    exact: false,
  },
] as const;

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

export function Sidebar() {
  const matchRoute = useMatchRoute();
  const { theme, toggleTheme } = useTheme();
  const { setOpenMobile } = useSidebar();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery(trpc.sessions.listSessions.queryOptions());

  // Keep sidebar sessions fresh via SSE
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
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
    },
  });

  const activeSessions = (sessionsQuery.data ?? []).filter(
    (s) => s.isActive !== false && ACTIVE_STATUSES.has(s.status),
  );

  // Close mobile sidebar when navigating
  const handleNavClick = () => {
    setOpenMobile(false);
  };

  return (
    <SidebarRoot collapsible="icon">
      {/* Header / Logo */}
      <SidebarHeader>
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
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = !!matchRoute({
                  to: item.to,
                  fuzzy: !item.exact,
                });

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link to={item.to} onClick={handleNavClick}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Active Sessions</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {activeSessions.map((session) => (
                    <ActiveSessionItem
                      key={session.id}
                      session={session}
                      onNavigate={handleNavClick}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer — theme toggle */}
      <SidebarFooter>
        <SidebarMenu>
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

function ActiveSessionItem({
  session,
  onNavigate,
}: {
  session: AgentSession;
  onNavigate: () => void;
}) {
  const matchRoute = useMatchRoute();
  const Icon = agentIcons[session.agentType];
  const isViewing = !!matchRoute({
    to: "/dashboard/sessions/$sessionId",
    params: { sessionId: session.id },
  });
  const colorClass = statusColors[session.status] ?? "text-muted-foreground";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isViewing}
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
