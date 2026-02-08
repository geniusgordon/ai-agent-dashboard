import {
  Check,
  ChevronRight,
  FolderOpen,
  Timer,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { eventConfig, formatJson, formatTime } from "@/lib/agents/event-utils";
import type { AgentEvent } from "@/lib/agents/types";
import {
  isTerminalErrorContent,
  isTerminalExitContent,
} from "@/lib/agents/types";
import { CopyIconButton } from "./CopyButton";

const OUTPUT_COLLAPSE_THRESHOLD = 8;
const COLLAPSED_PREVIEW_LINES = 3;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

// ---------------------------------------------------------------------------
// Terminal Exit — structured command result
// ---------------------------------------------------------------------------

function TerminalExitEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const raw = payload.content as Record<string, unknown>;

  // Defensive defaults — guard only checks command/exitStatus/output
  const cwd = (raw.cwd as string) ?? "";
  const command = raw.command as string;
  const args = Array.isArray(raw.args) ? (raw.args as string[]) : [];
  const exitStatus = raw.exitStatus as {
    exitCode: number | null;
    signal: string | null;
  };
  const truncated = (raw.truncated as boolean) ?? false;
  const output = (raw.output as string) ?? "";
  const durationMs = (raw.durationMs as number) ?? 0;

  const succeeded = exitStatus.exitCode === 0;
  const lines = output.split("\n");
  const isLong = lines.length > OUTPUT_COLLAPSE_THRESHOLD;
  const isFailed = !succeeded;

  // Failed = always expanded. Short = expanded. Long = collapsed.
  const [isExpanded, setIsExpanded] = useState(isFailed || !isLong);

  const commandStr = [command, ...args].join(" ");
  const displayLines =
    isExpanded || !isLong ? lines : lines.slice(0, COLLAPSED_PREVIEW_LINES);
  const hiddenCount = isLong ? lines.length - COLLAPSED_PREVIEW_LINES : 0;

  return (
    <div
      className={`
        group flex gap-2.5 py-2 px-3 rounded-md border-l-2
        transition-colors duration-200 hover:bg-accent/50
        ${isFailed ? "border-l-event-error/50 bg-destructive/5" : "border-l-event-tool/50"}
      `}
    >
      {/* Timestamp */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
        <CopyIconButton text={output} />
      </div>

      {/* Icon */}
      <Wrench className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200 text-event-tool" />

      {/* Content */}
      <div className="flex-1 text-[13px] leading-relaxed min-w-0">
        {/* Header: command + status + duration */}
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-mono text-foreground">{commandStr}</code>
          {succeeded ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-event-complete font-medium">
              <Check className="size-3" />
              exit 0
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-event-error font-medium">
              <XCircle className="size-3" />
              exit {exitStatus.exitCode ?? exitStatus.signal}
            </span>
          )}
          {durationMs > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <Timer className="size-3" />
              {formatDuration(durationMs)}
            </span>
          )}
          {truncated && (
            <span className="text-[11px] text-event-warning font-medium">
              (truncated)
            </span>
          )}
        </div>

        {/* cwd */}
        {cwd && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mt-0.5">
            <FolderOpen className="size-3" />
            <span className="font-mono">{cwd}</span>
          </div>
        )}

        {/* Output block */}
        {output.length > 0 && (
          <div className="mt-1.5">
            {isLong ? (
              <button
                type="button"
                className="w-full text-left rounded-md border border-border/40 bg-secondary/30 overflow-hidden cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
              >
                <pre
                  className={`
                    px-3 py-2 text-[12px] leading-relaxed font-mono text-foreground/80
                    whitespace-pre-wrap break-all overflow-x-auto
                    ${isExpanded ? "max-h-[60vh] overflow-y-auto" : ""}
                  `}
                >
                  {displayLines.join("\n")}
                </pre>
                <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60">
                  <ChevronRight
                    className={`size-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  />
                  <span>
                    {isExpanded
                      ? "Click to collapse"
                      : `${hiddenCount} more lines`}
                  </span>
                </div>
              </button>
            ) : (
              <div className="rounded-md border border-border/40 bg-secondary/30 overflow-hidden">
                <pre className="px-3 py-2 text-[12px] leading-relaxed font-mono text-foreground/80 whitespace-pre-wrap break-all overflow-x-auto">
                  {output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal Error — always expanded
// ---------------------------------------------------------------------------

function TerminalErrorEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const raw = payload.content as Record<string, unknown>;

  const cwd = (raw.cwd as string) ?? "";
  const command = (raw.command as string) ?? "";
  const args = Array.isArray(raw.args) ? (raw.args as string[]) : [];
  const error = (raw.error as string) ?? "";

  const commandStr = [command, ...args].join(" ");

  return (
    <div className="group flex gap-2.5 py-2 px-3 rounded-md border-l-2 border-l-event-error/50 bg-destructive/5 transition-colors duration-200 hover:bg-accent/50">
      {/* Timestamp */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
      </div>

      {/* Icon */}
      <XCircle className="size-3.5 shrink-0 mt-[3px] text-event-error" />

      {/* Content */}
      <div className="flex-1 text-[13px] leading-relaxed min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-mono text-foreground">{commandStr}</code>
          <span className="inline-flex items-center gap-1 text-[11px] text-event-error font-medium">
            <XCircle className="size-3" />
            failed
          </span>
        </div>

        {cwd && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mt-0.5">
            <FolderOpen className="size-3" />
            <span className="font-mono">{cwd}</span>
          </div>
        )}

        <div className="mt-1.5 rounded-md border border-event-error/30 bg-destructive/5 px-3 py-2">
          <pre className="text-[12px] leading-relaxed font-mono text-event-error whitespace-pre-wrap break-all">
            {error}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic — fallback for non-terminal tool updates
// ---------------------------------------------------------------------------

function GenericToolUpdateEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const status = payload.status as string | undefined;
  const succeeded = status === "completed";

  const config = eventConfig["tool-update"] ?? eventConfig["tool-call"]!;

  let content: string;
  if (typeof payload.content === "string") {
    content = payload.content;
  } else if (typeof payload.content === "object" && payload.content !== null) {
    const nested = payload.content as Record<string, unknown>;
    content = (nested.text as string) ?? JSON.stringify(nested, null, 2);
  } else {
    content = JSON.stringify(payload, null, 2);
  }
  content = formatJson(content);

  const lines = content.split("\n");
  const isLong = lines.length > OUTPUT_COLLAPSE_THRESHOLD;
  const isFailed = status === "failed";
  const [isExpanded, setIsExpanded] = useState(isFailed || !isLong);

  const displayContent =
    isExpanded || !isLong
      ? content
      : lines.slice(0, COLLAPSED_PREVIEW_LINES).join("\n");
  const hiddenCount = isLong ? lines.length - COLLAPSED_PREVIEW_LINES : 0;

  if (isLong) {
    return (
      <button
        type="button"
        className={`
          group flex gap-2.5 py-2 px-3 rounded-md border-l-2 w-full text-left
          transition-colors duration-200 hover:bg-accent/50 cursor-pointer
          ${isFailed ? "border-l-event-error/50 bg-destructive/5" : config.borderColor}
          ${config.color}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        {/* Timestamp */}
        <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
          <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
            {formatTime(event.timestamp)}
          </span>
          <CopyIconButton text={content} />
        </div>

        {/* Icon */}
        <ChevronRight
          className={`size-3.5 shrink-0 mt-[3px] opacity-70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />

        {/* Content */}
        <div className="flex-1 text-[13px] leading-relaxed min-w-0">
          <span className="whitespace-pre-wrap break-all">
            {displayContent}
          </span>
          {!isExpanded && (
            <span className="text-muted-foreground/50 ml-1 text-xs">
              ({hiddenCount} more lines)
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div
      className={`
        group flex gap-2.5 py-2 px-3 rounded-md border-l-2
        transition-colors duration-200 hover:bg-accent/50
        ${isFailed ? "border-l-event-error/50 bg-destructive/5" : config.borderColor}
        ${config.color}
      `}
    >
      {/* Timestamp */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
        <CopyIconButton text={content} />
      </div>

      {/* Icon */}
      <Wrench className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />

      {/* Content */}
      <div className="flex-1 text-[13px] leading-relaxed min-w-0">
        <span className="whitespace-pre-wrap break-all">{content}</span>
        {succeeded && (
          <Check className="inline size-3.5 text-event-complete ml-2" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function ToolUpdateEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const content = payload.content;

  if (isTerminalExitContent(content)) {
    return <TerminalExitEntry event={event} />;
  }

  if (isTerminalErrorContent(content)) {
    return <TerminalErrorEntry event={event} />;
  }

  return <GenericToolUpdateEntry event={event} />;
}
