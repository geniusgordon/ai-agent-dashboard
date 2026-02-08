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
  if (Array.isArray(payload.content)) {
    return extractTextFromContentBlocks(payload.content);
  }
  if (typeof payload.content === "object" && payload.content !== null) {
    const nested = payload.content as Record<string, unknown>;
    return (nested.text as string) ?? "";
  }
  return "";
}

/**
 * Extract text from an ACP content block array.
 * Handles shapes like: [{ type: "content", content: { type: "text", text: "..." } }]
 * and also: [{ type: "text", text: "..." }]
 */
export function extractTextFromContentBlocks(blocks: unknown[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    } else if (
      b.type === "content" &&
      typeof b.content === "object" &&
      b.content !== null
    ) {
      const inner = b.content as Record<string, unknown>;
      if (inner.type === "text" && typeof inner.text === "string") {
        parts.push(inner.text);
      }
    } else if (
      b.type === "diff" &&
      typeof b.path === "string" &&
      typeof b.newText === "string"
    ) {
      parts.push(`${b.path}:\n${b.newText}`);
    }
  }
  return parts.join("\n");
}

/**
 * Compute a line-level unified diff string from oldText and newText.
 * Produces output with `-` (removed), `+` (added), ` ` (context) prefixes,
 * compatible with Prism's `diff` language highlighter.
 */
export function computeLineDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldLines.length, newLines.length);
  while (prefixLen < minLen && oldLines[prefixLen] === newLines[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (not overlapping with prefix)
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldLines[oldLines.length - 1 - suffixLen] ===
      newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // No changes
  if (prefixLen === oldLines.length && prefixLen === newLines.length) {
    return oldLines.map((l) => ` ${l}`).join("\n");
  }

  const result: string[] = [];

  // Context before (up to 3 lines)
  const ctxStart = Math.max(0, prefixLen - 3);
  for (let i = ctxStart; i < prefixLen; i++) {
    result.push(` ${oldLines[i]}`);
  }

  // Removed lines
  const removedEnd = oldLines.length - suffixLen;
  for (let i = prefixLen; i < removedEnd; i++) {
    result.push(`-${oldLines[i]}`);
  }

  // Added lines
  const addedEnd = newLines.length - suffixLen;
  for (let i = prefixLen; i < addedEnd; i++) {
    result.push(`+${newLines[i]}`);
  }

  // Context after (up to 3 lines)
  if (suffixLen > 0) {
    const ctxEnd = Math.min(oldLines.length, removedEnd + 3);
    for (let i = removedEnd; i < ctxEnd; i++) {
      result.push(` ${oldLines[i]}`);
    }
  }

  return result.join("\n");
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

/** Try to pretty-print a string as JSON; return as-is if not valid JSON. */
export function formatJson(str: string): string {
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

/** Summarize plan entries into a human-readable progress string. */
export function summarizePlanEntries(
  entries: Array<{ content: string; status: string }>,
): string {
  const total = entries.length;
  if (total === 0) return "No tasks";

  let completed = 0;
  let inProgress = 0;
  for (const e of entries) {
    if (e.status === "completed") completed++;
    else if (e.status === "in_progress") inProgress++;
  }

  if (completed === total) return `All ${total} tasks completed`;
  const parts: string[] = [`${completed}/${total} done`];
  if (inProgress > 0) parts.push(`${inProgress} in progress`);
  return parts.join(", ");
}
