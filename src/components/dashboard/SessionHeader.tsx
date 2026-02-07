import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronDown,
  Loader2,
  Pause,
  Pencil,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentBadge, StatusBadge } from "@/components/dashboard";
import type { AgentSession, SessionMode } from "@/lib/agents/types";

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
  onSetMode?: (modeId: string) => void;
  isSettingMode?: boolean;
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
  onSetMode,
  isSettingMode,
}: SessionHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const wasRenaming = useRef(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  // Close mode dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modeDropdownRef.current &&
        !modeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowModeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close edit form when rename mutation completes
  useEffect(() => {
    if (wasRenaming.current && !isRenaming) {
      setIsEditingName(false);
    }
    wasRenaming.current = isRenaming;
  }, [isRenaming]);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link
          to="/dashboard/sessions"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200 cursor-pointer shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <AgentBadge type={session.agentType} size="sm" />
            <StatusBadge status={session.status} />
            {/* Mode Selector */}
            {session.availableModes && session.availableModes.length > 0 && (
              <div className="relative" ref={modeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  disabled={isSettingMode}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-md transition-colors duration-200 cursor-pointer disabled:opacity-50"
                >
                  {isSettingMode ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <>
                      {session.availableModes.find(
                        (m) => m.id === session.currentModeId
                      )?.name || session.currentModeId || "Mode"}
                      <ChevronDown className="size-3" />
                    </>
                  )}
                </button>
                {showModeDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] bg-card border border-border rounded-lg shadow-lg py-1">
                    {session.availableModes.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          onSetMode?.(mode.id);
                          setShowModeDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors duration-150 cursor-pointer ${
                          mode.id === session.currentModeId
                            ? "text-primary font-medium"
                            : "text-foreground"
                        }`}
                      >
                        <div>{mode.name}</div>
                        {mode.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {mode.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
          {/* Editable Session Name */}
          {isEditingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onRename(editName);
              }}
              className="flex items-center gap-2 mt-1.5"
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="px-2.5 py-1 text-sm bg-card border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow duration-200"
                autoFocus
              />
              <button
                type="submit"
                className="text-xs font-medium text-action-success-hover hover:text-action-success-hover/80 transition-colors duration-200 cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="font-mono text-sm text-muted-foreground mt-1 cursor-pointer hover:text-foreground inline-flex items-center gap-1.5 transition-colors duration-200"
              onClick={() => {
                setEditName(session.name || "");
                setIsEditingName(true);
              }}
              title="Click to rename"
            >
              {session.name || session.id.slice(0, 8)}
              <Pencil className="size-3 text-muted-foreground/50" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onClearLogs}
          className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5"
          title="Clear logs"
        >
          <Trash2 className="size-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
        <button
          type="button"
          onClick={onToggleAutoScroll}
          className={`
            p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5
            ${
              autoScroll
                ? "bg-action-success/20 text-action-success-hover"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }
          `}
          title={`Auto-scroll ${autoScroll ? "ON" : "OFF"}`}
        >
          {autoScroll ? (
            <ArrowDownToLine className="size-3.5" />
          ) : (
            <Pause className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {autoScroll ? "Auto-scroll" : "Paused"}
          </span>
        </button>
        {session.status !== "completed" && session.status !== "killed" && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Kill this session?")) {
                onKillSession();
              }
            }}
            disabled={isKilling}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm bg-action-danger/20 text-action-danger hover:bg-action-danger/30 transition-all duration-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            title="Kill session"
          >
            <Square className="size-3.5" />
            <span className="hidden sm:inline">
              {isKilling ? "Killing..." : "Kill"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
