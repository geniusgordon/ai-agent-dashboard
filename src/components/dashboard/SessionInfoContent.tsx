/**
 * Session Info Content
 *
 * Shared content components for session sidebar (desktop) and drawer (mobile).
 * Provides SessionInfoHeader, SessionInfoBody, and SessionInfoActions
 * so both layouts can compose them without duplicating logic.
 */

import {
  CheckCircle,
  Clock,
  FolderGit2,
  GitMerge,
  Info,
  Loader2,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { ContextMeter } from "@/components/dashboard/ContextMeter";
import { DocumentActionMenu } from "@/components/dashboard/DocumentActionMenu";
import { GitActionsGrid } from "@/components/dashboard/GitActionsGrid";
import { GitInfoPanel } from "@/components/dashboard/GitInfoPanel";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ReconnectBanner } from "@/components/dashboard/ReconnectBanner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import type { AgentSession, UsageUpdatePayload } from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SessionActions {
  onKillSession: () => void;
  isKilling: boolean;
  onCompleteSession?: () => void;
  isCompleting: boolean;
  onDeleteSession?: () => void;
  isDeleting: boolean;
  onReconnect: () => void;
  isReconnecting: boolean;
  // Git actions
  onPushToOrigin?: () => void;
  isPushing?: boolean;
  onCommit?: () => void;
  isSendingCommit?: boolean;
  onMerge?: (targetBranch: string) => void;
  isSendingMerge?: boolean;
  onCreatePR?: (baseBranch: string) => void;
  isSendingPR?: boolean;
}

export interface SessionInfoContentProps {
  session: AgentSession;
  connected: boolean;
  branch?: string;
  worktreeId?: string;
  projectId?: string;
  projectName?: string;
  actions: SessionActions;
  usageInfo?: UsageUpdatePayload;
  onStartReview?: () => void;
  onSendMessage?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function SessionInfoHeader({
  session,
  connected,
  projectName,
  branch,
}: Pick<
  SessionInfoContentProps,
  "session" | "connected" | "projectName" | "branch"
>) {
  return (
    <div className="space-y-2">
      {/* Row 1: Agent + name */}
      <div className="flex items-center gap-2 min-w-0">
        <AgentBadge type={session.agentType} size="sm" />
        <span className="font-mono text-sm truncate flex-1">
          {session.name || session.id.slice(0, 8)}
        </span>
      </div>

      {/* Row 2: Status + connection + time */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={session.status} />
        {connected ? (
          <span className="text-xs font-medium text-live flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
            </span>
            Live
          </span>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" />
            Connecting
          </span>
        )}
        <span className="text-muted-foreground/40">&middot;</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="size-3 shrink-0" />
          {new Date(session.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Row 3+: Project and branch */}
      {projectName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <FolderGit2 className="size-3 shrink-0" />
          {projectName}
        </div>
      )}
      {branch && (
        <div className="min-w-0">
          <BranchBadge branch={branch} size="sm" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body (scrollable content)
// ---------------------------------------------------------------------------

export function SessionInfoBody({
  session,
  worktreeId,
  usageInfo,
  actions,
}: Pick<
  SessionInfoContentProps,
  "session" | "worktreeId" | "usageInfo" | "actions"
>) {
  return (
    <>
      {/* Urgent banners */}
      {session.isActive === false && (
        <ReconnectBanner
          onReconnect={actions.onReconnect}
          isReconnecting={actions.isReconnecting}
        />
      )}

      {/* Collapsible sections */}
      <PanelSection icon={GitMerge} label="Git" defaultOpen>
        <GitInfoPanel cwd={session.cwd} worktreeId={worktreeId} />
      </PanelSection>

      <PanelSection icon={Info} label="Session Info">
        <div className="space-y-1.5 text-xs text-muted-foreground px-1 pb-1">
          {usageInfo && usageInfo.size > 0 && (
            <ContextMeter usage={usageInfo} compact />
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 shrink-0" />
            <span>Started {new Date(session.createdAt).toLocaleString()}</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/60 break-all select-all">
            {session.id}
          </div>
        </div>
      </PanelSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Actions footer
// ---------------------------------------------------------------------------

export function SessionInfoActions({
  session,
  branch,
  projectId,
  actions,
  onStartReview,
  onSendMessage,
}: Pick<
  SessionInfoContentProps,
  | "session"
  | "branch"
  | "projectId"
  | "actions"
  | "onStartReview"
  | "onSendMessage"
>) {
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isTerminal =
    session.status === "completed" || session.status === "killed";
  const isActiveSession = !isTerminal && session.isActive !== false;
  const hasGitActions =
    branch && !isTerminal && (actions.onPushToOrigin || actions.onCommit);

  return (
    <>
      {/* Session lifecycle */}
      {(!isTerminal || session.isActive === false) && (
        <div className="flex flex-wrap gap-1.5">
          {!isTerminal && actions.onCompleteSession && (
            <Button
              className="flex-1"
              variant="success"
              disabled={actions.isCompleting || session.status === "running"}
              onClick={actions.onCompleteSession}
            >
              {actions.isCompleting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle />
              )}
              {actions.isCompleting ? "Completing\u2026" : "Complete"}
            </Button>
          )}

          {isActiveSession && (
            <Button
              className="flex-1"
              variant="destructive"
              disabled={actions.isKilling}
              onClick={() => setKillConfirmOpen(true)}
            >
              {actions.isKilling ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Square />
              )}
              {actions.isKilling ? "Killing\u2026" : "Kill"}
            </Button>
          )}

          {session.isActive === false && actions.onDeleteSession && (
            <Button
              className="flex-1"
              variant="destructive"
              disabled={actions.isDeleting}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {actions.isDeleting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              {actions.isDeleting ? "Deleting\u2026" : "Delete"}
            </Button>
          )}
        </div>
      )}

      {/* Git actions */}
      {hasGitActions && (
        <GitActionsGrid
          actions={actions}
          agentBusy={session.status === "running"}
          branch={branch}
          projectId={projectId}
        />
      )}

      {/* Document actions */}
      {isActiveSession && onSendMessage && (
        <DocumentActionMenu
          onSendMessage={onSendMessage}
          disabled={session.status === "running"}
        />
      )}

      {/* Code review */}
      {onStartReview && branch && (
        <Button
          variant="outline"
          onClick={onStartReview}
          className="w-full justify-center"
        >
          <GitMerge />
          Code Review
        </Button>
      )}

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={killConfirmOpen}
        onOpenChange={setKillConfirmOpen}
        title="Kill Session"
        description="Kill this session? The agent process will be terminated."
        confirmLabel="Kill"
        variant="destructive"
        onConfirm={() => {
          setKillConfirmOpen(false);
          actions.onKillSession();
        }}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Session"
        description="Delete this session permanently? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          actions.onDeleteSession?.();
        }}
      />
    </>
  );
}
