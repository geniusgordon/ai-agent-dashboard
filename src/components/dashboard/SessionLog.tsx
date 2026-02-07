import { ArrowDown, MessageSquare } from "lucide-react";
import { useState, useEffect, type RefObject } from "react";
import type { AgentEvent } from "@/lib/agents/types";
import { LogEntry } from "./LogEntry";

export interface SessionLogProps {
  events: AgentEvent[];
  logsEndRef: RefObject<HTMLDivElement | null>;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function SessionLog({ events, logsEndRef, containerRef }: SessionLogProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Track scroll position to show/hide scroll button
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && events.length > 0);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, events.length]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex-1 relative min-h-0">
      {/* Scrollable container */}
      <div 
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto rounded-xl border border-border bg-background/50 font-mono text-sm shadow-lg"
      >
        {/* Sticky log header */}
        <div className="sticky top-0 z-10 px-4 py-2.5 bg-background/90 backdrop-blur-md border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Session Log
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {events.length} events
          </span>
        </div>

        <div className="p-3">
          {events.length === 0 ? (
            <div className="text-muted-foreground text-center py-16">
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
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-20 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
