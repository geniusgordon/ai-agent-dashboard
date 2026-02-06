/**
 * Server-Sent Events endpoint for real-time agent events
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAgentManager } from "../lib/agents";

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");

        // Set up SSE headers
        const headers = new Headers({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const stream = new ReadableStream({
          start(controller) {
            const manager = getAgentManager();
            const encoder = new TextEncoder();

            // Send initial connection message
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "connected" })}\n\n`,
              ),
            );

            // Subscribe to events
            const unsubscribe = manager.onEvent((event) => {
              // Filter by sessionId if provided
              if (sessionId && event.sessionId !== sessionId) {
                return;
              }

              try {
                const data = JSON.stringify({
                  ...event,
                  timestamp: event.timestamp.toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (e) {
                console.error("Error sending event:", e);
              }
            });

            // Subscribe to approvals
            const unsubscribeApproval = manager.onApproval((approval) => {
              // Filter by sessionId if provided
              if (sessionId && approval.sessionId !== sessionId) {
                return;
              }

              try {
                const data = JSON.stringify({
                  type: "approval-request",
                  ...approval,
                  createdAt: approval.createdAt.toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (e) {
                console.error("Error sending approval:", e);
              }
            });

            // Keep-alive ping every 30 seconds
            const pingInterval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(`: ping\n\n`));
              } catch {
                clearInterval(pingInterval);
              }
            }, 30000);

            // Cleanup on close
            request.signal.addEventListener("abort", () => {
              unsubscribe();
              unsubscribeApproval();
              clearInterval(pingInterval);
              controller.close();
            });
          },
        });

        return new Response(stream, { headers });
      },
    },
  },
});
