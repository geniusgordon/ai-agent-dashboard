import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  Loader2,
  Pause,
  Pencil,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentBadge, BranchBadge, StatusBadge } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentSession } from "@/lib/agents/types";

export interface SessionHeaderProps {
  session: AgentSession;
  connected: boolean;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClearLogs: () => void;
  onKillSession: () => void;
  isKilling: boolean;
  onRename: (name: string) => void;
  isRenaming: boolean;
  onDeleteSession?: () => void;
  isDeleting?: boolean;
  /** Override back-link target (defaults to /dashboard) */
  backTo?: string;
  /** Branch name for the worktree this session is assigned to */
  branch?: string;
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
  isRenaming,
  onDeleteSession,
  isDeleting,
  backTo = "/dashboard",
  branch,
}: SessionHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const wasRenaming = useRef(false);

  // Close edit form when rename mutation completes
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

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        {/* Row 1 — Identity: back, agent, name, connection */}
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon-sm" asChild className="shrink-0">
            <Link to={backTo}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <AgentBadge type={session.agentType} size="sm" />

          {/* Session name or inline edit */}
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

          {/* Connection indicator — far right */}
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

        {/* Row 2 — Context & Actions: status, branch, controls */}
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={session.status} />
          {branch && <BranchBadge branch={branch} size="sm" />}

          <div className="flex-1" />

          {/* Log controls */}
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

          {/* Separator between log controls and destructive actions */}
          {(isActiveSession || session.isActive === false) && (
            <Separator orientation="vertical" className="h-4" />
          )}

          {/* Destructive actions */}
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
      </div>
    </TooltipProvider>
  );
}
