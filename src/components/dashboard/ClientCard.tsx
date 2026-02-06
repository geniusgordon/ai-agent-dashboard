/**
 * Client Card Component
 */

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

export function ClientCard({
  client,
  sessionCount,
  onCreateSession,
  onStop,
  isCreatingSession,
}: ClientCardProps) {
  return (
    <div
      className="
      p-4 rounded-lg border border-slate-700/50 bg-slate-800/50
    "
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
            className="
              p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10
              transition-colors cursor-pointer
            "
            title="Stop client"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Client ID */}
      <p className="font-mono text-xs text-slate-500 truncate mb-2">
        {client.id}
      </p>

      {/* CWD */}
      <p className="text-sm text-slate-400 truncate mb-3">📁 {client.cwd}</p>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
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
            "
          >
            {isCreatingSession ? "Creating..." : "+ New Session"}
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
