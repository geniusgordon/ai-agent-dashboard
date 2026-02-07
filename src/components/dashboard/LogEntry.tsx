import { Loader2, User } from "lucide-react";
import {
  defaultEventConfig,
  eventConfig,
  formatTime,
} from "@/lib/agents/event-utils";
import type { AgentEvent } from "@/lib/agents/types";

export interface LogEntryProps {
  event: AgentEvent;
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
    content = (nested.text as string) ?? JSON.stringify(nested);
  } else if (typeof payload.stopReason === "string") {
    content = payload.stopReason;
  } else if (typeof payload.message === "string") {
    content = payload.message;
  } else {
    content = JSON.stringify(payload);
  }

  const Icon = config.icon;

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
      `}
    >
      <span className="shrink-0 text-muted-foreground/70 text-[11px] tabular-nums hidden sm:block w-[4.5rem] pt-0.5 select-none">
        {formatTime(event.timestamp)}
      </span>
      {isToolLoading ? (
        <Loader2 className="size-3.5 shrink-0 mt-[3px] animate-spin" />
      ) : (
        <Icon className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      )}
      <span className="whitespace-pre-wrap break-all flex-1 text-[13px] leading-relaxed">
        {content}
        {isToolLoading && <span className="text-muted-foreground ml-2">Running...</span>}
        {isToolCall && toolStatus === "completed" && (
          <span className="text-event-complete ml-2">✓</span>
        )}
      </span>
    </div>
  );
}
