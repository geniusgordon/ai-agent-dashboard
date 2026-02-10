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
import { GitInfoPanel } from "@/components/dashboard/GitInfoPanel";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { PlanDocumentViewer } from "@/components/dashboard/PlanDocumentViewer";
import { ReconnectBanner } from "@/components/dashboard/ReconnectBanner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type {
  AgentSession,
  ApprovalRequest,
  PlanPayload,
} from "@/lib/agents/types";

export interface SessionMobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentSession;
  connected: boolean;
  branch?: string;
  worktreeId?: string;
  projectName?: string;
  approval: {
    pendingApproval: ApprovalRequest | null;
    onApprove: (approvalId: string, optionId: string) => void;
    onDeny: (approvalId: string) => void;
    isApproving: boolean;
    isDenying: boolean;
  };
  actions: {
    onKillSession: () => void;
    isKilling: boolean;
    onCompleteSession?: () => void;
    isCompleting: boolean;
    onDeleteSession?: () => void;
    isDeleting: boolean;
    onReconnect: () => void;
    isReconnecting: boolean;
  };
  tasks: {
    latestPlan: PlanPayload | null;
    planFilePath: string | null;
    taskPanelCollapsed: boolean;
    onToggleTaskPanel: () => void;
  };
  onStartReview?: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SessionMobileDrawer({
  open,
  onOpenChange,
  session,
  connected,
  branch,
  worktreeId,
  projectName,
  approval,
  actions,
  tasks,
  onStartReview,
}: SessionMobileDrawerProps) {
  const isTerminal =
    session.status === "completed" || session.status === "killed";
  const isActiveSession = !isTerminal && session.isActive !== false;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <AgentBadge type={session.agentType} size="sm" />
            <span className="font-mono text-sm truncate">
              {session.name || session.id.slice(0, 8)}
            </span>
            <StatusBadge status={session.status} />
            {connected ? (
              <span className="text-xs font-medium text-live flex items-center gap-1.5 ml-auto">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
                </span>
                Live
              </span>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-auto">
                <Loader2 className="size-3 animate-spin" />
              </span>
            )}
          </DrawerTitle>

          {/* Metadata row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Clock className="size-3 shrink-0" />
            <span>{new Date(session.createdAt).toLocaleTimeString()}</span>
            {projectName && (
              <>
                <FolderGit2 className="ml-1 size-3 shrink-0" />
                <span className="truncate">{projectName}</span>
              </>
            )}
            {branch && <BranchBadge branch={branch} size="sm" />}
          </div>
        </DrawerHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3">
          {/* Urgent banners */}
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

          {/* Collapsible sections */}
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
            <GitInfoPanel cwd={session.cwd} worktreeId={worktreeId} />
          </PanelSection>

          <PanelSection icon={Info} label="Session Info">
            <div className="space-y-1.5 text-xs text-muted-foreground px-1 pb-1">
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

        {/* Action footer — always visible */}
        <DrawerFooter className="border-t border-border pb-[env(safe-area-inset-bottom)]">
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
