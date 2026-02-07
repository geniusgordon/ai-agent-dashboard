import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  ApprovalBanner,
  MessageInput,
  ReconnectBanner,
  SessionHeader,
  SessionLog,
} from "@/components/dashboard";
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
  const hasProject = typeof projectId === "string";

  const assignmentsQuery = useQuery({
    ...trpc.projects.getAssignments.queryOptions({
      projectId: projectId ?? "",
    }),
    enabled: hasProject,
  });
  const projectQuery = useQuery({
    ...trpc.projects.get.queryOptions({ id: projectId ?? "" }),
    enabled: hasProject,
  });
  const worktreesQuery = useQuery({
    ...trpc.worktrees.list.queryOptions({ projectId: projectId ?? "" }),
    enabled: hasProject,
  });
  const branch = hasProject
    ? (() => {
        const assignment = assignmentsQuery.data?.find(
          (a) => a.sessionId === sessionId,
        );
        if (!assignment) return undefined;
        const worktree = worktreesQuery.data?.find(
          (w) => w.id === assignment.worktreeId,
        );
        return worktree?.branch;
      })()
    : undefined;

  const {
    session,
    events,
    pendingApproval,
    connected,
    autoScroll,
    showScrollButton,
    supportsImages,
    logsEndRef,
    logContainerRef,
    isLoading,
    isAgentBusy,
    isKilling,
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
    renameSession,
    setMode,
    reconnect,
    deleteSession,
    clearLogs,
    toggleAutoScroll,
    manualScrollToBottom,
  } = useSessionDetail(sessionId);

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

  return (
    <div className="h-[calc(100dvh-3.5rem-2rem)] sm:h-[calc(100dvh-3.5rem-3rem)] lg:h-[calc(100dvh-3.5rem-4rem)] flex flex-col gap-3">
      <SessionHeader
        session={session}
        connected={connected}
        autoScroll={autoScroll}
        onToggleAutoScroll={toggleAutoScroll}
        onClearLogs={clearLogs}
        onKillSession={killSession}
        isKilling={isKilling}
        onRename={renameSession}
        isRenaming={isRenaming}
        backTo={headerBackTo}
        backParams={headerBackParams}
        onDeleteSession={() => {
          deleteSession();
          onAfterDelete();
        }}
        isDeleting={isDeleting}
        branch={branch}
        projectName={projectQuery.data?.name}
      />

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

      <SessionLog
        events={events}
        logsEndRef={logsEndRef}
        containerRef={logContainerRef}
        showScrollButton={showScrollButton}
        onScrollToBottom={manualScrollToBottom}
      />

      {session.status !== "completed" &&
        session.status !== "killed" &&
        session.status !== "error" && (
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
  );
}
