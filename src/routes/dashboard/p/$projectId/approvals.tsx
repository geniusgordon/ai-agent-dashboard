/**
 * Project Approvals Page
 *
 * Shows pending approval requests scoped to the current project.
 * Mirrors the global approvals page with project-filtered data.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
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
  return (
    <div className="p-5 rounded-xl border border-action-warning/30 bg-action-warning/5 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-5 text-action-warning" />
            <h3 className="font-semibold text-lg">{approval.toolCall.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Kind:{" "}
            <span className="text-foreground">{approval.toolCall.kind}</span>
          </p>
        </div>

        <Link
          to="/dashboard/p/$projectId/sessions/$sessionId"
          params={{ projectId, sessionId: approval.sessionId }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          View session →
        </Link>
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-2">
        {approval.options.map((option) => {
          const isAllow = option.kind.includes("allow");
          const isDeny = option.kind === "deny";

          return (
            <button
              key={option.optionId}
              type="button"
              onClick={() =>
                isDeny
                  ? onDeny(approval.id)
                  : onApprove(approval.id, option.optionId)
              }
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isDeny
                  ? "bg-action-danger/20 text-action-danger hover:bg-action-danger/30 border border-action-danger/30"
                  : isAllow
                    ? "bg-action-success/20 text-action-success-hover hover:bg-action-success/30 border border-action-success/30"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
              }`}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      {/* Meta */}
      <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-mono">{approval.id.slice(0, 20)}...</span>
        <span>Session: {approval.sessionId.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
