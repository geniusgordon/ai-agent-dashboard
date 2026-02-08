import {
  ArrowDownToLine,
  CheckCircle,
  Clock,
  FolderGit2,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Square,
  Trash2,
} from "lucide-react";
import { ApprovalBanner } from "@/components/dashboard/ApprovalBanner";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { ReconnectBanner } from "@/components/dashboard/ReconnectBanner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AgentSession,
  ApprovalRequest,
  PlanPayload,
} from "@/lib/agents/types";

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

export interface LogControls {
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClearLogs: () => void;
}

export interface TaskState {
  latestPlan: PlanPayload | null;
  taskPanelCollapsed: boolean;
  onToggleTaskPanel: () => void;
}

export interface SessionRightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  session: AgentSession;
  connected: boolean;
  branch?: string;
  projectName?: string;
  approval: SessionApprovalState;
  actions: SessionActions;
  logControls: LogControls;
  tasks: TaskState;
}

export function SessionRightPanel({
  isOpen,
  onToggle,
  session,
  connected,
  branch,
  projectName,
  approval,
  actions,
  logControls,
  tasks,
}: SessionRightPanelProps) {
  const isActiveSession =
    session.status !== "completed" &&
    session.status !== "killed" &&
    session.isActive !== false;

  return (
    <TooltipProvider>
      <div className="relative flex shrink-0">
        {/* Toggle button — always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onToggle}
              aria-label={isOpen ? "Collapse panel" : "Expand panel"}
              className="absolute -left-3 top-3 z-10 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
            >
              {isOpen ? (
                <PanelRightClose className="size-3.5" />
              ) : (
                <PanelRightOpen className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isOpen ? "Collapse panel" : "Expand panel"}
          </TooltipContent>
        </Tooltip>

        {/* Collapsible aside */}
        <aside
          className={`overflow-hidden transition-[width] duration-200 ease-in-out ${isOpen ? "w-80" : "w-0"}`}
        >
          <div className="min-w-80 h-full overflow-y-auto rounded-xl border border-border bg-background/50 shadow-sm">
            <div className="p-4 space-y-4">
              {/* Status section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={session.status} />
                  {branch && <BranchBadge branch={branch} size="sm" />}
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
                </div>

                {/* Metadata */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3 shrink-0" />
                    <span className="truncate">
                      Started {new Date(session.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {projectName && (
                    <div className="flex items-center gap-1.5">
                      <FolderGit2 className="size-3 shrink-0" />
                      <span className="truncate">{projectName}</span>
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-muted-foreground/60 truncate">
                    {session.id}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon-xs"
                      onClick={logControls.onClearLogs}
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear logs</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={logControls.autoScroll ? "success" : "secondary"}
                      size="icon-xs"
                      onClick={logControls.onToggleAutoScroll}
                    >
                      {logControls.autoScroll ? <ArrowDownToLine /> : <Pause />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Auto-scroll {logControls.autoScroll ? "ON" : "OFF"}
                  </TooltipContent>
                </Tooltip>

                {(isActiveSession || session.isActive === false) && (
                  <Separator orientation="vertical" className="mx-1 h-4" />
                )}

                {isActiveSession && actions.onCompleteSession && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="success"
                        size="icon-xs"
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
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {actions.isCompleting
                        ? "Completing..."
                        : session.status === "running"
                          ? "Wait for agent to finish"
                          : "Mark complete"}
                    </TooltipContent>
                  </Tooltip>
                )}

                {isActiveSession && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon-xs"
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
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {actions.isKilling ? "Killing..." : "Kill session"}
                    </TooltipContent>
                  </Tooltip>
                )}

                {session.isActive === false && actions.onDeleteSession && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon-xs"
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
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {actions.isDeleting ? "Deleting..." : "Delete session"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <Separator />

              {/* Reconnect banner */}
              {session.isActive === false && (
                <ReconnectBanner
                  onReconnect={actions.onReconnect}
                  isReconnecting={actions.isReconnecting}
                />
              )}

              {/* Approval banner */}
              {approval.pendingApproval && (
                <ApprovalBanner
                  approval={approval.pendingApproval}
                  onApprove={approval.onApprove}
                  onDeny={approval.onDeny}
                  isApproving={approval.isApproving}
                  isDenying={approval.isDenying}
                />
              )}

              {/* Task panel */}
              {tasks.latestPlan && (
                <TaskPanel
                  entries={tasks.latestPlan.entries}
                  isCollapsed={tasks.taskPanelCollapsed}
                  onToggleCollapse={tasks.onToggleTaskPanel}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
