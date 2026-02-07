/**
 * Project-Scoped Session Detail Page
 *
 * Same UI as the global session detail, but with project-scoped back links.
 * Reuses useSessionDetail for all orchestration logic.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  ApprovalBanner,
  MessageInput,
  ReconnectBanner,
  SessionHeader,
  SessionLog,
} from "@/components/dashboard";
import { useSessionDetail } from "@/hooks/useSessionDetail";

export const Route = createFileRoute(
  "/dashboard/p/$projectId/sessions/$sessionId",
)({
  component: ProjectSessionDetailPage,
});

function ProjectSessionDetailPage() {
  const { projectId, sessionId } = Route.useParams();
  const navigate = useNavigate();
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
          to="/dashboard/p/$projectId/sessions"
          params={{ projectId }}
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
        onSetMode={setMode}
        isSettingMode={isSettingMode}
        onDeleteSession={() => {
          deleteSession();
          navigate({
            to: "/dashboard/p/$projectId/sessions",
            params: { projectId },
          });
        }}
        isDeleting={isDeleting}
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
          />
        )}
    </div>
  );
}
