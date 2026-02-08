import {
  Check,
  ChevronRight,
  Copy,
  FolderOpen,
  Timer,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { eventConfig, formatTime } from "@/lib/agents/event-utils";
import type { AgentEvent } from "@/lib/agents/types";
import {
  isTerminalErrorContent,
  isTerminalExitContent,
} from "@/lib/agents/types";

const OUTPUT_COLLAPSE_THRESHOLD = 8;
const COLLAPSED_PREVIEW_LINES = 3;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes}m${seconds}s`;
}

function formatJson(str: string): string {
  const trimmed = str.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return str;
    }
  }
  return str;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary/50 transition-all cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-3 text-action-success" />
      ) : (
        <Copy className="size-3 text-muted-foreground/50" />
      )}
    </button>
  );
}

function TerminalExitEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const content = payload.content as {
    cwd: string;
    command: string;
    args: string[];
    exitStatus: { exitCode: number | null; signal: string | null };
    truncated: boolean;
    output: string;
    durationMs: number;
  };

  const succeeded = content.exitStatus.exitCode === 0;
  const output = content.output ?? "";
  const lines = output.split("\n");
  const isLong = lines.length > OUTPUT_COLLAPSE_THRESHOLD;
  const isFailed = !succeeded;

  // Failed = always expanded. Short = expanded. Long = collapsed.
  const [isExpanded, setIsExpanded] = useState(isFailed || !isLong);

  const commandStr = [content.command, ...content.args].join(" ");
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
        <CopyButton text={output} />
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
              exit {content.exitStatus.exitCode ?? content.exitStatus.signal}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Timer className="size-3" />
            {formatDuration(content.durationMs)}
          </span>
          {content.truncated && (
            <span className="text-[11px] text-event-warning font-medium">
              (truncated)
            </span>
          )}
        </div>

        {/* cwd */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mt-0.5">
          <FolderOpen className="size-3" />
          <span className="font-mono">{content.cwd}</span>
        </div>

        {/* Output block */}
        {output.length > 0 && (
          <div className="mt-1.5">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: collapse toggle */}
            <div
              className={`
                rounded-md border border-border/40 bg-secondary/30 overflow-hidden
                ${isLong ? "cursor-pointer" : ""}
              `}
              onClick={isLong ? () => setIsExpanded(!isExpanded) : undefined}
              onKeyDown={
                isLong
                  ? (e) => e.key === "Enter" && setIsExpanded(!isExpanded)
                  : undefined
              }
              role={isLong ? "button" : undefined}
              tabIndex={isLong ? 0 : undefined}
            >
              <pre
                className={`
                  px-3 py-2 text-[12px] leading-relaxed font-mono text-foreground/80
                  whitespace-pre-wrap break-all overflow-x-auto
                  ${isExpanded && isLong ? "max-h-[60vh] overflow-y-auto" : ""}
                `}
              >
                {displayLines.join("\n")}
              </pre>
              {isLong && !isExpanded && (
                <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60">
                  <ChevronRight className="size-3" />
                  <span>{hiddenCount} more lines</span>
                </div>
              )}
              {isLong && isExpanded && (
                <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60">
                  <ChevronRight className="size-3 rotate-90" />
                  <span>Click to collapse</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TerminalErrorEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const content = payload.content as {
    cwd: string;
    command: string;
    args: string[];
    error: string;
  };

  const commandStr = [content.command, ...content.args].join(" ");

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

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mt-0.5">
          <FolderOpen className="size-3" />
          <span className="font-mono">{content.cwd}</span>
        </div>

        <div className="mt-1.5 rounded-md border border-event-error/30 bg-destructive/5 px-3 py-2">
          <pre className="text-[12px] leading-relaxed font-mono text-event-error whitespace-pre-wrap break-all">
            {content.error}
          </pre>
        </div>
      </div>
    </div>
  );
}

function GenericToolUpdateEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const status = payload.status as string | undefined;
  const succeeded = status === "completed";

  const config = eventConfig["tool-update"] ?? eventConfig["tool-call"]!;

  // Extract displayable content
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: collapse toggle on long content
    <div
      className={`
        group flex gap-2.5 py-2 px-3 rounded-md border-l-2
        transition-colors duration-200 hover:bg-accent/50
        ${isFailed ? "border-l-event-error/50 bg-destructive/5" : config.borderColor}
        ${config.color}
        ${isLong ? "cursor-pointer" : ""}
      `}
      onClick={isLong ? () => setIsExpanded(!isExpanded) : undefined}
      onKeyDown={
        isLong
          ? (e) => e.key === "Enter" && setIsExpanded(!isExpanded)
          : undefined
      }
      role={isLong ? "button" : undefined}
      tabIndex={isLong ? 0 : undefined}
    >
      {/* Timestamp */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
        <CopyButton text={content} />
      </div>

      {/* Icon */}
      {isLong ? (
        <ChevronRight
          className={`size-3.5 shrink-0 mt-[3px] opacity-70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
      ) : (
        <Wrench className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      )}

      {/* Content */}
      <div className="flex-1 text-[13px] leading-relaxed min-w-0">
        <span className="whitespace-pre-wrap break-all">{displayContent}</span>
        {succeeded && (
          <span className="text-event-complete ml-2">&#10003;</span>
        )}
        {isLong && !isExpanded && (
          <span className="text-muted-foreground/50 ml-1 text-xs">
            ({hiddenCount} more lines)
          </span>
        )}
      </div>
    </div>
  );
}

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
