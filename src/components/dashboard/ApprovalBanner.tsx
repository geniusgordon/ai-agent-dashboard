import { AlertTriangle } from "lucide-react";
import type { ApprovalRequest } from "@/lib/agents/types";

export interface ApprovalBannerProps {
  approval: ApprovalRequest;
  onApprove: (approvalId: string, optionId: string) => void;
  onDeny: (approvalId: string) => void;
  isApproving: boolean;
  isDenying: boolean;
}

export function ApprovalBanner({
  approval,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
}: ApprovalBannerProps) {
  return (
    <div className="p-3 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold text-sm text-amber-200 break-words">
              {approval.toolCall.title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {approval.toolCall.kind}
          </p>
        </div>
        <div className="flex gap-2">
          {approval.options.map((option) => {
            const isAllow = option.kind.includes("allow");
            const isDenyOption = option.kind === "deny";
            return (
              <button
                key={option.optionId}
                type="button"
                onClick={() =>
                  isDenyOption
                    ? onDeny(approval.id)
                    : onApprove(approval.id, option.optionId)
                }
                disabled={isApproving || isDenying}
                className={`
                  flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                  disabled:opacity-50
                  ${
                    isDenyOption
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : isAllow
                        ? "bg-green-600 text-white hover:bg-green-500"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                  }
                `}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
