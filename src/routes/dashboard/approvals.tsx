/**
 * Approvals Page - Pending Permission Requests
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAgentEvents } from "../../hooks/useAgentEvents";
import { useTRPC } from "../../integrations/trpc/react";
import type { ApprovalRequest } from "../../lib/agents/types";

export const Route = createFileRoute("/dashboard/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const approvalsQuery = useQuery(trpc.approvals.list.queryOptions());
  const approvals = approvalsQuery.data ?? [];

  // Subscribe to real-time approval events
  const { connected } = useAgentEvents({
    onApproval: () => {
      // Refresh the list when a new approval comes in
      queryClient.invalidateQueries({
        queryKey: trpc.approvals.list.queryKey(),
      });
    },
  });

  const approveMutation = useMutation(
    trpc.approvals.approve.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
        });
      },
    }),
  );

  const denyMutation = useMutation(
    trpc.approvals.deny.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.list.queryKey(),
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
          <p className="text-slate-400 mt-1">
            Review and respond to permission requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          {connected ? (
            <span className="text-xs text-green-400">● Live</span>
          ) : (
            <span className="text-xs text-slate-500">○ Connecting...</span>
          )}
          {approvalsQuery.isLoading && (
            <span className="text-sm text-slate-500">Loading...</span>
          )}
          {approvals.length > 0 && (
            <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium animate-pulse">
              {approvals.length} pending
            </div>
          )}
        </div>
      </div>

      {/* Approvals List */}
      {approvals.length === 0 ? (
        <div
          className="
          p-12 rounded-xl border border-dashed border-slate-700
          text-center text-slate-500
        "
        >
          <div className="text-4xl mb-4">✓</div>
          <p className="text-lg">No pending approvals</p>
          <p className="text-sm mt-1">
            Permission requests from agents will appear here in real-time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
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

interface ApprovalCardProps {
  approval: ApprovalRequest;
  onApprove: (approvalId: string, optionId: string) => void;
  onDeny: (approvalId: string) => void;
  isLoading?: boolean;
}

function ApprovalCard({
  approval,
  onApprove,
  onDeny,
  isLoading,
}: ApprovalCardProps) {
  return (
    <div
      className="
      p-5 rounded-xl border border-amber-500/30 bg-amber-500/5
      animate-in fade-in slide-in-from-top-2 duration-300
    "
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 text-lg">⚠️</span>
            <h3 className="font-semibold text-lg">{approval.toolCall.title}</h3>
          </div>
          <p className="text-sm text-slate-400">
            Kind:{" "}
            <span className="text-slate-300">{approval.toolCall.kind}</span>
          </p>
        </div>

        <Link
          to="/dashboard/sessions/$sessionId"
          params={{ sessionId: approval.sessionId }}
          className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isDeny
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                    : isAllow
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/50"
                }
              `}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      {/* Meta */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-4 text-xs text-slate-500">
        <span className="font-mono">{approval.id.slice(0, 20)}...</span>
        <span>•</span>
        <span>Session: {approval.sessionId.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
