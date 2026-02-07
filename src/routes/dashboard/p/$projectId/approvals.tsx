/**
 * Project Approvals Page
 *
 * Shows pending approval requests scoped to the current project.
 * This is a placeholder — full implementation in Phase 5.
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/p/$projectId/approvals")({
  component: ProjectApprovalsPage,
});

function ProjectApprovalsPage() {
  const { projectId } = Route.useParams();
  const trpc = useTRPC();

  const approvalsQuery = useQuery(
    trpc.approvals.list.queryOptions({ projectId }),
  );

  const approvals = approvalsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Approvals</h1>
        {approvals.length > 0 && (
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
            {approvals.length} pending
          </span>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No pending approvals for this project.
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Approval cards coming in Phase 5.
          <br />
          {approvals.length} pending approval
          {approvals.length !== 1 ? "s" : ""}.
        </div>
      )}
    </div>
  );
}
