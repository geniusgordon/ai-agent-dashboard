import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  FolderGit2,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequestCreate,
  Info,
  Loader2,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { GitInfoPanel } from "@/components/dashboard/GitInfoPanel";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ReconnectBanner } from "@/components/dashboard/ReconnectBanner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import type { AgentSession } from "@/lib/agents/types";

export interface SessionMobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentSession;
  connected: boolean;
  branch?: string;
  worktreeId?: string;
  projectName?: string;
  projectId?: string;
  actions: {
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
  projectId,
  actions,
  onStartReview,
}: SessionMobileDrawerProps) {
  const isTerminal =
    session.status === "completed" || session.status === "killed";
  const isActiveSession = !isTerminal && session.isActive !== false;
  const hasGitActions =
    branch && !isTerminal && (actions.onPushToOrigin || actions.onCommit);

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
        <DrawerFooter className="border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
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

          {/* Git actions */}
          {hasGitActions && (
            <MobileGitActions
              actions={actions}
              session={session}
              branch={branch}
              projectId={projectId}
            />
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

// ---------------------------------------------------------------------------
// Mobile Git Actions (internal)
// ---------------------------------------------------------------------------

function MobileGitActions({
  actions,
  session,
  branch,
  projectId,
}: {
  actions: SessionMobileDrawerProps["actions"];
  session: AgentSession;
  branch?: string;
  projectId?: string;
}) {
  const agentBusy = session.status === "running";

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
            onClick={() => {
              if (confirm(`Push ${branch ?? "branch"} to origin?`)) {
                actions.onPushToOrigin?.();
              }
            }}
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
          <MobileBranchSelectPopover
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
          <MobileBranchSelectPopover
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch select popover for mobile (internal)
// ---------------------------------------------------------------------------

function MobileBranchSelectPopover({
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
