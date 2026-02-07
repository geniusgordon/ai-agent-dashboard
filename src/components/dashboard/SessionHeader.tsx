import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock,
  FolderGit2,
  Loader2,
  Square,
} from "lucide-react";
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AgentSession } from "@/lib/agents/types";

export interface SessionHeaderProps {
  session: AgentSession;
  onKillSession: () => void;
  isKilling: boolean;
  /** Back link target — string path or object for Link `to` */
  backTo?: string;
  /** Route params for the back link (e.g., { projectId }) */
  backParams?: Record<string, string>;
  /** Project name to display in metadata row */
  projectName?: string;
}

export function SessionHeader({
  session,
  onKillSession,
  isKilling,
  backTo,
  backParams,
  projectName,
}: SessionHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-1">
      {/* Row 1: Back + Title + Badges + Kill */}
      <div className="flex items-center gap-3">
        {backTo && (
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link to={backTo} params={backParams}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate">{session.name}</h1>
          <AgentBadge type={session.agentType} iconOnly={isMobile} />
          <StatusBadge status={session.status} />
        </div>

        {session.status === "running" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onKillSession}
            disabled={isKilling}
            className="shrink-0"
          >
            {isKilling ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Square className="mr-1 h-3 w-3" />
            )}
            <span className="hidden md:inline">Kill Session</span>
            <span className="md:hidden">Kill</span>
          </Button>
        )}
      </div>

      {/* Row 2: Metadata */}
      <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="truncate">
          Started{" "}
          {isMobile
            ? new Date(session.createdAt).toLocaleTimeString()
            : new Date(session.createdAt).toLocaleString()}
        </span>
        {projectName && (
          <>
            <FolderGit2 className="ml-1 h-3 w-3 shrink-0" />
            <span className="truncate">{projectName}</span>
          </>
        )}
        <span className="hidden md:inline font-mono text-[10px]">
          {session.id}
        </span>
      </div>
    </div>
  );
}
