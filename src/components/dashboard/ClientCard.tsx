/**
 * Client Card Component
 */

import { FolderGit2, FolderOpen, Plus, X } from "lucide-react";
import { useBranchInfo } from "../../hooks/useBranchInfo";
import type { AgentClient } from "../../lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { BranchBadge } from "./BranchBadge";
import { StatusBadge } from "./StatusBadge";

interface ClientCardProps {
  client: AgentClient;
  sessionCount: number;
  onCreateSession?: () => void;
  onStop?: () => void;
  isCreatingSession?: boolean;
  onImportToProject?: (cwd: string) => void;
}

const agentAccentBorder: Record<string, string> = {
  gemini: "border-t-agent-gemini",
  "claude-code": "border-t-agent-claude",
  codex: "border-t-agent-codex",
};

export function ClientCard({
  client,
  sessionCount,
  onCreateSession,
  onStop,
  isCreatingSession,
  onImportToProject,
}: ClientCardProps) {
  const branchQuery = useBranchInfo(client.cwd);
  const branch = branchQuery.data?.branch;
  const isGitRepo = branchQuery.data?.isGitRepo;

  return (
    <div
      className={`
        p-5 rounded-xl border border-border bg-card/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
        border-t-2 ${agentAccentBorder[client.agentType] ?? "border-t-border"}
      `}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <AgentBadge type={client.agentType} />
          <StatusBadge status={client.status} />
        </div>

        {client.status === "ready" && (
          <button
            type="button"
            onClick={onStop}
            className="p-1.5 rounded text-muted-foreground hover:text-status-error hover:bg-status-error/10 transition-colors cursor-pointer"
            title="Stop client"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Client ID */}
      <p className="font-mono text-xs text-muted-foreground truncate mb-2">
        {client.id}
      </p>

      {/* CWD & Branch */}
      <div className="mb-3 flex items-center gap-2 min-w-0">
        <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
          <FolderOpen className="size-3.5 shrink-0" />
          {client.cwd}
        </p>
        {branch && <BranchBadge branch={branch} size="sm" />}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </span>

        {client.status === "ready" && (
          <button
            type="button"
            onClick={onCreateSession}
            disabled={isCreatingSession}
            className="
              px-3 py-1 rounded-md text-xs font-medium
              bg-action-success/20 text-action-success-hover border border-action-success/30
              hover:bg-action-success/30 transition-colors cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              inline-flex items-center gap-1.5
            "
          >
            <Plus className="size-3" />
            {isCreatingSession ? "Creating..." : "New Session"}
          </button>
        )}
      </div>

      {/* Error */}
      {client.error && (
        <div className="mt-3 p-2 rounded bg-status-error/10 border border-status-error/20">
          <p className="text-xs text-status-error">{client.error}</p>
        </div>
      )}

      {/* Import to projects prompt */}
      {isGitRepo && onImportToProject && (
        <button
          type="button"
          onClick={() => onImportToProject(client.cwd)}
          className="mt-3 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-git-muted hover:bg-git/10 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 border border-transparent hover:border-git/20"
        >
          <FolderGit2 className="size-3" />
          Add to Projects
        </button>
      )}
    </div>
  );
}
