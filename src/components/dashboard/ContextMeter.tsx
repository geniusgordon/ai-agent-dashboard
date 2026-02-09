import type { UsageUpdatePayload } from "@/lib/agents/types";

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function formatCost(cost: { amount: number; currency: string }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cost.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost.amount);
}

export interface ContextMeterProps {
  usage: UsageUpdatePayload;
  compact?: boolean;
}

export function ContextMeter({ usage, compact = false }: ContextMeterProps) {
  const { used, size, cost } = usage;
  if (size <= 0) return null;

  const pct = Math.min((used / size) * 100, 100);
  const colorClass =
    pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-yellow-500" : "bg-primary";
  const textColor =
    pct >= 90
      ? "text-destructive"
      : pct >= 75
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-muted-foreground";

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-8">
          <div
            className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[10px] font-mono shrink-0 ${textColor}`}>
          {formatTokenCount(used)}/{formatTokenCount(size)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs min-w-0">
      <span className={`shrink-0 font-medium ${textColor}`}>Context</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-12">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono shrink-0 ${textColor}`}>
        {formatTokenCount(used)}/{formatTokenCount(size)}
      </span>
      {cost && (
        <span className="text-muted-foreground shrink-0">
          {formatCost(cost)}
        </span>
      )}
    </div>
  );
}
