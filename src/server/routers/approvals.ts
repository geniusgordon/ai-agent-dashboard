/**
 * Approvals Router - tRPC endpoints for approval management
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";
import { getProjectManager } from "../../lib/projects/index.js";

export const approvalsRouter = createTRPCRouter({
  /**
   * Get pending approval requests (optionally filtered by project)
   *
   * Each approval is enriched with session metadata (agent type, name,
   * worktree branch, cwd) so the UI can render richer cards without
   * extra round-trips.
   */
  list: publicProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const manager = getAgentManager();
      const approvals = manager.getPendingApprovals();

      // Enrich first, then filter — single getSession lookup per approval
      const enriched = approvals.map((a) => {
        const session = manager.getSession(a.sessionId);
        return {
          ...a,
          session: session
            ? {
                agentType: session.agentType,
                name: session.name ?? null,
                worktreeBranch: session.worktreeBranch ?? null,
                cwd: session.cwd,
                projectId: session.projectId ?? null,
              }
            : null,
        };
      });

      if (!input?.projectId) return enriched;

      const projectManager = getProjectManager();
      const assignments = projectManager.getAssignmentsForProject(
        input.projectId,
      );
      const assignedSessionIds = new Set(assignments.map((a) => a.sessionId));
      return enriched.filter(
        (a) =>
          a.session?.projectId === input.projectId ||
          assignedSessionIds.has(a.sessionId),
      );
    }),

  /**
   * Approve a request by selecting an option
   */
  approve: publicProcedure
    .input(
      z.object({
        approvalId: z.string(),
        optionId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const manager = getAgentManager();
      await manager.approveRequest(input.approvalId, input.optionId);
      return { success: true };
    }),

  /**
   * Deny a request
   */
  deny: publicProcedure
    .input(z.object({ approvalId: z.string() }))
    .mutation(async ({ input }) => {
      const manager = getAgentManager();
      await manager.denyRequest(input.approvalId);
      return { success: true };
    }),
});
