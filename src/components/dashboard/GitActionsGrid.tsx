/**
 * Git Actions Grid
 *
 * Shared 2x2 grid of git action buttons (Push, Commit, Merge, PR)
 * used in both SessionRightPanel (desktop) and SessionMobileDrawer (mobile).
 */

import { useQuery } from "@tanstack/react-query";
import {
  GitCommitHorizontal,
  GitMerge,
  GitPullRequestCreate,
  Loader2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
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
import type { SessionActions } from "./SessionInfoContent";

interface GitActionsGridProps {
  actions: SessionActions;
  agentBusy: boolean;
  branch?: string;
  projectId?: string;
}

export function GitActionsGrid({
  actions,
  agentBusy,
  branch,
  projectId,
}: GitActionsGridProps) {
  const [pushConfirmOpen, setPushConfirmOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        Git Actions
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.onPushToOrigin && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={actions.isPushing}
            onClick={() => setPushConfirmOpen(true)}
          >
            {actions.isPushing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Upload className="size-3" />
            )}
            Push
          </Button>
        )}

        {actions.onCommit && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={actions.isSendingCommit || agentBusy}
            onClick={actions.onCommit}
          >
            {actions.isSendingCommit ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <GitCommitHorizontal className="size-3" />
            )}
            Commit
          </Button>
        )}

        {actions.onMerge && (
          <BranchSelectPopover
            label="Merge"
            description={
              <>
                Merge a branch into{" "}
                <code className="text-[10px]">{branch}</code>
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
      </div>

      <ConfirmDialog
        open={pushConfirmOpen}
        onOpenChange={setPushConfirmOpen}
        title="Push to Origin"
        description={`Push ${branch ?? "branch"} to origin?`}
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
// Branch select popover (shared by Merge + PR buttons)
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

  // Default to first available preferred branch
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
          size="sm"
          className="text-xs"
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
