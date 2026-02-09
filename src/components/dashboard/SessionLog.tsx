import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, MessageSquare } from "lucide-react";
import { type Ref, type RefObject, useEffect, useRef } from "react";
import type { AgentEvent } from "@/lib/agents/types";
import { LogEntry } from "./LogEntry";

export interface SessionLogScrollHandle {
  scrollToBottom: (behavior?: "auto" | "smooth") => void;
}

export interface SessionLogProps {
  events: AgentEvent[];
  scrollRef?: RefObject<SessionLogScrollHandle | null>;
  containerRef?: Ref<HTMLDivElement>;
  showScrollButton: boolean;
  onScrollToBottom: () => void;
}

/**
 * Default height estimate for virtualizer rows.
 *
 * TODO: This is a meaningful design choice — it affects scroll position
 * accuracy and initial layout. Consider tuning based on your typical
 * event mix (short messages vs long diffs/terminal output).
 * Higher values reduce layout shift for content-heavy logs.
 */
const ESTIMATE_ROW_HEIGHT = 52;

/** Gap in pixels between virtual rows (replaces space-y-0.5). */
const ROW_GAP = 2;

export function SessionLog({
  events,
  scrollRef,
  containerRef,
  showScrollButton,
  onScrollToBottom,
}: SessionLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Combine the external callback ref (from useSessionDetail's scroll tracking)
  // with our local ref (for the virtualizer's getScrollElement).
  const combinedRef = (node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    if (typeof containerRef === "function") {
      containerRef(node);
    } else if (containerRef && typeof containerRef === "object") {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
    }
  };

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATE_ROW_HEIGHT,
    gap: ROW_GAP,
    overscan: 10,
  });

  // Expose scrollToBottom to the parent hook via scrollRef
  useEffect(() => {
    if (!scrollRef) return;
    (
      scrollRef as React.MutableRefObject<SessionLogScrollHandle | null>
    ).current = {
      scrollToBottom: (behavior?: "auto" | "smooth") => {
        if (events.length === 0) return;
        virtualizer.scrollToIndex(events.length - 1, {
          align: "end",
          behavior: behavior ?? "auto",
        });
      },
    };
    return () => {
      (
        scrollRef as React.MutableRefObject<SessionLogScrollHandle | null>
      ).current = null;
    };
  }, [scrollRef, events.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex-1 relative min-h-0">
      {/* Scrollable container */}
      <div
        ref={combinedRef}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden font-mono text-sm"
      >
        <div className="px-3 py-2">
          {events.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 lg:py-16">
              <MessageSquare className="size-10 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-1.5 text-muted-foreground/70">
                Send a message below to start the conversation.
              </p>
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualItems.map((virtualRow) => (
                <div
                  key={`${events[virtualRow.index].timestamp.toString()}-${virtualRow.index}`}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <LogEntry event={events[virtualRow.index]} />
                </div>
              ))}
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
