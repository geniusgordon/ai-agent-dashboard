import {
  ArrowDownToLine,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderGit2,
  GitMerge,
  Info,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { ApprovalBanner } from "@/components/dashboard/ApprovalBanner";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { GitInfoPanel } from "@/components/dashboard/GitInfoPanel";
import { ReconnectBanner } from "@/components/dashboard/ReconnectBanner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  onStartReview?: () => void;
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function PanelSection({
  icon: Icon,
  label,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 py-2 px-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <Icon className="size-3.5 shrink-0" />
        <span className="uppercase tracking-wide">{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  onStartReview,
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
          className={`overflow-hidden transition-[width] duration-200 ease-in-out ${isOpen ? "w-72" : "w-0"}`}
        >
          <div className="min-w-72 h-full overflow-y-auto rounded-xl border border-border bg-background/50 shadow-sm">
            {/* ── Panel header ─────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 border-b border-border space-y-2">
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

              {/* Row 3: Project + branch (if available) */}
              {(projectName || branch) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {projectName && (
                    <span className="flex items-center gap-1 truncate">
                      <FolderGit2 className="size-3 shrink-0" />
                      {projectName}
                    </span>
                  )}
                  {branch && <BranchBadge branch={branch} size="sm" />}
                </div>
              )}
            </div>

            {/* ── Urgent banners ───────────────────────────── */}
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

            {/* ── Actions ──────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-border space-y-2">
              {/* Session lifecycle */}
              {(isActiveSession || session.isActive === false) && (
                <div className="flex flex-wrap gap-1.5">
                  {isActiveSession && actions.onCompleteSession && (
                    <Button
                      variant="success"
                      size="xs"
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
                      variant="destructive"
                      size="xs"
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
                      variant="destructive"
                      size="xs"
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

              {/* Log controls */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={logControls.autoScroll ? "success" : "secondary"}
                  size="xs"
                  onClick={logControls.onToggleAutoScroll}
                >
                  {logControls.autoScroll ? <ArrowDownToLine /> : <Pause />}
                  Auto-scroll {logControls.autoScroll ? "ON" : "OFF"}
                </Button>

                <Button
                  variant="secondary"
                  size="xs"
                  onClick={logControls.onClearLogs}
                >
                  <Trash2 />
                  Clear logs
                </Button>
              </div>

              {/* Code review */}
              {onStartReview && branch && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onStartReview}
                  className="w-full justify-center"
                >
                  <GitMerge />
                  Code Review
                </Button>
              )}
            </div>

            {/* ── Collapsible sections ─────────────────────── */}
            <div className="px-4 py-2 space-y-1">
              {/* Tasks */}
              {tasks.latestPlan && (
                <TaskPanel
                  entries={tasks.latestPlan.entries}
                  isCollapsed={tasks.taskPanelCollapsed}
                  onToggleCollapse={tasks.onToggleTaskPanel}
                />
              )}

              {/* Git info */}
              <PanelSection icon={GitMerge} label="Git" defaultOpen>
                <GitInfoPanel cwd={session.cwd} />
              </PanelSection>

              {/* Session metadata */}
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
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
