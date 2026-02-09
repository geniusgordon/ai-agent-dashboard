import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentBadge } from "@/components/dashboard/AgentBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentSession } from "@/lib/agents/types";

export interface SessionContextHeaderProps {
  session: AgentSession;
  connected: boolean;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClearLogs: () => void;
  backTo: string;
  backParams?: Record<string, string>;
  onRename: (name: string) => void;
  isRenaming: boolean;
  /** Desktop: toggle right panel visibility */
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  /** Mobile: open the bottom drawer */
  onOpenMobileDrawer?: () => void;
}

export function SessionContextHeader({
  session,
  connected,
  autoScroll,
  onToggleAutoScroll,
  onClearLogs,
  backTo,
  backParams,
  onRename,
  isRenaming,
  panelOpen,
  onTogglePanel,
  onOpenMobileDrawer,
}: SessionContextHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const wasRenaming = useRef(false);

  useEffect(() => {
    if (wasRenaming.current && !isRenaming) {
      setIsEditing(false);
    }
    wasRenaming.current = isRenaming;
  }, [isRenaming]);

  const startEdit = () => {
    setEditName(session.name || "");
    setIsEditing(true);
  };

  const submitEdit = () => onRename(editName);
  const cancelEdit = () => setIsEditing(false);

  return (
    <TooltipProvider>
      <div className="sticky top-0 z-20 flex items-center gap-2 h-10 px-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        {/* Left: back + identity */}
        <Button variant="ghost" size="icon-sm" asChild className="shrink-0">
          <Link to={backTo} params={backParams}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <AgentBadge type={session.agentType} size="sm" />

        {/* Editable name */}
        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitEdit();
            }}
            className="flex items-center gap-1.5 min-w-0"
          >
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-6 text-xs font-mono max-w-48"
              autoFocus
            />
            <Button type="submit" variant="success" size="xs">
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            className="font-mono text-sm text-muted-foreground cursor-pointer hover:text-foreground inline-flex items-center gap-1 transition-colors truncate min-w-0"
            onClick={startEdit}
          >
            <span className="truncate">
              {session.name || session.id.slice(0, 8)}
            </span>
            <Pencil className="size-3 text-muted-foreground/50 shrink-0" />
          </button>
        )}

        <StatusBadge status={session.status} />

        {/* Connection indicator */}
        {connected ? (
          <span className="text-xs font-medium text-live flex items-center gap-1.5 shadow-live-glow shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
            </span>
            Live
          </span>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Loader2 className="size-3 animate-spin" />
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: log controls + panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={autoScroll ? "success" : "ghost"}
              size="icon-xs"
              onClick={onToggleAutoScroll}
            >
              {autoScroll ? (
                <ArrowDownToLine className="size-3.5" />
              ) : (
                <Pause className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Auto-scroll {autoScroll ? "ON" : "OFF"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={onClearLogs}>
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Clear logs</TooltipContent>
        </Tooltip>

        {/* Mobile: open drawer */}
        {onOpenMobileDrawer && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onOpenMobileDrawer}
              >
                <PanelRightOpen className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Session details</TooltipContent>
          </Tooltip>
        )}

        {/* Desktop: toggle right panel */}
        {onTogglePanel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={onTogglePanel}>
                {panelOpen ? (
                  <PanelRightClose className="size-3.5" />
                ) : (
                  <PanelRightOpen className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {panelOpen ? "Collapse panel" : "Expand panel"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
