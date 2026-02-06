/**
 * Client Card Component
 */

import { FolderOpen, Plus, X } from "lucide-react";
import type { AgentClient } from "../../lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { StatusBadge } from "./StatusBadge";

interface ClientCardProps {
  client: AgentClient;
  sessionCount: number;
  onCreateSession?: () => void;
  onStop?: () => void;
  isCreatingSession?: boolean;
}

const agentAccentBorder: Record<string, string> = {
  gemini: "border-t-blue-500",
  "claude-code": "border-t-amber-500",
  codex: "border-t-emerald-500",
};

export function ClientCard({
  client,
  sessionCount,
  onCreateSession,
  onStop,
  isCreatingSession,
}: ClientCardProps) {
  return (
    <div
      className={`
        p-5 rounded-xl border border-border bg-card/50 shadow-sm hover:shadow-md transition-shadow
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
            className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
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

      {/* CWD */}
      <p className="text-sm text-muted-foreground truncate mb-3 flex items-center gap-1.5">
        <FolderOpen className="size-3.5 shrink-0" />
        {client.cwd}
      </p>

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
              bg-green-500/20 text-green-400 border border-green-500/30
              hover:bg-green-500/30 transition-colors cursor-pointer
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
        <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{client.error}</p>
        </div>
      )}
    </div>
  );
}
