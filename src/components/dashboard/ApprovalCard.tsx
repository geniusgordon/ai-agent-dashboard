/**
 * Approval Card Component
 *
 * Displays a pending approval request with session context,
 * tool call details, and approve/deny action buttons.
 */

import { Link } from "@tanstack/react-router";
import type { inferProcedureOutput } from "@trpc/server";
import { AlertTriangle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TRPCRouter } from "@/integrations/trpc/router";
import { AgentBadge } from "./AgentBadge";
import { extractDetail } from "./ApprovalBanner";
import { BranchBadge } from "./BranchBadge";
import { StatusBadge } from "./StatusBadge";

/** Single enriched approval item — derived from the tRPC router output. */
export type EnrichedApproval = inferProcedureOutput<
  TRPCRouter["approvals"]["list"]
>[number];

export interface ApprovalCardProps {
  approval: EnrichedApproval;
  projectId: string;
  onApprove: (approvalId: string, optionId: string) => void;
  onDeny: (approvalId: string) => void;
  isLoading?: boolean;
}

function getOptionVariant(
  kind: string,
): "success" | "destructive" | "outline" | "default" {
  switch (kind) {
    case "allow_always":
      return "success";
    case "allow_once":
      return "outline";
    case "reject_once":
    case "reject_always":
      return "destructive";
    default:
      return "default";
  }
}

function isRejectOption(kind: string): boolean {
  return kind === "reject_once" || kind === "reject_always";
}

/**
 * Strip surrounding backticks from a title if present.
 * ACP tool call titles often wrap the command in backticks like: `echo "hello"`
 */
function stripBackticks(title: string): string {
  const trimmed = title.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function ApprovalCard({
  approval,
  projectId,
  onApprove,
  onDeny,
  isLoading,
}: ApprovalCardProps) {
  const kind = approval.toolCall.kind;
  const showKind = kind && kind !== "unknown";
  const title = stripBackticks(approval.toolCall.title);
  const rawDetail = extractDetail(approval.toolCall.rawInput);
  const detail = rawDetail && !title.includes(rawDetail) ? rawDetail : null;
  const session = approval.session;

  return (
    <div className="p-5 rounded-xl border border-border bg-card/50 shadow-sm border-l-2 border-l-status-waiting animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header: session context + status + view link */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {session && <AgentBadge type={session.agentType} size="sm" />}
          <StatusBadge status="waiting-approval" />
          {session?.name && (
            <span className="text-xs font-medium text-foreground truncate max-w-40">
              {session.name}
            </span>
          )}
          {session?.worktreeBranch && (
            <BranchBadge branch={session.worktreeBranch} size="sm" />
          )}
        </div>

        <Link
          to="/dashboard/p/$projectId/sessions/$sessionId"
          params={{ projectId, sessionId: approval.sessionId }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          View session →
        </Link>
      </div>

      {/* Tool call content */}
      <div className="rounded-lg bg-muted/50 p-3 mb-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 text-action-warning shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-mono text-foreground break-words leading-relaxed">
              {title}
            </p>
            {detail && (
              <p className="mt-1 text-xs text-muted-foreground font-mono break-words line-clamp-3">
                {detail}
              </p>
            )}
            {showKind && (
              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                {kind}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {approval.options.map((option) => (
          <Button
            key={option.optionId}
            variant={getOptionVariant(option.kind)}
            size="sm"
            onClick={() =>
              isRejectOption(option.kind)
                ? onDeny(approval.id)
                : onApprove(approval.id, option.optionId)
            }
            disabled={isLoading}
          >
            {option.name}
          </Button>
        ))}
      </div>

      {/* Meta */}
      <div className="mt-3 flex items-center gap-2 sm:gap-3 text-[11px] text-muted-foreground/70 flex-wrap">
        {session?.cwd && (
          <>
            <span
              className="inline-flex items-center gap-1 font-mono"
              title={session.cwd}
            >
              <FolderOpen className="size-3" />
              <span className="truncate max-w-32 sm:max-w-48">
                {session.cwd.split("/").pop() || session.cwd}
              </span>
            </span>
            <span className="text-border">·</span>
          </>
        )}
        <span className="font-mono">{approval.sessionId.slice(0, 8)}</span>
      </div>
    </div>
  );
}
