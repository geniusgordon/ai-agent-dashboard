import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "@/integrations/trpc/init";
import { getSessionManager } from "@/lib/agents";

// Input schemas
const approveSchema = z.object({
	approvalId: z.string(),
	sessionId: z.string().uuid(),
});

const rejectSchema = z.object({
	approvalId: z.string(),
	sessionId: z.string().uuid(),
	reason: z.string().optional(),
});

// Router
export const approvalsRouter = {
	/**
	 * List all pending approvals across all sessions
	 */
	listAll: publicProcedure.query(() => {
		const manager = getSessionManager();
		const approvals = manager.getAllPendingApprovals();

		return approvals.map((a) => ({
			id: a.id,
			sessionId: a.sessionId,
			type: a.type,
			status: a.status,
			description: a.description,
			details: a.details,
			createdAt: a.createdAt.toISOString(),
		}));
	}),

	/**
	 * Approve a pending request
	 */
	approve: publicProcedure.input(approveSchema).mutation(async ({ input }) => {
		const manager = getSessionManager();
		await manager.approve(input.approvalId, input.sessionId);
		return { success: true };
	}),

	/**
	 * Reject a pending request
	 */
	reject: publicProcedure.input(rejectSchema).mutation(async ({ input }) => {
		const manager = getSessionManager();
		await manager.reject(input.approvalId, input.sessionId, input.reason);
		return { success: true };
	}),
} satisfies TRPCRouterRecord;
