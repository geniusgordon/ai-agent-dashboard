import { ChevronRight, RefreshCw, Terminal, User } from "lucide-react";
import { useState } from "react";

import {
  defaultEventConfig,
  eventConfig,
  extractTextFromContentBlocks,
  formatJson,
  formatTime,
  summarizePlanEntries,
} from "@/lib/agents/event-utils";
import type {
  AgentEvent,
  CommandsUpdatePayload,
  PlanPayload,
} from "@/lib/agents/types";
import { CopyIconButton } from "./CopyButton";
import { MarkdownContent } from "./MarkdownContent";
import { ToolUpdateEntry } from "./ToolUpdateEntry";

export interface LogEntryProps {
  event: AgentEvent;
}

/** Mode-switching tool names that should render as visual transition markers. */
const MODE_TRANSITION_TOOLS = new Set(["EnterPlanMode", "ExitPlanMode"]);

function getModeTransitionLabel(title: string): string | null {
  if (title === "EnterPlanMode") return "Entered plan mode";
  if (title === "ExitPlanMode") return "Exited plan mode";
  return null;
}

/**
 * Thin dispatcher — routes tool-update events to ToolUpdateEntry,
 * mode-transition tool-calls to ModeTransitionMarker,
 * everything else to LogEntryContent. No hooks here.
 */
export function LogEntry({ event }: LogEntryProps) {
  if (event.type === "tool-update") {
    return <ToolUpdateEntry event={event} />;
  }
  if (event.type === "commands-update") {
    return <CommandsUpdateEntry event={event} />;
  }
  if (event.type === "tool-call") {
    const payload = event.payload as Record<string, unknown>;
    const title = payload.title as string | undefined;
    if (title && MODE_TRANSITION_TOOLS.has(title)) {
      return (
        <ModeTransitionMarker
          event={event}
          label={getModeTransitionLabel(title) ?? title}
        />
      );
    }
  }
  return <LogEntryContent event={event} />;
}

// ---------------------------------------------------------------------------
// ModeTransitionMarker — centered divider for EnterPlanMode / ExitPlanMode
// ---------------------------------------------------------------------------

function ModeTransitionMarker({
  event,
  label,
}: {
  event: AgentEvent;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 lg:py-2 px-2 lg:px-3 text-muted-foreground/60">
      <span className="shrink-0 hidden sm:block w-[5.5rem] text-[11px] tabular-nums select-none text-muted-foreground/70">
        {formatTime(event.timestamp)}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 border-t border-border" />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
          <RefreshCw className="size-3" />
          {label}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommandsUpdateEntry — collapsible list of available slash commands
// ---------------------------------------------------------------------------

function CommandsUpdateEntry({ event }: { event: AgentEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { commands } = event.payload as CommandsUpdatePayload;
  const count = commands.length;

  const label =
    count === 0
      ? "No slash commands available"
      : `${count} slash command${count !== 1 ? "s" : ""} available`;

  return (
    <div className="py-1.5 lg:py-2 px-2 lg:px-3">
      <button
        type="button"
        className={`w-full flex items-center gap-2 text-muted-foreground/60 ${count > 0 ? "cursor-pointer group" : "cursor-default"}`}
        onClick={count > 0 ? () => setIsExpanded(!isExpanded) : undefined}
        aria-expanded={count > 0 ? isExpanded : undefined}
      >
        <span className="shrink-0 hidden sm:block w-[5.5rem] text-[11px] tabular-nums select-none text-muted-foreground/70">
          {formatTime(event.timestamp)}
        </span>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 border-t border-border" />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap group-hover:text-muted-foreground transition-colors">
            <Terminal className="size-3" />
            {label}
            {count > 0 && (
              <ChevronRight
                className={`size-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
              />
            )}
          </span>
          <div className="flex-1 border-t border-border" />
        </div>
      </button>

      {isExpanded && (
        <ul className="mt-2 ml-0 sm:ml-[6.5rem] rounded-md border border-border bg-muted/30 divide-y divide-border/50 text-xs">
          {commands.map((cmd) => (
            <li key={cmd.name} className="px-3 py-1.5">
              <span className="font-mono font-medium text-foreground/80">
                /{cmd.name}
              </span>
              <span className="ml-2 text-muted-foreground">
                {cmd.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPreview(content: string, maxLength = 80): string {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return `[${parsed.length} items]`;
      }
      const keys = Object.keys(parsed).slice(0, 3);
      const keyPreview = keys.join(", ");
      const more = Object.keys(parsed).length > 3 ? ", ..." : "";
      return `{ ${keyPreview}${more} }`;
    } catch {
      // Not valid JSON, fall through to default
    }
  }

  const firstLine = content.split("\n")[0];
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength)}…`;
}

function isLongContent(content: string): boolean {
  return content.length > 120 || content.includes("\n");
}

// ---------------------------------------------------------------------------
// LogEntryContent — renders everything except tool-update events
// ---------------------------------------------------------------------------

interface ImageData {
  mimeType: string;
  dataUrl: string;
}

function LogEntryContent({ event }: { event: AgentEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const payload = event.payload as Record<string, unknown>;
  const isUser = payload.isUser === true;
  const images = payload.images as ImageData[] | undefined;

  const config = isUser
    ? {
        icon: User,
        color: "text-event-user",
        borderColor: "border-l-event-user/60",
      }
    : (eventConfig[event.type] ?? defaultEventConfig);

  const isThinking = event.type === "thinking";
  const isError = event.type === "error";
  const isToolCallStart = event.type === "tool-call";
  const isPlan = event.type === "plan";
  // Content extraction with fallback chain
  let content: string;
  if (isPlan) {
    const { entries } = payload as unknown as PlanPayload;
    content = `Updated tasks: ${summarizePlanEntries(entries)}`;
  } else if (typeof payload.title === "string") {
    content = payload.title;
  } else if (typeof payload.content === "string") {
    content = payload.content;
  } else if (Array.isArray(payload.content)) {
    content =
      extractTextFromContentBlocks(payload.content) ||
      JSON.stringify(payload.content, null, 2);
  } else if (typeof payload.content === "object" && payload.content !== null) {
    const nested = payload.content as Record<string, unknown>;
    content = (nested.text as string) ?? JSON.stringify(nested, null, 2);
  } else if (typeof payload.stopReason === "string") {
    content = payload.stopReason;
  } else if (typeof payload.message === "string") {
    content = payload.message;
  } else {
    content = JSON.stringify(payload, null, 2);
  }

  if (isToolCallStart) {
    content = formatJson(content);
  }

  const isCollapsible =
    (isThinking || isToolCallStart) && isLongContent(content);

  const Icon = config.icon;
  const displayContent =
    isCollapsible && !isExpanded ? getPreview(content) : content;

  const baseClasses = `
    group flex gap-1.5 lg:gap-2.5 py-1.5 lg:py-2 px-2 lg:px-3 rounded-md border-l-2
    transition-colors duration-200 hover:bg-accent/50
    ${config.borderColor}
    ${isUser ? "bg-primary/5" : isError ? "bg-destructive/5" : ""}
    ${isThinking ? "opacity-70 italic" : ""}
    ${config.color}
  `;

  const timestamp = (
    <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
      <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
        {formatTime(event.timestamp)}
      </span>
      <CopyIconButton text={content} />
    </div>
  );

  const innerContent = (
    <div className="flex-1 text-[13px] leading-relaxed min-w-0">
      {images && images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((img, idx) => (
            <img
              key={`img-${idx}`}
              src={img.dataUrl}
              alt={`attachment ${idx + 1}`}
              className="max-h-32 max-w-48 rounded-lg border border-border object-contain"
            />
          ))}
        </div>
      )}
      {isToolCallStart || (isCollapsible && !isExpanded) ? (
        <span className="whitespace-pre-wrap break-all">{displayContent}</span>
      ) : (
        <MarkdownContent>{displayContent}</MarkdownContent>
      )}

      {isCollapsible && !isExpanded && (
        <span className="text-muted-foreground/50 ml-1 text-xs">
          ({content.split("\n").length} lines)
        </span>
      )}
    </div>
  );

  if (isCollapsible) {
    return (
      <button
        type="button"
        className={`${baseClasses} w-full text-left cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        {timestamp}
        <ChevronRight
          className={`size-3.5 shrink-0 mt-[3px] opacity-70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
        {innerContent}
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      {timestamp}
      <Icon className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      {innerContent}
    </div>
  );
}
