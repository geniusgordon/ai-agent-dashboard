/**
 * Worktree Delete Dialog
 *
 * Confirmation dialog for deleting a worktree with an opt-in option
 * to also delete the associated git branch.
 */

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Worktree } from "@/lib/projects/types";

interface WorktreeDeleteDialogProps {
  worktree: Worktree | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteBranch: boolean) => void;
  isDeleting: boolean;
}

export function WorktreeDeleteDialog({
  worktree,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: WorktreeDeleteDialogProps) {
  const [deleteBranch, setDeleteBranch] = useState(false);

  // Reset checkbox when dialog opens/closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setDeleteBranch(false);
    onOpenChange(nextOpen);
  };

  if (!worktree) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            Delete Worktree
          </DialogTitle>
          <DialogDescription>
            This will remove the worktree{" "}
            <span className="font-medium text-foreground">{worktree.name}</span>{" "}
            from the filesystem. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Branch: <BranchBadge branch={worktree.branch} size="sm" />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={deleteBranch}
              onChange={(e) => setDeleteBranch(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input accent-destructive cursor-pointer"
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Also delete branch{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                {worktree.branch}
              </code>
            </span>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(deleteBranch)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-action-danger text-white hover:bg-action-danger/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
