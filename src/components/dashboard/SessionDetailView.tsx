import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, GitMerge, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  ApprovalBanner,
  MessageInput,
  ReconnectBanner,
  SessionHeader,
  SessionLog,
  SessionRightPanel,
  StartReviewDialog,
  TaskPanel,
} from "@/components/dashboard";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useSessionDetail } from "@/hooks/useSessionDetail";
import { useTRPC } from "@/integrations/trpc/react";

type RouteParams = Record<string, string>;

export interface SessionDetailViewProps {
  sessionId: string;
  projectId?: string;
  headerBackTo: string;
  headerBackParams?: RouteParams;
  notFoundBackTo: string;
  notFoundBackParams?: RouteParams;
  onAfterDelete: () => void;
}

function useLocalStorageState(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setAndPersist = (next: boolean | ((prev: boolean) => boolean)) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // localStorage full or unavailable
      }
      return resolved;
    });
  };

  return [value, setAndPersist] as const;
}

export function SessionDetailView({
  sessionId,
  projectId,
  headerBackTo,
  headerBackParams,
  notFoundBackTo,
  notFoundBackParams,
  onAfterDelete,
}: SessionDetailViewProps) {
  const trpc = useTRPC();
  const isDesktop = useIsDesktop();
  const [panelOpen, setPanelOpen] = useLocalStorageState(
    "session-right-panel",
    true,
  );
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const {
    session,
    events,
    pendingApproval,
    connected,
    autoScroll,
    showScrollButton,
    supportsImages,
    latestPlan,
    taskPanelCollapsed,
    logsEndRef,
    logContainerRef,
    isLoading,
    isAgentBusy,
    isKilling,
    isCompleting,
    isRenaming,
    isApproving,
    isDenying,
    isSettingMode,
    isReconnecting,
    isDeleting,
    sendMessage,
    approve,
    deny,
    killSession,
    completeSession,
    renameSession,
    setMode,
    reconnect,
    deleteSession,
    clearLogs,
    toggleAutoScroll,
    toggleTaskPanel,
    manualScrollToBottom,
  } = useSessionDetail(sessionId);

  // Project context comes from the session itself (stamped at assignment time)
  const resolvedProjectId = projectId ?? session?.projectId;
  const hasProject = typeof resolvedProjectId === "string";
  const branch = session?.worktreeBranch;

  const projectQuery = useQuery({
    ...trpc.projects.get.queryOptions({ id: resolvedProjectId ?? "" }),
    enabled: hasProject,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="size-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">Session not found</p>
        <p className="text-sm text-muted-foreground font-mono">{sessionId}</p>
        <Link
          to={notFoundBackTo}
          params={notFoundBackParams}
          className="mt-4 inline-flex items-center gap-1.5 text-primary hover:text-primary/80"
        >
          <ArrowLeft className="size-4" />
          Back to sessions
        </Link>
      </div>
    );
  }

  const showInput =
    session.status !== "completed" &&
    session.status !== "killed" &&
    session.status !== "error";

  const handleDelete = () => {
    deleteSession();
    onAfterDelete();
  };

  const canStartReview = !!resolvedProjectId && !!branch;

  return (
    <div className="-mx-4 sm:-mx-6 lg:mx-0 -mb-4 sm:-mb-6 lg:mb-0 h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-3.5rem-4rem)] flex flex-col lg:flex-row gap-0 lg:gap-2">
      {/* Negative margins above counteract DashboardLayout's p-4 sm:p-6 lg:p-8 for edge-to-edge mobile */}
      {/* Main column */}
      <div className="flex-1 flex flex-col gap-0 lg:gap-2 min-w-0">
        <div className="px-3 sm:px-4 lg:px-0 pt-2 lg:pt-0">
          <SessionHeader
            session={session}
            connected={connected}
            autoScroll={autoScroll}
            onToggleAutoScroll={toggleAutoScroll}
            onClearLogs={clearLogs}
            onKillSession={killSession}
            isKilling={isKilling}
            onCompleteSession={completeSession}
            isCompleting={isCompleting}
            onRename={renameSession}
            isRenaming={isRenaming}
            backTo={headerBackTo}
            backParams={headerBackParams}
            onDeleteSession={handleDelete}
            isDeleting={isDeleting}
            branch={branch}
            projectName={projectQuery.data?.name}
            compact={isDesktop}
            kebabMenu={!isDesktop}
          />
        </div>

        {/* Mobile/tablet: inline banners and task panel */}
        {!isDesktop && (
          <div className="flex flex-col gap-1.5 px-3 sm:px-4">
            {session.isActive === false && (
              <ReconnectBanner
                onReconnect={reconnect}
                isReconnecting={isReconnecting}
              />
            )}

            {pendingApproval && (
              <ApprovalBanner
                approval={pendingApproval}
                onApprove={approve}
                onDeny={deny}
                isApproving={isApproving}
                isDenying={isDenying}
              />
            )}

            {latestPlan && (
              <TaskPanel
                entries={latestPlan.entries}
                isCollapsed={taskPanelCollapsed}
                onToggleCollapse={toggleTaskPanel}
              />
            )}

            {canStartReview && (
              <button
                type="button"
                onClick={() => setReviewDialogOpen(true)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card/50 hover:bg-card text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <GitMerge className="size-3.5" />
                Code Review
              </button>
            )}
          </div>
        )}

        <SessionLog
          events={events}
          logsEndRef={logsEndRef}
          containerRef={logContainerRef}
          showScrollButton={showScrollButton}
          onScrollToBottom={manualScrollToBottom}
        />

        {showInput && (
          <MessageInput
            onSend={sendMessage}
            disabled={!!pendingApproval}
            isAgentBusy={isAgentBusy}
            placeholder={
              pendingApproval ? "Waiting for approval..." : "Send a message..."
            }
            supportsImages={supportsImages}
            availableModes={session.availableModes}
            currentModeId={session.currentModeId}
            onSetMode={setMode}
            isSettingMode={isSettingMode}
          />
        )}
      </div>

      {/* Right panel — desktop only */}
      {isDesktop && (
        <SessionRightPanel
          isOpen={panelOpen}
          onToggle={() => setPanelOpen((prev) => !prev)}
          session={session}
          connected={connected}
          branch={branch}
          projectName={projectQuery.data?.name}
          approval={{
            pendingApproval,
            onApprove: approve,
            onDeny: deny,
            isApproving,
            isDenying,
          }}
          actions={{
            onKillSession: killSession,
            isKilling,
            onCompleteSession: completeSession,
            isCompleting,
            onDeleteSession: handleDelete,
            isDeleting,
            onReconnect: reconnect,
            isReconnecting,
          }}
          logControls={{
            autoScroll,
            onToggleAutoScroll: toggleAutoScroll,
            onClearLogs: clearLogs,
          }}
          tasks={{
            latestPlan,
            taskPanelCollapsed,
            onToggleTaskPanel: toggleTaskPanel,
          }}
          onStartReview={
            canStartReview ? () => setReviewDialogOpen(true) : undefined
          }
        />
      )}

      {/* Code review dialog */}
      {canStartReview && (
        <StartReviewDialog
          projectId={resolvedProjectId}
          branch={branch}
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
        />
      )}
    </div>
  );
}
