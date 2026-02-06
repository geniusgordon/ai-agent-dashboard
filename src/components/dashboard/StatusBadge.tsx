/**
 * Status Badge Component
 */

import type { SessionStatus, ClientStatus } from "../../lib/agents/types";

type Status = SessionStatus | ClientStatus;

const statusConfig: Record<Status, { label: string; color: string; pulse?: boolean }> = {
  idle: {
    label: "Idle",
    color: "bg-slate-500/20 text-slate-400",
  },
  starting: {
    label: "Starting",
    color: "bg-yellow-500/20 text-yellow-400",
    pulse: true,
  },
  running: {
    label: "Running",
    color: "bg-green-500/20 text-green-400",
    pulse: true,
  },
  "waiting-approval": {
    label: "Waiting",
    color: "bg-amber-500/20 text-amber-400",
    pulse: true,
  },
  completed: {
    label: "Completed",
    color: "bg-blue-500/20 text-blue-400",
  },
  error: {
    label: "Error",
    color: "bg-red-500/20 text-red-400",
  },
  killed: {
    label: "Killed",
    color: "bg-slate-500/20 text-slate-500",
  },
  ready: {
    label: "Ready",
    color: "bg-green-500/20 text-green-400",
  },
  stopped: {
    label: "Stopped",
    color: "bg-slate-500/20 text-slate-500",
  },
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.idle;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
        ${config.color}
      `}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {config.label}
    </span>
  );
}
