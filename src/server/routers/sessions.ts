import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "@/integrations/trpc/init";
import {
	type AgentType,
	ClaudeCodeAdapter,
	getSessionManager,
} from "@/lib/agents";

// Initialize adapters on first use
let initialized = false;
function ensureInitialized() {
	if (initialized) return;
	const manager = getSessionManager();
	manager.registerAdapter(new ClaudeCodeAdapter());
	// TODO: Add CodexAdapter when ready
	initialized = true;
}

// Input schemas
const agentTypeSchema = z.enum([
	"claude-code",
	"codex",
]) satisfies z.ZodType<AgentType>;

const spawnInputSchema = z.object({
	type: agentTypeSchema,
	cwd: z.string(),
	prompt: z.string(),
	model: z.string().optional(),
	permissionMode: z
		.enum(["default", "acceptEdits", "plan", "bypassPermissions"])
		.optional(),
});

const sessionIdSchema = z.object({
	sessionId: z.string().uuid(),
});

const sendMessageSchema = z.object({
	sessionId: z.string().uuid(),
	message: z.string(),
});

// Router
export const sessionsRouter = {
	/**
	 * List all sessions
	 */
	list: publicProcedure.query(() => {
		ensureInitialized();
		const manager = getSessionManager();
		const sessions = manager.listAllSessions();

		return sessions.map((s) => ({
			id: s.id,
			type: s.type,
			status: s.status,
			cwd: s.cwd,
			prompt: s.prompt,
			model: s.model,
			createdAt: s.createdAt.toISOString(),
			updatedAt: s.updatedAt.toISOString(),
		}));
	}),

	/**
	 * Get a single session by ID
	 */
	get: publicProcedure.input(sessionIdSchema).query(({ input }) => {
		ensureInitialized();
		const manager = getSessionManager();
		const session = manager.getSession(input.sessionId);

		if (!session) {
			return null;
		}

		return {
			id: session.id,
			type: session.type,
			status: session.status,
			cwd: session.cwd,
			prompt: session.prompt,
			model: session.model,
			nativeSessionId: session.nativeSessionId,
			error: session.error,
			createdAt: session.createdAt.toISOString(),
			updatedAt: session.updatedAt.toISOString(),
		};
	}),

	/**
	 * Create a new session
	 */
	create: publicProcedure
		.input(spawnInputSchema)
		.mutation(async ({ input }) => {
			ensureInitialized();
			const manager = getSessionManager();

			const session = await manager.spawn({
				type: input.type,
				cwd: input.cwd,
				prompt: input.prompt,
				model: input.model,
				permissionMode: input.permissionMode,
			});

			return {
				id: session.id,
				type: session.type,
				status: session.status,
				cwd: session.cwd,
				createdAt: session.createdAt.toISOString(),
			};
		}),

	/**
	 * Kill a session
	 */
	kill: publicProcedure.input(sessionIdSchema).mutation(async ({ input }) => {
		ensureInitialized();
		const manager = getSessionManager();
		await manager.kill(input.sessionId);
		return { success: true };
	}),

	/**
	 * Send a message to a running session
	 */
	sendMessage: publicProcedure
		.input(sendMessageSchema)
		.mutation(async ({ input }) => {
			ensureInitialized();
			const manager = getSessionManager();
			await manager.sendMessage(input.sessionId, input.message);
			return { success: true };
		}),

	/**
	 * Get pending approvals for a session
	 */
	getApprovals: publicProcedure.input(sessionIdSchema).query(({ input }) => {
		ensureInitialized();
		const manager = getSessionManager();
		const approvals = manager.getPendingApprovals(input.sessionId);

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
} satisfies TRPCRouterRecord;
