import { Link, useMatches } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Hexagon,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTheme } from "@/hooks/useTheme";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentSession, AgentType } from "@/lib/agents/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const navItems = [
  {
    to: "/dashboard" as const,
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/dashboard/sessions" as const,
    label: "Sessions",
    icon: MessageSquare,
  },
  {
    to: "/dashboard/approvals" as const,
    label: "Approvals",
    icon: ShieldCheck,
  },
];

const agentIcons: Record<AgentType, typeof Bot> = {
  gemini: Sparkles,
  "claude-code": Bot,
  codex: Hexagon,
};

const statusDotColor: Record<string, string> = {
  active: "bg-green-400",
  idle: "bg-yellow-400",
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const matches = useMatches();
  const { theme, toggleTheme } = useTheme();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery(
    trpc.sessions.listSessions.queryOptions(),
  );

  useAgentEvents((event) => {
    if (
      event.type === "session_update" ||
      event.type === "session_created" ||
      event.type === "session_ended"
    ) {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
    }
    if (event.type === "approval_requested") {
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.listApprovals.queryKey(),
      });
    }
  });

  const activeSessions = (sessions ?? []).filter(
    (s) => s.status === "active" || s.status === "idle",
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="font-semibold text-lg">Agent Dashboard</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const isActive = item.exact
              ? matches[matches.length - 1]?.fullPath === item.to
              : matches.some((m) => m.fullPath.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 px-3 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Active Sessions
              </div>
              <div className="flex flex-col gap-0.5">
                {activeSessions.map((session) => (
                  <ActiveSessionLink key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="border-t p-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm hover:text-foreground"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function ActiveSessionLink({ session }: { session: AgentSession }) {
  const matches = useMatches();
  const Icon = agentIcons[session.agentType];
  const dotColor = statusDotColor[session.status] ?? "bg-zinc-400";

  const isViewing = matches.some(
    (m) =>
      m.fullPath === "/dashboard/sessions/$sessionId" &&
      (m.params as Record<string, string>).sessionId === session.id,
  );

  return (
    <Link
      to="/dashboard/sessions/$sessionId"
      params={{ sessionId: session.id }}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
        isViewing
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">
        {session.lastMessage
          ? session.lastMessage.slice(0, 30)
          : `Session ${session.id.slice(0, 6)}`}
      </span>
      <span className="relative flex h-2 w-2 shrink-0">
        {session.status === "active" && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`}
        />
      </span>
    </Link>
  );
}
