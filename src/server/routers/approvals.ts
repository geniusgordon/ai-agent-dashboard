/**
 * Approvals Router - tRPC endpoints for approval management
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";

export const approvalsRouter = createTRPCRouter({
  /**
   * Get pending approval requests (optionally filtered by project)
   */
  list: publicProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const manager = getAgentManager();
      const approvals = manager.getPendingApprovals();

      if (input?.projectId) {
        // Filter by the session's stamped projectId (survives after unassignment)
        return approvals.filter((a) => {
          const session = manager.getSession(a.sessionId);
          return session?.projectId === input.projectId;
        });
      }

      return approvals;
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
