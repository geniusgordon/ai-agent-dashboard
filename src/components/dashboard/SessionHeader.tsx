import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  Clock,
  FolderGit2,
  Loader2,
  Pause,
  Pencil,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AgentSession } from "@/lib/agents/types";
import { isSessionActive } from "@/lib/agents/types";

export interface SessionHeaderProps {
  session: AgentSession;
  connected?: boolean;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
  onClearLogs?: () => void;
  onKillSession: () => void;
  isKilling: boolean;
  onRename?: (name: string) => void;
  isRenaming?: boolean;
  onDeleteSession?: () => void;
  isDeleting?: boolean;
  /** Back link target — string path or object for Link `to` */
  backTo?: string;
  /** Route params for the back link (e.g., { projectId }) */
  backParams?: Record<string, string>;
  /** Branch name for the worktree this session is assigned to */
  branch?: string;
  /** Project name to display in metadata row */
  projectName?: string;
}

export function SessionHeader({
  session,
  connected,
  autoScroll,
  onToggleAutoScroll,
  onClearLogs,
  onKillSession,
  isKilling,
  onRename,
  isRenaming = false,
  onDeleteSession,
  isDeleting = false,
  backTo,
  backParams,
  branch,
  projectName,
}: SessionHeaderProps) {
  const isMobile = useIsMobile();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const wasRenaming = useRef(false);

  const showEnhancedControls =
    typeof connected === "boolean" &&
    typeof autoScroll === "boolean" &&
    !!onToggleAutoScroll &&
    !!onClearLogs &&
    !!onRename;

  useEffect(() => {
    if (wasRenaming.current && !isRenaming) {
      setIsEditingName(false);
    }
    wasRenaming.current = isRenaming;
  }, [isRenaming]);

  const isActiveSession =
    session.status !== "completed" &&
    session.status !== "killed" &&
    session.isActive !== false;

  if (showEnhancedControls) {
    return (
      <TooltipProvider>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {backTo && (
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="shrink-0"
              >
                <Link to={backTo} params={backParams}>
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            )}

            <AgentBadge type={session.agentType} size="sm" />

            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(editName);
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm font-mono max-w-64"
                    autoFocus
                  />
                  <Button type="submit" variant="success" size="xs">
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsEditingName(false)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  className="font-mono text-sm text-muted-foreground cursor-pointer hover:text-foreground inline-flex items-center gap-1.5 transition-colors duration-200 truncate max-w-full"
                  onClick={() => {
                    setEditName(session.name || "");
                    setIsEditingName(true);
                  }}
                >
                  <span className="truncate">
                    {session.name || session.id.slice(0, 8)}
                  </span>
                  <Pencil className="size-3 text-muted-foreground/50 shrink-0" />
                </button>
              )}
            </div>

            <div className="shrink-0">
              {connected ? (
                <span className="text-xs font-medium text-live flex items-center gap-1.5 shadow-live-glow">
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
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge status={session.status} />
            {branch && <BranchBadge branch={branch} size="sm" />}

            <div className="flex-1" />

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon-xs"
                    onClick={onClearLogs}
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Clear logs</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={autoScroll ? "success" : "secondary"}
                    size="icon-xs"
                    onClick={onToggleAutoScroll}
                  >
                    {autoScroll ? <ArrowDownToLine /> : <Pause />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Auto-scroll {autoScroll ? "ON" : "OFF"}
                </TooltipContent>
              </Tooltip>
            </div>

            {(isActiveSession || session.isActive === false) && (
              <Separator orientation="vertical" className="h-4" />
            )}

            <div className="flex items-center gap-1">
              {isActiveSession && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      disabled={isKilling}
                      onClick={() => {
                        if (confirm("Kill this session?")) {
                          onKillSession();
                        }
                      }}
                    >
                      {isKilling ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Square />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isKilling ? "Killing..." : "Kill session"}
                  </TooltipContent>
                </Tooltip>
              )}

              {session.isActive === false && onDeleteSession && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      disabled={isDeleting}
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this session permanently? This cannot be undone.",
                          )
                        ) {
                          onDeleteSession();
                        }
                      }}
                    >
                      {isDeleting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isDeleting ? "Deleting..." : "Delete session"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
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
      </TooltipProvider>
    );
  }

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

        {isSessionActive(session.status) && (
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
