import type { AgentSession, UsageUpdatePayload } from "@/lib/agents/types";
import type { SessionActions } from "./SessionInfoContent";
import {
  SessionInfoActions,
  SessionInfoBody,
  SessionInfoHeader,
} from "./SessionInfoContent";

// ---------------------------------------------------------------------------
// Public prop types (kept for external consumers)
// ---------------------------------------------------------------------------

export type { SessionActions };

export interface SessionRightPanelProps {
  isOpen: boolean;
  session: AgentSession;
  connected: boolean;
  branch?: string;
  worktreeId?: string;
  projectName?: string;
  actions: SessionActions;
  usageInfo?: UsageUpdatePayload;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SessionRightPanel({
  isOpen,
  session,
  connected,
  branch,
  worktreeId,
  projectName,
  actions,
  usageInfo,
}: SessionRightPanelProps) {
  return (
    <aside
      className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out border-l border-border ${isOpen ? "w-72" : "w-0"}`}
    >
      <div className="min-w-72 h-full flex flex-col bg-background">
        {/* Panel header */}
        <div className="px-4 pt-3 pb-2 border-b border-border shrink-0">
          <SessionInfoHeader
            session={session}
            connected={connected}
            projectName={projectName}
            branch={branch}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 py-2 space-y-1">
            <SessionInfoBody
              session={session}
              worktreeId={worktreeId}
              usageInfo={usageInfo}
              actions={actions}
            />
          </div>
        </div>

        {/* Sticky action footer */}
        <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
          <SessionInfoActions session={session} actions={actions} />
        </div>
      </div>
    </aside>
  );
}
