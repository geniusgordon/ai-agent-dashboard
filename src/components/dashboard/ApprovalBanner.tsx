import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
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
  const [clickedOptionId, setClickedOptionId] = useState<string | null>(null);
  const isBusy = isApproving || isDenying;

  return (
    <div className="p-3 sm:p-4 rounded-xl border border-action-warning/30 bg-action-warning/10 shadow-warning-glow animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-action-warning animate-pulse shrink-0" />
            <span className="font-semibold text-sm text-action-warning break-words">
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
            const isThisLoading = isBusy && clickedOptionId === option.optionId;
            return (
              <button
                key={option.optionId}
                type="button"
                onClick={() => {
                  setClickedOptionId(option.optionId);
                  isDenyOption
                    ? onDeny(approval.id)
                    : onApprove(approval.id, option.optionId);
                }}
                disabled={isBusy}
                className={`
                  flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isDenyOption
                      ? "bg-action-danger/20 text-action-danger hover:bg-action-danger/30"
                      : isAllow
                        ? "bg-action-success text-white hover:bg-action-success-hover"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                  }
                `}
              >
                {isThisLoading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    {option.name}
                  </span>
                ) : (
                  option.name
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
