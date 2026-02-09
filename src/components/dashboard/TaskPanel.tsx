import { CheckCircle2, Circle, ClipboardList, Loader2 } from "lucide-react";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { PlanDocumentViewer } from "@/components/dashboard/PlanDocumentViewer";
import { summarizePlanEntries } from "@/lib/agents/event-utils";
import type { PlanPayload } from "@/lib/agents/types";

type PlanEntry = PlanPayload["entries"][number];

export interface TaskPanelProps {
  entries: PlanEntry[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  planFilePath?: string | null;
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
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
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
  planFilePath,
}: TaskPanelProps) {
  const summary = summarizePlanEntries(entries);

  return (
    <PanelSection
      icon={ClipboardList}
      label="Tasks"
      open={!isCollapsed}
      onOpenChange={(open) => {
        if (open === isCollapsed) onToggleCollapse();
      }}
      headerExtra={
        <span className="text-xs text-muted-foreground">{summary}</span>
      }
    >
      <div className="px-1 space-y-2">
        <ProgressBar entries={entries} />

        {planFilePath && <PlanDocumentViewer filePath={planFilePath} />}

        <div className="space-y-0">
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
    </PanelSection>
  );
}
