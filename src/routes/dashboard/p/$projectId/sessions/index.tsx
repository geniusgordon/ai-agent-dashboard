/**
 * Project Sessions Page
 *
 * Lists sessions scoped to the current project, grouped by worktree.
 * This is a placeholder — full implementation in Phase 5.
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/p/$projectId/sessions/")({
  component: ProjectSessionsPage,
});

function ProjectSessionsPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();

  const sessionsQuery = useQuery(
    trpc.sessions.listSessions.queryOptions({ projectId }),
  );

  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Sessions</h1>
        <span className="text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No sessions in this project. Spawn an agent from the Overview.
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Session list with worktree grouping coming in Phase 5.
          <br />
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} found.
        </div>
      )}
    </div>
  );
}
