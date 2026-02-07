/**
 * Projects Router - tRPC endpoints for project management
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getProjectManager } from "../../lib/projects/index.js";

const ProjectSettingsSchema = z
  .object({
    defaultAgentType: z.enum(["gemini", "claude-code", "codex"]).optional(),
    autoCreateWorktree: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .optional();

export const projectsRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        repoPath: z.string().min(1),
        description: z.string().optional(),
        settings: ProjectSettingsSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      return manager.createProject(input);
    }),

  list: publicProcedure.query(() => {
    const manager = getProjectManager();
    return manager.listProjects();
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const manager = getProjectManager();
      return manager.getProject(input.id) ?? null;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        settings: ProjectSettingsSchema,
      }),
    )
    .mutation(({ input }) => {
      const manager = getProjectManager();
      return manager.updateProject(input.id, input);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const manager = getProjectManager();
      manager.deleteProject(input.id);
      return { success: true };
    }),

  importFromDirectory: publicProcedure
    .input(
      z.object({
        dirPath: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      return manager.importFromDirectory(input.dirPath, {
        name: input.name,
        description: input.description,
      });
    }),

  listBranches: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const manager = getProjectManager();
      return manager.listBranches(input.projectId);
    }),

  getAssignments: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const manager = getProjectManager();
      return manager.getAssignmentsForProject(input.projectId);
    }),
});
