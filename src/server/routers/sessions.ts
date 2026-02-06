/**
 * Sessions Router - tRPC endpoints for agent session management
 */

import { z } from "zod";
import {
	createTRPCRouter,
	publicProcedure,
} from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";

const AgentTypeSchema = z.enum(["gemini", "claude-code", "codex"]);

export const sessionsRouter = createTRPCRouter({
	// ---------------------------------------------------------------------------
	// Client Management
	// ---------------------------------------------------------------------------

	/**
	 * Spawn a new ACP client for an agent type
	 */
	spawnClient: publicProcedure
		.input(
			z.object({
				agentType: AgentTypeSchema,
				cwd: z.string(),
				env: z.record(z.string(), z.string()).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			return manager.spawnClient(input);
		}),

	/**
	 * Stop a client
	 */
	stopClient: publicProcedure
		.input(z.object({ clientId: z.string() }))
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			await manager.stopClient(input.clientId);
			return { success: true };
		}),

	/**
	 * List all clients
	 */
	listClients: publicProcedure.query(async () => {
		const manager = getAgentManager();
		return manager.listClients();
	}),

	/**
	 * Get a specific client
	 */
	getClient: publicProcedure
		.input(z.object({ clientId: z.string() }))
		.query(async ({ input }) => {
			const manager = getAgentManager();
			return manager.getClient(input.clientId) ?? null;
		}),

	// ---------------------------------------------------------------------------
	// Session Management
	// ---------------------------------------------------------------------------

	/**
	 * Create a new session on a client
	 */
	createSession: publicProcedure
		.input(
			z.object({
				clientId: z.string(),
				cwd: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			try {
				console.log("[createSession] Starting with input:", input);
				const session = await manager.createSession(input);
				console.log("[createSession] Success:", session.id);
				return session;
			} catch (error) {
				console.error("[createSession] Error:", error);
				throw error;
			}
		}),

	/**
	 * List all sessions (optionally filtered by client)
	 */
	listSessions: publicProcedure
		.input(z.object({ clientId: z.string().optional() }).optional())
		.query(async ({ input }) => {
			const manager = getAgentManager();
			return manager.listSessions(input?.clientId);
		}),

	/**
	 * Get a specific session
	 */
	getSession: publicProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ input }) => {
			const manager = getAgentManager();
			return manager.getSession(input.sessionId) ?? null;
		}),

	// ---------------------------------------------------------------------------
	// Communication
	// ---------------------------------------------------------------------------

	/**
	 * Send a message to a session
	 */
	sendMessage: publicProcedure
		.input(
			z.object({
				sessionId: z.string(),
				message: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			await manager.sendMessage(input.sessionId, input.message);
			return { success: true };
		}),

	/**
	 * Get event history for a session
	 */
	getSessionEvents: publicProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ input }) => {
			const manager = getAgentManager();
			return manager.getSessionEvents(input.sessionId);
		}),

	/**
	 * Kill a session
	 */
	killSession: publicProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			manager.killSession(input.sessionId);
			return { success: true };
		}),

	/**
	 * Kill a client (and all its sessions)
	 */
	killClient: publicProcedure
		.input(z.object({ clientId: z.string() }))
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			manager.killClient(input.clientId);
			return { success: true };
		}),

	/**
	 * Rename a session
	 */
	renameSession: publicProcedure
		.input(z.object({ sessionId: z.string(), name: z.string() }))
		.mutation(async ({ input }) => {
			const manager = getAgentManager();
			manager.renameSession(input.sessionId, input.name);
			return { success: true };
		}),
});
