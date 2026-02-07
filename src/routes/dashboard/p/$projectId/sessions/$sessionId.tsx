import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Loader2,
  Send,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SessionHeader } from "@/components/dashboard/SessionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentEvent } from "@/lib/agents/types";

export const Route = createFileRoute(
  "/dashboard/p/$projectId/sessions/$sessionId",
)({
  component: ProjectSessionDetailPage,
});

function ProjectSessionDetailPage() {
  const { projectId, sessionId } = Route.useParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const sessionQuery = trpc.sessions.get.useQuery({ sessionId });
  const projectQuery = trpc.projects.get.useQuery({ id: projectId });
  const sendMessageMutation = trpc.sessions.sendMessage.useMutation();
  const killSessionMutation = trpc.sessions.killSession.useMutation();

  // Listen for real-time events
  useAgentEvents({
    onEvent: (event: AgentEvent) => {
      if (event.sessionId === sessionId) {
        setEvents((prev) => [...prev, event]);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.get.queryKey({ sessionId }),
        });
      }
    },
  });

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, isAutoScroll]);

  // Track scroll position
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAutoScroll(isAtBottom);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      await sendMessageMutation.mutateAsync({
        sessionId,
        message: message.trim(),
      });
      setMessage("");
    } catch (_error) {
      // Error is handled by mutation state
    }
  };

  const handleKillSession = async () => {
    try {
      await killSessionMutation.mutateAsync({ sessionId });
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.get.queryKey({ sessionId }),
      });
    } catch (_error) {
      // Error is handled by mutation state
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            {sessionQuery.error?.message || "Session not found"}
          </p>
        </div>
      </div>
    );
  }

  const session = sessionQuery.data;
  const project = projectQuery.data;

  return (
    <div className="flex h-full flex-col space-y-4 p-4">
      <SessionHeader
        session={session}
        onKillSession={handleKillSession}
        isKilling={killSessionMutation.isPending}
        backTo="/dashboard/p/$projectId"
        backParams={{ projectId }}
        projectName={project?.name}
      />

      {/* Session info */}
      {session.task && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Task</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{session.task}</p>
          </CardContent>
        </Card>
      )}

      {/* Event log */}
      <Card className="flex-1 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Terminal className="h-4 w-4" />
            Event Log
            <span className="text-xs font-normal text-muted-foreground">
              ({events.length} events)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-[calc(100vh-400px)]" ref={scrollAreaRef}>
            <div className="space-y-1 p-4 font-mono text-xs">
              {events.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p>Waiting for events...</p>
                </div>
              ) : (
                events.map((event, i) => (
                  <EventLine key={`${event.timestamp}-${i}`} event={event} />
                ))
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message input */}
      {session.status === "running" && (
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to the agent..."
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="sm"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function EventLine({ event }: { event: AgentEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString();

  const colorMap: Record<string, string> = {
    message: "text-foreground",
    status: "text-blue-400",
    error: "text-red-400",
    tool_use: "text-yellow-400",
    tool_result: "text-green-400",
    permission_request: "text-orange-400",
    completion: "text-purple-400",
  };

  return (
    <div className={`${colorMap[event.type] || "text-muted-foreground"}`}>
      <span className="text-muted-foreground">[{time}]</span>{" "}
      <span className="font-semibold">{event.type}</span>{" "}
      <span className="break-all">
        {typeof event.data === "string"
          ? event.data
          : JSON.stringify(event.data)}
      </span>
    </div>
  );
}
