/**
 * Quick Actions Bar
 *
 * Compact horizontal bar of common actions (git, review, document)
 * rendered above the message input. Only visible when the session
 * has a git branch context and is active.
 */

import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequestCreate,
  Loader2,
  Pen,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/integrations/trpc/react";
import {
  buildCustomDocumentPrompt,
  DOCUMENT_ACTIONS,
  getDocumentPrompt,
} from "@/lib/documents/prompts";
import type { SessionActions } from "./SessionInfoContent";

interface QuickActionsBarProps {
  actions: SessionActions;
  agentBusy: boolean;
  branch: string;
  projectId?: string;
  onStartReview?: () => void;
  onSendMessage?: (message: string) => void;
}

export function QuickActionsBar({
  actions,
  agentBusy,
  branch,
  projectId,
  onStartReview,
  onSendMessage,
}: QuickActionsBarProps) {
  const [pushConfirmOpen, setPushConfirmOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 px-4 pb-1 flex-wrap">
      {/* Push */}
      {actions.onPushToOrigin && (
        <Button
          variant="outline"
          size="xs"
          disabled={actions.isPushing}
          onClick={() => setPushConfirmOpen(true)}
          className="text-xs gap-1"
        >
          {actions.isPushing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Upload className="size-3" />
          )}
          Push
        </Button>
      )}

      {/* Commit */}
      {actions.onCommit && (
        <Button
          variant="outline"
          size="xs"
          disabled={actions.isSendingCommit || agentBusy}
          onClick={actions.onCommit}
          className="text-xs gap-1"
        >
          {actions.isSendingCommit ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <GitCommitHorizontal className="size-3" />
          )}
          Commit
        </Button>
      )}

      {/* Merge */}
      {actions.onMerge && (
        <BranchSelectPopover
          label="Merge"
          description={
            <>
              Merge a branch into <code className="text-[10px]">{branch}</code>
            </>
          }
          icon={<GitMerge className="size-3" />}
          confirmLabel="Send Merge Prompt"
          confirmIcon={<GitMerge className="size-3" />}
          projectId={projectId}
          excludeBranch={branch}
          disabled={actions.isSendingMerge || agentBusy}
          isLoading={actions.isSendingMerge}
          onConfirm={actions.onMerge}
        />
      )}

      {/* PR */}
      {actions.onCreatePR && (
        <BranchSelectPopover
          label="PR"
          description={
            <>
              Create PR from <code className="text-[10px]">{branch}</code>
            </>
          }
          icon={<GitPullRequestCreate className="size-3" />}
          confirmLabel="Send PR Prompt"
          confirmIcon={<GitPullRequestCreate className="size-3" />}
          projectId={projectId}
          excludeBranch={branch}
          disabled={actions.isSendingPR || agentBusy}
          isLoading={actions.isSendingPR}
          onConfirm={actions.onCreatePR}
        />
      )}

      {/* Code Review */}
      {onStartReview && (
        <Button
          variant="outline"
          size="xs"
          onClick={onStartReview}
          className="text-xs gap-1"
        >
          <GitMerge className="size-3" />
          Review
        </Button>
      )}

      {/* Document */}
      {onSendMessage && (
        <DocumentDropdown onSendMessage={onSendMessage} disabled={agentBusy} />
      )}

      {/* Push confirm dialog */}
      <ConfirmDialog
        open={pushConfirmOpen}
        onOpenChange={setPushConfirmOpen}
        title="Push to Origin"
        description={`Push ${branch} to origin?`}
        confirmLabel="Push"
        onConfirm={() => {
          setPushConfirmOpen(false);
          actions.onPushToOrigin?.();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch select popover (reused from GitActionsGrid pattern)
// ---------------------------------------------------------------------------

function BranchSelectPopover({
  label,
  description,
  icon,
  confirmLabel,
  confirmIcon,
  projectId,
  excludeBranch,
  disabled,
  isLoading,
  onConfirm,
}: {
  label: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  projectId?: string;
  excludeBranch?: string;
  disabled?: boolean;
  isLoading?: boolean;
  onConfirm: (branch: string) => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");

  const branchesQuery = useQuery(
    trpc.projects.listBranches.queryOptions(
      { projectId: projectId ?? "" },
      { enabled: open && !!projectId },
    ),
  );

  const branches = (branchesQuery.data ?? []).filter(
    (b) => b !== "HEAD" && b !== excludeBranch,
  );

  const defaultBranch =
    ["dev", "staging", "main", "master"].find((b) => branches.includes(b)) ??
    branches[0] ??
    "";

  const effectiveBranch = selected || defaultBranch;

  const handleConfirm = () => {
    if (!effectiveBranch) return;
    onConfirm(effectiveBranch);
    setOpen(false);
    setSelected("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          className="text-xs gap-1"
          disabled={disabled}
        >
          {isLoading ? <Loader2 className="size-3 animate-spin" /> : icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{description}</p>
          <Select value={effectiveBranch} onValueChange={setSelected}>
            <SelectTrigger className="w-full text-xs">
              <SelectValue placeholder="Select branch..." />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleConfirm}
            disabled={!effectiveBranch}
            className="w-full"
            size="sm"
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Document dropdown (reused from DocumentActionMenu pattern)
// ---------------------------------------------------------------------------

function DocumentDropdown({
  onSendMessage,
  disabled,
}: {
  onSendMessage: (message: string) => void;
  disabled: boolean;
}) {
  const [sending, setSending] = useState(false);

  const handlePreset = (type: Parameters<typeof getDocumentPrompt>[0]) => {
    setSending(true);
    onSendMessage(getDocumentPrompt(type));
    setTimeout(() => setSending(false), 500);
  };

  const handleCustom = () => {
    // For custom, send a generic prompt — user can type their own in the input
    const instruction = window.prompt("What should the agent document?");
    if (instruction?.trim()) {
      onSendMessage(buildCustomDocumentPrompt(instruction.trim()));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          className="text-xs gap-1"
          disabled={disabled || sending}
        >
          {sending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <FileText className="size-3" />
          )}
          Doc
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {DOCUMENT_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.type}
            onClick={() => handlePreset(action.type)}
          >
            <div>
              <div className="font-medium text-xs">{action.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {action.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCustom}>
          <div className="flex items-center gap-2">
            <Pen className="size-3" />
            <div>
              <div className="font-medium text-xs">Custom</div>
              <div className="text-[11px] text-muted-foreground">
                Write your own instruction
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
