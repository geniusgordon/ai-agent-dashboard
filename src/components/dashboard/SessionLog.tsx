import { ArrowDown, MessageSquare } from "lucide-react";
import type { Ref, RefObject } from "react";
import type { AgentEvent } from "@/lib/agents/types";
import { LogEntry } from "./LogEntry";

export interface SessionLogProps {
  events: AgentEvent[];
  logsEndRef: RefObject<HTMLDivElement | null>;
  containerRef?: Ref<HTMLDivElement>;
  showScrollButton: boolean;
  onScrollToBottom: () => void;
}

export function SessionLog({
  events,
  logsEndRef,
  containerRef,
  showScrollButton,
  onScrollToBottom,
}: SessionLogProps) {
  return (
    <div className="flex-1 relative min-h-0">
      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto rounded-none lg:rounded-xl border-0 lg:border lg:border-border bg-transparent lg:bg-background/50 font-mono text-sm"
      >
        <div className="px-2 py-1.5 lg:p-3">
          {events.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 lg:py-16">
              <MessageSquare className="size-10 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1.5 text-muted-foreground/70">
                Send a message below to start the conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {events.map((event, i) => (
                <LogEntry
                  key={`${event.timestamp.toString()}-${i}`}
                  event={event}
                />
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button - outside scrollable area */}
      {showScrollButton && (
        <button
          type="button"
          onClick={onScrollToBottom}
          className="absolute bottom-4 right-4 z-20 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
