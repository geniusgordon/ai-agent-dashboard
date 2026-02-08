import { Check, ChevronRight, Loader2, User } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

import {
  defaultEventConfig,
  eventConfig,
  formatJson,
  formatTime,
  summarizePlanEntries,
} from "@/lib/agents/event-utils";
import { CopyButton, CopyIconButton } from "./CopyButton";
import { ToolUpdateEntry } from "./ToolUpdateEntry";
import type { AgentEvent, PlanPayload } from "@/lib/agents/types";

export interface LogEntryProps {
  event: AgentEvent;
}

/**
 * Thin dispatcher — routes tool-update events to ToolUpdateEntry,
 * everything else to LogEntryContent. No hooks here.
 */
export function LogEntry({ event }: LogEntryProps) {
  if (event.type === "tool-update") {
    return <ToolUpdateEntry event={event} />;
  }
  return <LogEntryContent event={event} />;
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
  const toolStatus = payload.status as string | undefined;
  const isToolLoading = isToolCallStart && toolStatus === "in_progress";

  // Content extraction with fallback chain
  let content: string;
  if (isPlan) {
    const { entries } = payload as unknown as PlanPayload;
    content = `Updated tasks: ${summarizePlanEntries(entries)}`;
  } else if (typeof payload.title === "string") {
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

  if (isToolCallStart) {
    content = formatJson(content);
  }

  const isCollapsible =
    (isThinking || isToolCallStart) && isLongContent(content);

  const Icon = config.icon;
  const displayContent =
    isCollapsible && !isExpanded ? getPreview(content) : content;

  const baseClasses = `
    group flex gap-2.5 py-2 px-3 rounded-md border-l-2
    transition-colors duration-200 hover:bg-accent/50
    ${config.borderColor}
    ${isUser ? "bg-primary/5" : isError ? "bg-destructive/5" : ""}
    ${isThinking ? "opacity-70 italic" : ""}
    ${isToolLoading ? "bg-event-tool/5" : ""}
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
        <div className="prose prose-sm prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_hr]:border-border [&_hr]:my-3">
          <Markdown
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                const isBlock = !!match || codeString.includes("\n");
                const language = match?.[1];

                if (!isBlock) {
                  return (
                    <code
                      className="bg-secondary/80 border border-border/50 px-1.5 py-0.5 rounded text-[0.85em] font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return (
                  <div className="not-prose my-3 rounded-lg border border-border/50 overflow-hidden bg-[#282c34]">
                    <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-border/30">
                      <span className="text-xs text-muted-foreground font-mono select-none">
                        {language || "text"}
                      </span>
                      <CopyButton text={codeString} />
                    </div>
                    {language ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={language}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: "0.75rem 1rem",
                          borderRadius: 0,
                          fontSize: "0.85em",
                          background: "transparent",
                        }}
                        codeTagProps={{
                          style: { background: "transparent" },
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    ) : (
                      <pre className="p-3 overflow-x-auto text-[0.85em] leading-relaxed">
                        <code className="font-mono">{codeString}</code>
                      </pre>
                    )}
                  </div>
                );
              },
              table({ children }) {
                return (
                  <div className="not-prose my-3 overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-sm border-collapse">
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ children }) {
                return (
                  <thead className="bg-secondary/50 text-left">
                    {children}
                  </thead>
                );
              },
              th({ children }) {
                return (
                  <th className="px-3 py-2 font-semibold text-foreground border-b border-border/50 whitespace-nowrap">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="px-3 py-2 border-b border-border/30">
                    {children}
                  </td>
                );
              },
              tr({ children, ...props }) {
                return (
                  <tr
                    className="hover:bg-accent/30 transition-colors even:bg-secondary/20"
                    {...props}
                  >
                    {children}
                  </tr>
                );
              },
              pre({ children }) {
                return <>{children}</>;
              },
            }}
          >
            {displayContent}
          </Markdown>
        </div>
      )}
      {isToolLoading && (
        <span className="text-muted-foreground ml-2">Running...</span>
      )}
      {isToolCallStart && toolStatus === "completed" && (
        <Check className="inline size-3.5 text-event-complete ml-2" />
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
      {isToolLoading ? (
        <Loader2 className="size-3.5 shrink-0 mt-[3px] animate-spin" />
      ) : (
        <Icon className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      )}
      {innerContent}
    </div>
  );
}
