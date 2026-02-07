/**
 * Worktrees Router - tRPC endpoints for git worktree management
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getProjectManager } from "../../lib/projects/index.js";

export const worktreesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const manager = getProjectManager();
      await manager.syncWorktrees(input.projectId);
      return manager.listWorktrees(input.projectId);
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const manager = getProjectManager();
      return manager.getWorktree(input.id) ?? null;
    }),

  create: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        branchName: z.string().min(1),
        baseBranch: z.string().optional(),
        createNewBranch: z.boolean(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      return manager.createWorktree(input);
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.string(),
        force: z.boolean().optional(),
        deleteBranch: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      await manager.deleteWorktree(input.id, input.force, input.deleteBranch);
      return { success: true };
    }),

  getStatus: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const manager = getProjectManager();
      return manager.getWorktreeStatus(input.id);
    }),

  sync: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      await manager.syncWorktrees(input.projectId);
      return { success: true };
    }),

  getAssignments: publicProcedure
    .input(z.object({ worktreeId: z.string() }))
    .query(({ input }) => {
      const manager = getProjectManager();
      return manager.getAssignmentsForWorktree(input.worktreeId);
    }),

  assignAgent: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        clientId: z.string(),
        worktreeId: z.string(),
        projectId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const manager = getProjectManager();
      return manager.assignAgentToWorktree(input);
    }),

  unassignAgent: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const manager = getProjectManager();
      manager.unassignAgent(input.sessionId);
      return { success: true };
    }),
});
