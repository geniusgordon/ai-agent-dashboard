/**
 * Event display utilities — pure config and helpers for session log rendering.
 */

import {
  Brain,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MessageSquare,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";

export interface EventStyleConfig {
  icon: typeof Brain;
  color: string;
  borderColor: string;
}

/** Extract text content from a loosely-typed event payload. */
export function extractContent(payload: Record<string, unknown>): string {
  if (typeof payload.content === "string") {
    return payload.content;
  }
  if (typeof payload.content === "object" && payload.content !== null) {
    const nested = payload.content as Record<string, unknown>;
    return (nested.text as string) ?? "";
  }
  return "";
}

/** Format a Date as HH:MM:SS (24-hour). */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export const eventConfig: Record<string, EventStyleConfig> = {
  thinking: {
    icon: Brain,
    color: "text-event-thinking",
    borderColor: "border-l-event-thinking/50",
  },
  message: {
    icon: MessageSquare,
    color: "text-foreground",
    borderColor: "border-l-event-message/50",
  },
  "tool-call": {
    icon: Wrench,
    color: "text-event-tool",
    borderColor: "border-l-event-tool/50",
  },
  "tool-update": {
    icon: Wrench,
    color: "text-event-tool-update",
    borderColor: "border-l-event-tool/50",
  },
  plan: {
    icon: ClipboardList,
    color: "text-event-plan",
    borderColor: "border-l-event-plan/50",
  },
  "mode-change": {
    icon: RefreshCw,
    color: "text-muted-foreground",
    borderColor: "border-l-border",
  },
  complete: {
    icon: CheckCircle2,
    color: "text-event-complete",
    borderColor: "border-l-event-complete/50",
  },
  error: {
    icon: XCircle,
    color: "text-event-error",
    borderColor: "border-l-event-error/50",
  },
};

export const defaultEventConfig: EventStyleConfig = {
  icon: Inbox,
  color: "text-muted-foreground",
  borderColor: "border-l-border",
};
