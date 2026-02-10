/**
 * Session Card Component
 */

import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useBranchInfo } from "../../hooks/useBranchInfo";
import type { AgentSession } from "../../lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { BranchBadge } from "./BranchBadge";
import { StatusBadge } from "./StatusBadge";

interface SessionCardProps {
  session: AgentSession;
  /** When set, links to project-scoped session detail route */
  projectId?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
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

export function SessionCard({
  session,
  projectId,
  onDelete,
  isDeleting,
}: SessionCardProps) {
  const branchQuery = useBranchInfo(session.cwd);
  const branch = branchQuery.data?.branch;

  const timeAgo = getTimeAgo(session.createdAt);
  const isInactive = session.isActive === false;

  return (
    <Link
      to={
        projectId
          ? "/dashboard/p/$projectId/sessions/$sessionId"
          : "/dashboard/sessions/$sessionId"
      }
      params={
        projectId
          ? { projectId, sessionId: session.id }
          : { sessionId: session.id }
      }
      className={`
        block p-5 rounded-xl border transition-all duration-200 cursor-pointer group
        border-l-2
        ${statusLeftBorder[session.status] ?? "border-l-muted-foreground"}
        ${
          isInactive
            ? "border-border/30 bg-card/30 opacity-60"
            : "border-border bg-card/50 hover:bg-card hover:border-primary/20"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">
              {session.name || session.id.slice(0, 8)}
            </h4>
            <StatusBadge status={session.status} />
            {isInactive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
                History
              </span>
            )}
          </div>
          <AgentBadge type={session.agentType} size="sm" />
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete session"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {/* Path */}
      <p className="text-xs text-muted-foreground font-mono truncate mb-3">
        {session.cwd}
      </p>

      {/* Footer */}
      <div className="space-y-1.5">
        {branch && <BranchBadge branch={branch} size="sm" />}
        <p className="text-xs text-muted-foreground text-right">{timeAgo}</p>
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
