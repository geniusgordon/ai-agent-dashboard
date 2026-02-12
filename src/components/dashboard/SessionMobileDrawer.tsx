import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { AgentSession, UsageUpdatePayload } from "@/lib/agents/types";
import type { SessionActions } from "./SessionInfoContent";
import {
  SessionInfoActions,
  SessionInfoBody,
  SessionInfoHeader,
} from "./SessionInfoContent";

export interface SessionMobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentSession;
  connected: boolean;
  branch?: string;
  worktreeId?: string;
  projectName?: string;
  projectId?: string;
  actions: SessionActions;
  usageInfo?: UsageUpdatePayload;
  onStartReview?: () => void;
  onSendMessage?: (message: string) => void;
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
  usageInfo,
  onStartReview,
  onSendMessage,
}: SessionMobileDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle asChild>
            <div>
              <SessionInfoHeader
                session={session}
                connected={connected}
                projectName={projectName}
                branch={branch}
              />
            </div>
          </DrawerTitle>
        </DrawerHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3">
          <SessionInfoBody
            session={session}
            worktreeId={worktreeId}
            usageInfo={usageInfo}
            actions={actions}
          />
        </div>

        {/* Action footer */}
        <DrawerFooter className="border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SessionInfoActions
            session={session}
            branch={branch}
            projectId={projectId}
            actions={actions}
            onStartReview={onStartReview}
            onSendMessage={onSendMessage}
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
