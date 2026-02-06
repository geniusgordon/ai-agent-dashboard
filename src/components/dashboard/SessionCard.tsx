/**
 * Session Card Component
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { AgentSession } from "../../lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { StatusBadge } from "./StatusBadge";

interface SessionCardProps {
  session: AgentSession;
}

const statusLeftBorder: Record<string, string> = {
  running: "border-l-status-running",
  "waiting-approval": "border-l-status-waiting",
  starting: "border-l-status-starting",
  completed: "border-l-status-completed",
  error: "border-l-status-error",
  killed: "border-l-muted-foreground",
  idle: "border-l-muted-foreground",
};

export function SessionCard({ session }: SessionCardProps) {
  const timeAgo = getTimeAgo(session.createdAt);
  const isInactive = session.isActive === false;

  return (
    <Link
      to="/dashboard/sessions/$sessionId"
      params={{ sessionId: session.id }}
      className={`
        block p-5 rounded-xl border transition-all duration-200 cursor-pointer group
        border-l-2 shadow-sm
        ${statusLeftBorder[session.status] ?? "border-l-muted-foreground"}
        ${
          isInactive
            ? "border-border/30 bg-card/30 opacity-60"
            : "border-border bg-card/50 hover:bg-card hover:border-primary/20 hover:shadow-md"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <AgentBadge type={session.agentType} size="sm" />
            <StatusBadge status={session.status} />
            {isInactive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                History
              </span>
            )}
          </div>

          {/* Session Name or ID */}
          <p className="font-mono text-sm text-foreground truncate mb-1">
            {session.name || session.id.slice(0, 8)}
          </p>

          {/* CWD */}
          <p className="text-xs text-muted-foreground truncate">
            {session.cwd}
          </p>
        </div>

        {/* Time */}
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </div>

      {/* Hover indicator */}
      <div
        className="
        mt-3 pt-3 border-t border-border
        flex items-center justify-end
        opacity-0 group-hover:opacity-100 transition-opacity
      "
      >
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          View logs
          <ChevronRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}
