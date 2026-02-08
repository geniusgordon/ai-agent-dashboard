import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest } from "@/lib/agents/types";

export interface ApprovalBannerProps {
  approval: ApprovalRequest;
  onApprove: (approvalId: string, optionId: string) => void;
  onDeny: (approvalId: string) => void;
  isApproving: boolean;
  isDenying: boolean;
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

export function ApprovalBanner({
  approval,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
}: ApprovalBannerProps) {
  const [clickedOptionId, setClickedOptionId] = useState<string | null>(null);
  const isBusy = isApproving || isDenying;
  const kind = approval.toolCall.kind;
  const showKind = kind && kind !== "unknown";
  const title = stripBackticks(approval.toolCall.title);

  return (
    <div className="p-3 sm:p-4 rounded-xl border border-border bg-card/50 shadow-sm border-l-2 border-l-status-waiting animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Title row */}
      <div className="flex items-start gap-2 mb-2">
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

      {/* Buttons */}
      <div className="flex flex-wrap gap-2 ml-6">
        {approval.options.map((option) => {
          const isThisLoading = isBusy && clickedOptionId === option.optionId;
          return (
            <Button
              key={option.optionId}
              variant={getOptionVariant(option.kind)}
              size="sm"
              onClick={() => {
                setClickedOptionId(option.optionId);
                isRejectOption(option.kind)
                  ? onDeny(approval.id)
                  : onApprove(approval.id, option.optionId);
              }}
              disabled={isBusy}
            >
              {isThisLoading && <Loader2 className="size-3.5 animate-spin" />}
              {option.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
