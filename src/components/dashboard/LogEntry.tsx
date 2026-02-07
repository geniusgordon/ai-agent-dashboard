import { ChevronRight, Loader2, User } from "lucide-react";
import { useState } from "react";
import {
  defaultEventConfig,
  eventConfig,
  formatTime,
} from "@/lib/agents/event-utils";
import type { AgentEvent } from "@/lib/agents/types";

export interface LogEntryProps {
  event: AgentEvent;
}

// Get first line or truncate for collapsed view
function getPreview(content: string, maxLength = 80): string {
  const firstLine = content.split("\n")[0];
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength)}…`;
}

// Check if content is long enough to be collapsible
function isLongContent(content: string): boolean {
  return content.length > 120 || content.includes("\n");
}

// Try to format JSON for readability
function formatJson(str: string): string {
  // Check if it looks like JSON
  const trimmed = str.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return str;
    }
  }
  return str;
}

export function LogEntry({ event }: LogEntryProps) {
  const payload = event.payload as Record<string, unknown>;
  const isUser = payload.isUser === true;

  const config = isUser
    ? {
        icon: User,
        color: "text-event-user",
        borderColor: "border-l-event-user/60",
      }
    : (eventConfig[event.type] ?? defaultEventConfig);

  const isThinking = event.type === "thinking";
  const isError = event.type === "error";
  const isToolCall = event.type === "tool-call" || event.type === "tool-update";
  const toolStatus = payload.status as string | undefined;
  const isToolLoading = isToolCall && toolStatus === "in_progress";

  // Richer content extraction: handles stopReason, message fallbacks
  let content: string;
  if (typeof payload.title === "string") {
    // Tool calls have title
    content = payload.title;
  } else if (typeof payload.content === "string") {
    content = payload.content;
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

  // Format JSON strings for tool calls
  if (isToolCall) {
    content = formatJson(content);
  }

  // Collapsible for thinking and tool calls with long content
  const isCollapsible = (isThinking || isToolCall) && isLongContent(content);
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = config.icon;
  const displayContent = isCollapsible && !isExpanded ? getPreview(content) : content;

  return (
    <div
      className={`
        group flex gap-2.5 py-2 px-3 rounded-md border-l-2
        transition-colors duration-200
        hover:bg-accent/50
        ${config.borderColor}
        ${isUser ? "bg-primary/5" : isError ? "bg-destructive/5" : ""}
        ${isThinking ? "opacity-70 italic" : ""}
        ${isToolLoading ? "bg-event-tool/5" : ""}
        ${config.color}
        ${isCollapsible ? "cursor-pointer" : ""}
      `}
      onClick={isCollapsible ? () => setIsExpanded(!isExpanded) : undefined}
      onKeyDown={isCollapsible ? (e) => e.key === "Enter" && setIsExpanded(!isExpanded) : undefined}
      role={isCollapsible ? "button" : undefined}
      tabIndex={isCollapsible ? 0 : undefined}
    >
      <span className="shrink-0 text-muted-foreground/70 text-[11px] tabular-nums hidden sm:block w-[4.5rem] pt-0.5 select-none">
        {formatTime(event.timestamp)}
      </span>
      {isCollapsible ? (
        <ChevronRight 
          className={`size-3.5 shrink-0 mt-[3px] opacity-70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} 
        />
      ) : isToolLoading ? (
        <Loader2 className="size-3.5 shrink-0 mt-[3px] animate-spin" />
      ) : (
        <Icon className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      )}
      <span className="whitespace-pre-wrap break-all flex-1 text-[13px] leading-relaxed">
        {displayContent}
        {isToolLoading && <span className="text-muted-foreground ml-2">Running...</span>}
        {isToolCall && toolStatus === "completed" && (
          <span className="text-event-complete ml-2">✓</span>
        )}
        {isCollapsible && !isExpanded && (
          <span className="text-muted-foreground/50 ml-1 text-xs">({content.split("\n").length} lines)</span>
        )}
      </span>
    </div>
  );
}
