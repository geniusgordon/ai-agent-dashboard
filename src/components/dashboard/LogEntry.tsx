import { Check, ChevronRight, Copy, Loader2, User } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

import {
  defaultEventConfig,
  eventConfig,
  formatTime,
  summarizePlanEntries,
} from "@/lib/agents/event-utils";
import type { AgentEvent, PlanPayload } from "@/lib/agents/types";

export interface LogEntryProps {
  event: AgentEvent;
}

// Get preview for collapsed view
function getPreview(content: string, maxLength = 80): string {
  const trimmed = content.trim();

  // For JSON objects/arrays, show a summary
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

  // Default: first line or truncated
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
      // fallback
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
      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
      title="Copy code"
    >
      {copied ? (
        <>
          <Check className="size-3" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="size-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

interface ImageData {
  mimeType: string;
  dataUrl: string;
}

export function LogEntry({ event }: LogEntryProps) {
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
  const isPlan = event.type === "plan";
  const isToolCall = event.type === "tool-call" || event.type === "tool-update";
  const toolStatus = payload.status as string | undefined;
  const isToolLoading = isToolCall && toolStatus === "in_progress";

  // Richer content extraction: handles stopReason, message fallbacks
  let content: string;
  if (isPlan) {
    const { entries } = payload as unknown as PlanPayload;
    content = `Updated tasks: ${summarizePlanEntries(entries)}`;
  } else if (typeof payload.title === "string") {
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
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger collapse/expand
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for non-HTTPS or unsupported browsers
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const Icon = config.icon;
  const displayContent =
    isCollapsible && !isExpanded ? getPreview(content) : content;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role/tabIndex/handlers are all conditionally set together when isCollapsible
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
      onKeyDown={
        isCollapsible
          ? (e) => e.key === "Enter" && setIsExpanded(!isExpanded)
          : undefined
      }
      role={isCollapsible ? "button" : undefined}
      tabIndex={isCollapsible ? 0 : undefined}
    >
      <div className="shrink-0 hidden sm:flex items-center gap-1 w-[5.5rem] pt-0.5">
        <span className="text-muted-foreground/70 text-[11px] tabular-nums select-none">
          {formatTime(event.timestamp)}
        </span>
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
      </div>
      {isCollapsible ? (
        <ChevronRight
          className={`size-3.5 shrink-0 mt-[3px] opacity-70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
      ) : isToolLoading ? (
        <Loader2 className="size-3.5 shrink-0 mt-[3px] animate-spin" />
      ) : (
        <Icon className="size-3.5 shrink-0 mt-[3px] opacity-70 group-hover:opacity-100 transition-opacity duration-200" />
      )}
      <div className="flex-1 text-[13px] leading-relaxed min-w-0">
        {/* Display attached images */}
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
        {isToolCall || (isCollapsible && !isExpanded) ? (
          // Tool calls and collapsed content: plain text
          <span className="whitespace-pre-wrap break-all">
            {displayContent}
          </span>
        ) : (
          // Messages: render markdown with syntax highlighting
          <div className="prose prose-sm prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_hr]:border-border [&_hr]:my-3">
            <Markdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");
                  // Block code has a language class or contains newlines
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
                // Wrap tables in a scrollable container
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
                // Override pre to avoid double-wrapping with our code block container
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
        {isToolCall && toolStatus === "completed" && (
          <span className="text-event-complete ml-2">✓</span>
        )}
        {isCollapsible && !isExpanded && (
          <span className="text-muted-foreground/50 ml-1 text-xs">
            ({content.split("\n").length} lines)
          </span>
        )}
      </div>
    </div>
  );
}
