import {
  Check,
  ChevronRight,
  FileDiff,
  FolderOpen,
  Timer,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/cjs/styles/prism";

import { useTheme } from "@/hooks/useTheme";

import {
  computeLineDiff,
  eventConfig,
  extractTextFromContentBlocks,
  formatJson,
  formatTime,
} from "@/lib/agents/event-utils";
import type { AgentEvent, DiffContentBlock } from "@/lib/agents/types";
import {
  hasDiffContent,
  isDiffContentBlock,
  isTerminalErrorContent,
  isTerminalExitContent,
} from "@/lib/agents/types";
import { CopyIconButton } from "./CopyButton";
import { MarkdownContent } from "./MarkdownContent";

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
        group flex gap-1.5 lg:gap-2.5 py-1.5 lg:py-2 px-2 lg:px-3 rounded-md border-l-2
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
    <div className="group flex gap-1.5 lg:gap-2.5 py-1.5 lg:py-2 px-2 lg:px-3 rounded-md border-l-2 border-l-event-error/50 bg-destructive/5 transition-colors duration-200 hover:bg-accent/50">
      {/* Timestamp */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
        <CopyIconButton text={error} />
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
// Diff — file edit results from agent tools
// ---------------------------------------------------------------------------

function DiffBlock({ block }: { block: DiffContentBlock }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const syntaxTheme = isDark ? oneDark : oneLight;

  const diffText = computeLineDiff(block.oldText ?? "", block.newText);
  const lines = diffText.split("\n");
  const isLong = lines.length > OUTPUT_COLLAPSE_THRESHOLD;
  const [isExpanded, setIsExpanded] = useState(!isLong);

  const fileName = block.path.split("/").pop() ?? block.path;

  return (
    <div className="rounded-md border border-border/40 bg-secondary/30 overflow-hidden">
      {/* File path header */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b border-border/30 ${isDark ? "bg-white/5" : "bg-black/[0.03]"}`}
      >
        <span
          className="text-[11px] font-mono text-muted-foreground/70 truncate"
          title={block.path}
        >
          {fileName}
        </span>
        <CopyIconButton text={diffText} />
      </div>

      {/* Diff content */}
      {isLong && !isExpanded ? (
        <button
          type="button"
          className="w-full text-left cursor-pointer"
          onClick={() => setIsExpanded(true)}
        >
          <SyntaxHighlighter
            style={syntaxTheme}
            language="diff"
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "0.5rem 0.75rem",
              borderRadius: 0,
              fontSize: "0.75rem",
              background: "transparent",
            }}
          >
            {lines.slice(0, COLLAPSED_PREVIEW_LINES).join("\n")}
          </SyntaxHighlighter>
          <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60">
            <ChevronRight className="size-3" />
            <span>{lines.length - COLLAPSED_PREVIEW_LINES} more lines</span>
          </div>
        </button>
      ) : (
        <div>
          <SyntaxHighlighter
            style={syntaxTheme}
            language="diff"
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "0.5rem 0.75rem",
              borderRadius: 0,
              fontSize: "0.75rem",
              background: "transparent",
            }}
          >
            {diffText}
          </SyntaxHighlighter>
          {isLong && (
            <button
              type="button"
              className="flex items-center gap-1 w-full px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60 cursor-pointer"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronRight className="size-3 rotate-90 transition-transform" />
              <span>Click to collapse</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DiffEntry({ event }: { event: AgentEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const blocks = (payload.content as unknown[]).filter(isDiffContentBlock);

  // If all blocks were filtered out, fall back to the generic renderer.
  if (blocks.length === 0) {
    return <GenericToolUpdateEntry event={event} />;
  }

  const allDiffText = blocks
    .map((b) => computeLineDiff(b.oldText ?? "", b.newText))
    .join("\n");

  return (
    <div className="group flex gap-1.5 lg:gap-2.5 py-1.5 lg:py-2 px-2 lg:px-3 rounded-md border-l-2 border-l-event-tool/50 transition-colors duration-200 hover:bg-accent/50">
      {/* Timestamp */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
        <CopyIconButton text={allDiffText} />
      </div>

      {/* Icon */}
      <FileDiff className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200 text-event-tool" />

      {/* Content — one panel per file */}
      <div className="flex-1 min-w-0 space-y-2">
        {blocks.map((block, idx) => (
          <DiffBlock key={`${block.path}-${idx}`} block={block} />
        ))}
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
  } else if (Array.isArray(payload.content)) {
    content =
      extractTextFromContentBlocks(payload.content) ||
      JSON.stringify(payload.content, null, 2);
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
          group flex gap-1.5 lg:gap-2.5 py-1.5 lg:py-2 px-2 lg:px-3 rounded-md border-l-2 w-full text-left
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
          {isExpanded ? (
            <MarkdownContent>{displayContent}</MarkdownContent>
          ) : (
            <>
              <span className="whitespace-pre-wrap break-all">
                {displayContent}
              </span>
              <span className="text-muted-foreground/50 ml-1 text-xs">
                ({hiddenCount} more lines)
              </span>
            </>
          )}
        </div>
      </button>
    );
  }

  return (
    <div
      className={`
        group flex gap-1.5 lg:gap-2.5 py-1.5 lg:py-2 px-2 lg:px-3 rounded-md border-l-2
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
        <MarkdownContent>{content}</MarkdownContent>
        {succeeded && (
          <Check className="inline size-3.5 text-event-complete ml-2" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the tool-update carries no meaningful content to display.
 * These are lifecycle bookkeeping events (status-only confirmations, terminal
 * reference arrays, etc.) that just add noise — the corresponding tool-call
 * entry already shows the tool was invoked.
 */
function isNoiseUpdate(payload: Record<string, unknown>): boolean {
  const { content } = payload;

  // No content at all — pure status echo (e.g. { toolCallId, status })
  if (content === undefined || content === null) return true;

  // Terminal reference array (e.g. [{ terminalId, type: "terminal" }])
  if (
    Array.isArray(content) &&
    content.length > 0 &&
    content.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as Record<string, unknown>).type === "terminal",
    )
  )
    return true;

  // Empty string content
  if (content === "") return true;

  // Mode-transition boilerplate from EnterPlanMode / ExitPlanMode tool results.
  // The corresponding tool-call already renders as a ModeTransitionMarker,
  // so the confirmation text is redundant.
  if (Array.isArray(content)) {
    const text = extractTextFromContentBlocks(content);
    if (
      text.startsWith("Entered plan mode") ||
      text.startsWith("Exited plan mode")
    )
      return true;
  }

  return false;
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

  if (hasDiffContent(content)) {
    return <DiffEntry event={event} />;
  }

  // Hide low-information bookkeeping updates (status-only, terminal refs, etc.)
  if (isNoiseUpdate(payload)) return null;

  return <GenericToolUpdateEntry event={event} />;
}
