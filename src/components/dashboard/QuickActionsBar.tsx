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
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

export interface QuickActions {
  onCommit?: () => void;
  isSendingCommit?: boolean;
  onMerge?: (targetBranch: string) => void;
  isSendingMerge?: boolean;
  onCreatePR?: (baseBranch: string) => void;
  isSendingPR?: boolean;
}

interface QuickActionsBarProps {
  actions: QuickActions;
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
  return (
    <div className="flex items-center gap-1.5 px-4 pb-1 flex-wrap">
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
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");

  const handlePreset = (type: Parameters<typeof getDocumentPrompt>[0]) => {
    onSendMessage(getDocumentPrompt(type));
  };

  const handleCustomConfirm = () => {
    if (customInstruction.trim()) {
      onSendMessage(buildCustomDocumentPrompt(customInstruction.trim()));
    }
    setCustomDialogOpen(false);
    setCustomInstruction("");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            className="text-xs gap-1"
            disabled={disabled}
          >
            <FileText className="size-3" />
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
          <DropdownMenuItem onClick={() => setCustomDialogOpen(true)}>
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

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Document</DialogTitle>
            <DialogDescription>
              What should the agent document?
            </DialogDescription>
          </DialogHeader>
          <Input
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="e.g. Add JSDoc to all exported functions"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomConfirm();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCustomDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomConfirm}
              disabled={!customInstruction.trim()}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
