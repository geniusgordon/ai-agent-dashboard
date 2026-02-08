/**
 * Project Approvals Page
 *
 * Shows pending approval requests scoped to the current project.
 * Mirrors the global approvals page with project-filtered data.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";
import type { ApprovalRequest } from "@/lib/agents/types";

export const Route = createFileRoute("/dashboard/p/$projectId/approvals")({
  component: ProjectApprovalsPage,
});

function ProjectApprovalsPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const approvalsQuery = useQuery(
    trpc.approvals.list.queryOptions({ projectId }),
  );
  const approvals = approvalsQuery.data ?? [];

  const { connected } = useAgentEvents({
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.list.queryKey({ projectId }),
      });
    },
  });

  const approveMutation = useMutation(
    trpc.approvals.approve.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey({ projectId }),
        });
      },
    }),
  );

  const denyMutation = useMutation(
    trpc.approvals.deny.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey({ projectId }),
        });
      },
    }),
  );

  const handleApprove = (approvalId: string, optionId: string) => {
    approveMutation.mutate({ approvalId, optionId });
  };

  const handleDeny = (approvalId: string) => {
    denyMutation.mutate({ approvalId });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Permission requests from this project's agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          {connected ? (
            <span className="text-xs text-live flex items-center gap-1.5 shadow-live-glow">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
              </span>
              Live
            </span>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              Connecting...
            </span>
          )}
          {approvals.length > 0 && (
            <div className="px-3 py-1 rounded-full bg-action-warning/20 text-action-warning text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 animate-pulse" />
              {approvals.length} pending
            </div>
          )}
        </div>
      </div>

      {/* Approvals List */}
      {approvals.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border text-center">
          <ShieldCheck className="size-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">No pending approvals</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Permission requests from agents will appear here in real-time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              projectId={projectId}
              onApprove={handleApprove}
              onDeny={handleDeny}
              isLoading={approveMutation.isPending || denyMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// Approval Card
// =============================================================================

function ApprovalCard({
  approval,
  projectId,
  onApprove,
  onDeny,
  isLoading,
}: {
  approval: ApprovalRequest;
  projectId: string;
  onApprove: (approvalId: string, optionId: string) => void;
  onDeny: (approvalId: string) => void;
  isLoading?: boolean;
}) {
  const kind = approval.toolCall.kind;
  const showKind = kind && kind !== "unknown";
  const title = stripBackticks(approval.toolCall.title);

  return (
    <div className="p-5 rounded-xl border border-border bg-card/50 shadow-sm border-l-2 border-l-status-waiting animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header row: icon + view session link */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <AlertTriangle className="size-4 text-action-warning shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-mono text-foreground break-words leading-relaxed">
              {title}
            </p>
            {showKind && (
              <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
                {kind}
              </span>
            )}
          </div>
        </div>

        <Link
          to="/dashboard/p/$projectId/sessions/$sessionId"
          params={{ projectId, sessionId: approval.sessionId }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          View session →
        </Link>
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-2 ml-6 mt-3">
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
      <div className="mt-3 ml-6 flex items-center gap-3 text-[11px] text-muted-foreground/70">
        <span className="font-mono">{approval.id.slice(0, 12)}</span>
        <span className="text-border">·</span>
        <span className="font-mono">{approval.sessionId.slice(0, 8)}</span>
      </div>
    </div>
  );
}
