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
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { ApprovalBanner } from "@/components/dashboard/ApprovalBanner";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { ContextMeter } from "@/components/dashboard/ContextMeter";
import { GitInfoPanel } from "@/components/dashboard/GitInfoPanel";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { PlanDocumentViewer } from "@/components/dashboard/PlanDocumentViewer";
import { ReconnectBanner } from "@/components/dashboard/ReconnectBanner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { Button } from "@/components/ui/button";
import type {
  AgentSession,
  ApprovalRequest,
  PlanPayload,
  UsageUpdatePayload,
} from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// Public prop types (kept for external consumers)
// ---------------------------------------------------------------------------

export interface SessionApprovalState {
  pendingApproval: ApprovalRequest | null;
  onApprove: (approvalId: string, optionId: string) => void;
  onDeny: (approvalId: string) => void;
  isApproving: boolean;
  isDenying: boolean;
}

export interface SessionActions {
  onKillSession: () => void;
  isKilling: boolean;
  onCompleteSession?: () => void;
  isCompleting: boolean;
  onDeleteSession?: () => void;
  isDeleting: boolean;
  onReconnect: () => void;
  isReconnecting: boolean;
}

export interface TaskState {
  latestPlan: PlanPayload | null;
  planFilePath: string | null;
  taskPanelCollapsed: boolean;
  onToggleTaskPanel: () => void;
}

export interface SessionRightPanelProps {
  isOpen: boolean;
  session: AgentSession;
  connected: boolean;
  branch?: string;
  projectName?: string;
  approval: SessionApprovalState;
  actions: SessionActions;
  tasks: TaskState;
  usageInfo?: UsageUpdatePayload;
  onStartReview?: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SessionRightPanel({
  isOpen,
  session,
  connected,
  branch,
  projectName,
  approval,
  actions,
  tasks,
  usageInfo,
  onStartReview,
}: SessionRightPanelProps) {
  const isTerminal =
    session.status === "completed" || session.status === "killed";
  const isActiveSession = !isTerminal && session.isActive !== false;

  return (
    <aside
      className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out border-l border-border ${isOpen ? "w-72" : "w-0"}`}
    >
      <div className="min-w-72 h-full flex flex-col bg-background">
        {/* ── Panel header ─────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 border-b border-border space-y-2 shrink-0">
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

          {/* Row 3+: Project and branch on their own rows */}
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

        {/* ── Scrollable body ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Urgent banners */}
          {(approval.pendingApproval || session.isActive === false) && (
            <div className="px-4 pt-3 space-y-3">
              {approval.pendingApproval && (
                <ApprovalBanner
                  approval={approval.pendingApproval}
                  onApprove={approval.onApprove}
                  onDeny={approval.onDeny}
                  isApproving={approval.isApproving}
                  isDenying={approval.isDenying}
                />
              )}
              {session.isActive === false && (
                <ReconnectBanner
                  onReconnect={actions.onReconnect}
                  isReconnecting={actions.isReconnecting}
                />
              )}
            </div>
          )}

          {/* Collapsible sections */}
          <div className="px-4 py-2 space-y-1">
            {tasks.latestPlan && (
              <TaskPanel
                entries={tasks.latestPlan.entries}
                isCollapsed={tasks.taskPanelCollapsed}
                onToggleCollapse={tasks.onToggleTaskPanel}
                planFilePath={tasks.planFilePath}
              />
            )}

            {!tasks.latestPlan && tasks.planFilePath && (
              <PlanDocumentViewer filePath={tasks.planFilePath} />
            )}

            <PanelSection icon={GitMerge} label="Git" defaultOpen>
              <GitInfoPanel cwd={session.cwd} />
            </PanelSection>

            <PanelSection icon={Info} label="Session Info">
              <div className="space-y-1.5 text-xs text-muted-foreground px-1 pb-1">
                {usageInfo && usageInfo.size > 0 && (
                  <ContextMeter usage={usageInfo} compact />
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3 shrink-0" />
                  <span>
                    Started {new Date(session.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/60 break-all select-all">
                  {session.id}
                </div>
              </div>
            </PanelSection>
          </div>
        </div>

        {/* ── Sticky action footer ─────────────────────── */}
        <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
          {/* Session lifecycle */}
          {(!isTerminal || session.isActive === false) && (
            <div className="flex flex-wrap gap-1.5">
              {!isTerminal && actions.onCompleteSession && (
                <Button
                  className="flex-1"
                  variant="success"
                  disabled={
                    actions.isCompleting || session.status === "running"
                  }
                  onClick={actions.onCompleteSession}
                >
                  {actions.isCompleting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckCircle />
                  )}
                  {actions.isCompleting ? "Completing…" : "Complete"}
                </Button>
              )}

              {isActiveSession && (
                <Button
                  className="flex-1"
                  variant="destructive"
                  disabled={actions.isKilling}
                  onClick={() => {
                    if (confirm("Kill this session?")) {
                      actions.onKillSession();
                    }
                  }}
                >
                  {actions.isKilling ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Square />
                  )}
                  {actions.isKilling ? "Killing…" : "Kill"}
                </Button>
              )}

              {session.isActive === false && actions.onDeleteSession && (
                <Button
                  className="flex-1"
                  variant="destructive"
                  disabled={actions.isDeleting}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this session permanently? This cannot be undone.",
                      )
                    ) {
                      actions.onDeleteSession?.();
                    }
                  }}
                >
                  {actions.isDeleting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  {actions.isDeleting ? "Deleting…" : "Delete"}
                </Button>
              )}
            </div>
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
        </div>
      </div>
    </aside>
  );
}
