import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ApprovalBanner,
  MessageInput,
  PlanDocumentViewer,
  ReconnectBanner,
  SessionContextHeader,
  SessionLog,
  SessionMobileDrawer,
  SessionRightPanel,
  StartReviewDialog,
  TaskPanel,
} from "@/components/dashboard";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useHeaderSlot } from "@/hooks/useHeaderSlot";
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
  const { container: headerSlotContainer, setSlotActive } = useHeaderSlot();
  const isDesktop = useIsDesktop();
  const [panelOpen, setPanelOpen] = useLocalStorageState(
    "session-right-panel",
    true,
  );
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const {
    session,
    events,
    pendingApproval,
    connected,
    autoScroll,
    showScrollButton,
    supportsImages,
    latestPlan,
    planFilePath,
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

  // Tell the layout whether the slot is claimed (hides default heading).
  // setSlotActive(true) when already true is a no-op — no re-render cycle.
  useEffect(() => {
    setSlotActive(!!session);
  });

  // Render session header into the global header bar via portal.
  const headerPortal =
    session && headerSlotContainer
      ? createPortal(
          <SessionContextHeader
            session={session}
            connected={connected}
            autoScroll={autoScroll}
            onToggleAutoScroll={toggleAutoScroll}
            onClearLogs={clearLogs}
            backTo={headerBackTo}
            backParams={headerBackParams}
            onRename={renameSession}
            isRenaming={isRenaming}
            panelOpen={isDesktop ? panelOpen : undefined}
            onTogglePanel={
              isDesktop ? () => setPanelOpen((prev) => !prev) : undefined
            }
            onOpenMobileDrawer={
              !isDesktop ? () => setMobileDrawerOpen(true) : undefined
            }
          />,
          headerSlotContainer,
        )
      : null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
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
    <>
      {headerPortal}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left column: banners + log + input */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Mobile/tablet: inline banners and task panel */}
          {!isDesktop && (
            <div className="flex flex-col shrink-0">
              {session.isActive === false && (
                <div className="px-3 py-2 border-b border-border">
                  <ReconnectBanner
                    onReconnect={reconnect}
                    isReconnecting={isReconnecting}
                  />
                </div>
              )}

              {pendingApproval && (
                <div className="px-3 py-2 border-b border-border">
                  <ApprovalBanner
                    approval={pendingApproval}
                    onApprove={approve}
                    onDeny={deny}
                    isApproving={isApproving}
                    isDenying={isDenying}
                  />
                </div>
              )}

              {latestPlan && (
                <div className="px-3 py-2 border-b border-border">
                  <TaskPanel
                    entries={latestPlan.entries}
                    isCollapsed={taskPanelCollapsed}
                    onToggleCollapse={toggleTaskPanel}
                  />
                </div>
              )}

              {planFilePath && (
                <div className="px-3 py-2 border-b border-border">
                  <PlanDocumentViewer filePath={planFilePath} />
                </div>
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
                pendingApproval
                  ? "Waiting for approval..."
                  : "Send a message..."
              }
              supportsImages={supportsImages}
              availableModes={session.availableModes}
              currentModeId={session.currentModeId}
              onSetMode={setMode}
              isSettingMode={isSettingMode}
            />
          )}
        </div>

        {/* Right column */}
        {isDesktop ? (
          <SessionRightPanel
            isOpen={panelOpen}
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
            tasks={{
              latestPlan,
              planFilePath,
              taskPanelCollapsed,
              onToggleTaskPanel: toggleTaskPanel,
            }}
            onStartReview={
              canStartReview ? () => setReviewDialogOpen(true) : undefined
            }
          />
        ) : (
          <SessionMobileDrawer
            open={mobileDrawerOpen}
            onOpenChange={setMobileDrawerOpen}
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
            tasks={{
              latestPlan,
              planFilePath,
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
    </>
  );
}
