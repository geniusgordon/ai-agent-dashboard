import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { summarizePlanEntries } from "@/lib/agents/event-utils";
import type { PlanPayload } from "@/lib/agents/types";

type PlanEntry = PlanPayload["entries"][number];

export interface TaskPanelProps {
  entries: PlanEntry[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-3.5 text-event-complete shrink-0" />;
    case "in_progress":
      return (
        <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
      );
    default:
      return <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />;
  }
}

function ProgressBar({ entries }: { entries: PlanEntry[] }) {
  const total = entries.length;
  if (total === 0) return null;

  let completed = 0;
  let inProgress = 0;
  for (const e of entries) {
    if (e.status === "completed") completed++;
    else if (e.status === "in_progress") inProgress++;
  }
  const completedPct = (completed / total) * 100;
  const inProgressPct = (inProgress / total) * 100;

  return (
    <div className="h-1.5 flex-1 max-w-32 rounded-full bg-muted overflow-hidden">
      <div className="h-full flex">
        <div
          className="bg-event-complete transition-all duration-300"
          style={{ width: `${completedPct}%` }}
        />
        <div
          className="bg-primary/60 transition-all duration-300"
          style={{ width: `${inProgressPct}%` }}
        />
      </div>
    </div>
  );
}

export function TaskPanel({
  entries,
  isCollapsed,
  onToggleCollapse,
}: TaskPanelProps) {
  const summary = summarizePlanEntries(entries);

  return (
    <div className="rounded-xl border border-border bg-background/50 shadow-sm overflow-hidden">
      {/* Header — always visible, clickable to toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent/50 transition-colors cursor-pointer"
      >
        {isCollapsed ? (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        )}
        <ClipboardList className="size-3.5 text-event-plan shrink-0" />
        <span className="text-xs font-semibold tracking-wide uppercase text-event-plan">
          Tasks
        </span>
        <span className="text-xs text-muted-foreground">{summary}</span>
        <div className="flex-1" />
        <ProgressBar entries={entries} />
      </button>

      {/* Expanded task list */}
      {!isCollapsed && (
        <div className="border-t border-border max-h-48 overflow-y-auto">
          <div className="px-4 py-1.5 space-y-0.5">
            {entries.map((entry, i) => (
              <div
                key={`${entry.content}-${i}`}
                className={`flex items-start gap-2 py-1 text-[13px] leading-relaxed ${
                  entry.status === "completed"
                    ? "text-muted-foreground line-through opacity-60"
                    : entry.status === "in_progress"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                <div className="mt-0.5">
                  <StatusIcon status={entry.status} />
                </div>
                <span className="min-w-0">{entry.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
