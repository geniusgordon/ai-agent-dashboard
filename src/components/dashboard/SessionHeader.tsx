import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle,
  Clock,
  EllipsisVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// ---------------------------------------------------------------------------
// Shared sub-components (file-local, not exported)
// ---------------------------------------------------------------------------

function BackButton({
  to,
  params,
}: {
  to: string;
  params?: Record<string, string>;
}) {
  return (
    <Button variant="ghost" size="icon-sm" asChild className="shrink-0">
      <Link to={to} params={params}>
        <ArrowLeft className="size-4" />
      </Link>
    </Button>
  );
}

function ConnectionIndicator({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="text-xs font-medium text-live flex items-center gap-1.5 shadow-live-glow shrink-0">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
      <Loader2 className="size-3 animate-spin" />
      Connecting
    </span>
  );
}

function EditableSessionName({
  session,
  isEditing,
  editName,
  onEditNameChange,
  onStartEdit,
  onSubmit,
  onCancel,
  inputMaxWidth = "max-w-64",
}: {
  session: AgentSession;
  isEditing: boolean;
  editName: string;
  onEditNameChange: (value: string) => void;
  onStartEdit: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  inputMaxWidth?: string;
}) {
  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          className={`h-7 text-sm font-mono ${inputMaxWidth}`}
          autoFocus
        />
        <Button type="submit" variant="success" size="xs">
          Save
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </form>
    );
  }
  return (
    <button
      type="button"
      className="font-mono text-sm text-muted-foreground cursor-pointer hover:text-foreground inline-flex items-center gap-1.5 transition-colors duration-200 truncate max-w-full"
      onClick={onStartEdit}
    >
      <span className="truncate">{session.name || session.id.slice(0, 8)}</span>
      <Pencil className="size-3 text-muted-foreground/50 shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface SessionHeaderProps {
  session: AgentSession;
  connected?: boolean;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
  onClearLogs?: () => void;
  onKillSession: () => void;
  isKilling: boolean;
  onCompleteSession?: () => void;
  isCompleting?: boolean;
  onRename?: (name: string) => void;
  isRenaming?: boolean;
  onDeleteSession?: () => void;
  isDeleting?: boolean;
  backTo?: string;
  backParams?: Record<string, string>;
  branch?: string;
  projectName?: string;
  /** Desktop mode: single row, no status/actions/metadata (right panel owns those) */
  compact?: boolean;
  /** Mobile mode: collapse actions into a kebab dropdown menu */
  kebabMenu?: boolean;
}

export function SessionHeader({
  session,
  connected,
  autoScroll,
  onToggleAutoScroll,
  onClearLogs,
  onKillSession,
  isKilling,
  onCompleteSession,
  isCompleting = false,
  onRename,
  isRenaming = false,
  onDeleteSession,
  isDeleting = false,
  backTo,
  backParams,
  branch,
  projectName,
  compact = false,
  kebabMenu = false,
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

  // Shared name-editor props (used by all enhanced branches)
  const nameProps = {
    session,
    isEditing: isEditingName,
    editName,
    onEditNameChange: setEditName,
    onStartEdit: () => {
      setEditName(session.name || "");
      setIsEditingName(true);
    },
    onSubmit: () => onRename?.(editName),
    onCancel: () => setIsEditingName(false),
  };

  // --- Compact mode (desktop): single row only ---
  if (compact && showEnhancedControls) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        {backTo && <BackButton to={backTo} params={backParams} />}
        <AgentBadge type={session.agentType} size="sm" />
        <div className="flex-1 min-w-0">
          <EditableSessionName {...nameProps} />
        </div>
        <ConnectionIndicator connected={connected} />
      </div>
    );
  }

  // --- Kebab menu mode (mobile/tablet): compact header with dropdown ---
  if (kebabMenu && showEnhancedControls) {
    return (
      <TooltipProvider>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {backTo && <BackButton to={backTo} params={backParams} />}
            <AgentBadge type={session.agentType} size="sm" />
            <div className="flex-1 min-w-0">
              <EditableSessionName {...nameProps} inputMaxWidth="max-w-48" />
            </div>
            <ConnectionIndicator connected={connected} />

            {/* Kebab dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Session actions"
                >
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onClearLogs}>
                  <Trash2 className="size-4" />
                  Clear logs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleAutoScroll}>
                  {autoScroll ? (
                    <ArrowDownToLine className="size-4" />
                  ) : (
                    <Pause className="size-4" />
                  )}
                  Auto-scroll {autoScroll ? "ON" : "OFF"}
                </DropdownMenuItem>

                {(isActiveSession || session.isActive === false) && (
                  <DropdownMenuSeparator />
                )}

                {isActiveSession && onCompleteSession && (
                  <DropdownMenuItem
                    disabled={isCompleting || session.status === "running"}
                    onClick={() => onCompleteSession()}
                  >
                    {isCompleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle className="size-4" />
                    )}
                    {isCompleting ? "Completing..." : "Mark complete"}
                  </DropdownMenuItem>
                )}

                {isActiveSession && (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isKilling}
                    onClick={() => {
                      if (confirm("Kill this session?")) {
                        onKillSession();
                      }
                    }}
                  >
                    {isKilling ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Square className="size-4" />
                    )}
                    {isKilling ? "Killing..." : "Kill session"}
                  </DropdownMenuItem>
                )}

                {session.isActive === false && onDeleteSession && (
                  <DropdownMenuItem
                    variant="destructive"
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
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {isDeleting ? "Deleting..." : "Delete session"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 2: Status + Branch + Metadata */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <StatusBadge status={session.status} />
            {branch && <BranchBadge branch={branch} size="sm" />}
            <span className="mx-1">&middot;</span>
            <Clock className="size-3 shrink-0" />
            <span className="truncate">
              {new Date(session.createdAt).toLocaleTimeString()}
            </span>
            {projectName && (
              <>
                <FolderGit2 className="ml-1 size-3 shrink-0" />
                <span className="truncate">{projectName}</span>
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // --- Full enhanced mode (legacy default) ---
  if (showEnhancedControls) {
    return (
      <TooltipProvider>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {backTo && <BackButton to={backTo} params={backParams} />}
            <AgentBadge type={session.agentType} size="sm" />
            <div className="flex-1 min-w-0">
              <EditableSessionName {...nameProps} />
            </div>
            <ConnectionIndicator connected={connected} />
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
              {isActiveSession && onCompleteSession && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="success"
                      size="icon-xs"
                      disabled={isCompleting || session.status === "running"}
                      onClick={() => onCompleteSession()}
                    >
                      {isCompleting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isCompleting
                      ? "Completing..."
                      : session.status === "running"
                        ? "Wait for agent to finish"
                        : "Mark complete"}
                  </TooltipContent>
                </Tooltip>
              )}

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

  // --- Simple fallback (no enhanced controls provided) ---
  return (
    <div className="flex flex-col gap-1">
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
          <div className="flex items-center gap-2 shrink-0">
            {onCompleteSession && (
              <Button
                variant="success"
                size="sm"
                onClick={onCompleteSession}
                disabled={isCompleting || session.status === "running"}
              >
                {isCompleting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1 h-3 w-3" />
                )}
                <span className="hidden md:inline">Complete</span>
                <span className="md:hidden">Done</span>
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={onKillSession}
              disabled={isKilling}
            >
              {isKilling ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Square className="mr-1 h-3 w-3" />
              )}
              <span className="hidden md:inline">Kill Session</span>
              <span className="md:hidden">Kill</span>
            </Button>
          </div>
        )}
      </div>

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
