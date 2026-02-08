import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileCode,
  FileDiff,
  GitCommitHorizontal,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/integrations/trpc/react";

export interface GitInfoPanelProps {
  cwd: string;
}

function CollapsibleSection({
  icon: Icon,
  label,
  badge,
  defaultOpen = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 py-1 hover:bg-accent/50 rounded-md px-1 transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium">{label}</span>
        {badge && (
          <span className="text-[10px] text-muted-foreground">{badge}</span>
        )}
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto pl-3 pt-0.5">{children}</div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function GitInfoPanel({ cwd }: GitInfoPanelProps) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.sessions.getGitInfo.queryOptions({ cwd }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="size-3 animate-spin" />
        <span>Loading git info…</span>
      </div>
    );
  }

  if (!data?.isGitRepo) return null;

  const commits = data.isFeatureBranch
    ? data.branchCommits
    : data.recentCommits;

  const totalAdditions = data.filesChanged.reduce(
    (sum, f) => sum + f.additions,
    0,
  );
  const totalDeletions = data.filesChanged.reduce(
    (sum, f) => sum + f.deletions,
    0,
  );

  return (
    <div className="space-y-1">
      {/* Uncommitted changes indicator */}
      {data.hasUncommitted && (
        <div className="flex items-center gap-1.5 text-xs text-action-warning-muted px-1">
          <CircleDot className="size-3 shrink-0" />
          <span>Uncommitted changes</span>
        </div>
      )}

      {/* Commits section */}
      {commits.length > 0 && (
        <CollapsibleSection
          icon={GitCommitHorizontal}
          label="Commits"
          badge={
            data.isFeatureBranch
              ? `${commits.length} on branch`
              : `${commits.length} recent`
          }
        >
          <div className="space-y-0.5">
            {commits.map((commit) => (
              <div
                key={commit.hash}
                className="flex items-baseline gap-1.5 text-xs leading-snug"
              >
                <code className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                  {commit.hash}
                </code>
                <span className="truncate min-w-0 flex-1">
                  {commit.message}
                </span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {formatRelativeTime(commit.date)}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Files changed section (feature branch only) */}
      {data.isFeatureBranch && data.filesChanged.length > 0 && (
        <CollapsibleSection
          icon={FileDiff}
          label="Files Changed"
          badge={`${data.filesChanged.length} files`}
        >
          <div className="space-y-0.5">
            {/* Summary line */}
            <div className="flex items-center gap-2 text-[10px] pb-1 mb-1 border-b border-border">
              <span className="text-action-success-muted flex items-center gap-0.5">
                <Plus className="size-2.5" />
                {totalAdditions}
              </span>
              <span className="text-destructive-foreground flex items-center gap-0.5">
                <Minus className="size-2.5" />
                {totalDeletions}
              </span>
            </div>
            {data.filesChanged.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-1.5 text-xs"
              >
                <FileCode className="size-3 shrink-0 text-muted-foreground/50" />
                <span className="font-mono text-[10px] truncate min-w-0 flex-1">
                  {file.path}
                </span>
                <span className="text-action-success-muted text-[10px] shrink-0">
                  +{file.additions}
                </span>
                <span className="text-destructive-foreground text-[10px] shrink-0">
                  -{file.deletions}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
