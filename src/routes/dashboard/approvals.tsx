/**
 * Approvals Page - Pending Permission Requests
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AgentBadge } from "../../components/dashboard";
import type { ApprovalRequest } from "../../lib/agents/types";

export const Route = createFileRoute("/dashboard/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  // TODO: Replace with tRPC query
  const [approvals] = useState<ApprovalRequest[]>([]);

  const handleApprove = (approvalId: string, optionId: string) => {
    // TODO: Call tRPC mutation
    console.log("Approve:", approvalId, optionId);
  };

  const handleDeny = (approvalId: string) => {
    // TODO: Call tRPC mutation
    console.log("Deny:", approvalId);
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

        {approvals.length > 0 && (
          <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
            {approvals.length} pending
          </div>
        )}
      </div>

      {/* Approvals List */}
      {approvals.length === 0 ? (
        <div className="
          p-12 rounded-xl border border-dashed border-slate-700
          text-center text-slate-500
        ">
          <div className="text-4xl mb-4">◈</div>
          <p className="text-lg">No pending approvals</p>
          <p className="text-sm mt-1">
            Permission requests from agents will appear here
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
}

function ApprovalCard({ approval, onApprove, onDeny }: ApprovalCardProps) {
  return (
    <div className="
      p-5 rounded-xl border border-amber-500/30 bg-amber-500/5
      animate-pulse-slow
    ">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 text-lg">◈</span>
            <h3 className="font-semibold text-lg">{approval.toolCall.title}</h3>
          </div>
          <p className="text-sm text-slate-400">
            Kind: <span className="text-slate-300">{approval.toolCall.kind}</span>
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
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
                ${isDeny
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
        <span className="font-mono">{approval.id}</span>
        <span>•</span>
        <span>Session: {approval.sessionId.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
