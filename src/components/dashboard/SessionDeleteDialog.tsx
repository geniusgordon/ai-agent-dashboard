/**
 * Session Delete Dialog
 *
 * Confirmation dialog for deleting a session, matching the WorktreeDeleteDialog pattern.
 */

import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentSession } from "@/lib/agents/types";
import { AgentBadge } from "./AgentBadge";
import { StatusBadge } from "./StatusBadge";

interface SessionDeleteDialogProps {
  session: AgentSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

const activeStatuses = new Set(["running", "waiting-approval", "starting"]);

export function SessionDeleteDialog({
  session,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: SessionDeleteDialogProps) {
  if (!session) return null;

  const isActive = activeStatuses.has(session.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            Delete Session
          </DialogTitle>
          <DialogDescription>
            This will permanently delete the session{" "}
            <span className="font-medium text-foreground">
              {session.name || session.id.slice(0, 8)}
            </span>
            . This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {isActive && (
            <div className="px-3 py-2.5 rounded-lg bg-action-warning/10 border border-action-warning/20 flex items-start gap-2">
              <AlertTriangle className="size-4 text-action-warning-muted shrink-0 mt-0.5" />
              <p className="text-sm text-action-warning-muted">
                This session is currently active and will be killed before
                deletion.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AgentBadge type={session.agentType} size="sm" />
            <StatusBadge status={session.status} />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
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
