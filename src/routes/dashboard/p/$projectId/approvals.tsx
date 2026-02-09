/**
 * Project Approvals Page
 *
 * Shows pending approval requests scoped to the current project.
 * Mirrors the global approvals page with project-filtered data.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { ApprovalCard, PageContainer } from "@/components/dashboard";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";

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
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Approvals
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Permission requests from this project's agents
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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
            <p className="text-lg text-muted-foreground">
              No pending approvals
            </p>
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
    </PageContainer>
  );
}
