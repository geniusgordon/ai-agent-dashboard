/**
 * Session Card Component
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useBranchInfo } from "../../hooks/useBranchInfo";
import { useTRPC } from "../../integrations/trpc/react";
import type { AgentSession } from "../../lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { BranchBadge } from "./BranchBadge";
import { StatusBadge } from "./StatusBadge";

interface SessionCardProps {
  session: AgentSession;
  /** When set, links to project-scoped session detail route */
  projectId?: string;
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

export function SessionCard({ session, projectId }: SessionCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const branchQuery = useBranchInfo(session.cwd);
  const branch = branchQuery.data?.branch;

  const deleteMutation = useMutation(
    trpc.sessions.deleteSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const timeAgo = getTimeAgo(session.createdAt);
  const isInactive = session.isActive === false;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirmDelete) {
      deleteMutation.mutate({ sessionId: session.id });
    } else {
      setConfirmDelete(true);
      // Reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

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

        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={deleteMutation.isPending}
          className={`
            p-1.5 rounded-md transition-colors cursor-pointer
            ${
              confirmDelete
                ? "bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title={confirmDelete ? "Click again to confirm" : "Delete session"}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Path */}
      <p className="text-xs text-muted-foreground font-mono truncate mb-3">
        {session.cwd}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {branch && <BranchBadge branch={branch} size="sm" />}
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        {confirmDelete && (
          <span className="text-[11px] text-destructive whitespace-nowrap shrink-0">
            Confirm delete
          </span>
        )}
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
