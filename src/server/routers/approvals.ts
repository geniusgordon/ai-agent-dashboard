/**
 * Approvals Router - tRPC endpoints for approval management
 */

import { z } from "zod";
import { publicProcedure, createTRPCRouter } from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";

export const approvalsRouter = createTRPCRouter({
  /**
   * Get all pending approval requests
   */
  list: publicProcedure.query(async () => {
    const manager = getAgentManager();
    return manager.getPendingApprovals();
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
