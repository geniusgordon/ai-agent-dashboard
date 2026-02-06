import { MessageSquare } from "lucide-react";
import type { RefObject } from "react";
import type { AgentEvent } from "@/lib/agents/types";
import { LogEntry } from "./LogEntry";

export interface SessionLogProps {
  events: AgentEvent[];
  logsEndRef: RefObject<HTMLDivElement | null>;
}

export function SessionLog({ events, logsEndRef }: SessionLogProps) {
  return (
    <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background/50 font-mono text-sm relative shadow-lg">
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
  );
}
