/**
 * Worktrees Router - tRPC endpoints for git worktree management
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";
import {
  getCommitsSinceBranch,
  getDefaultBranch,
  getProjectManager,
  getRecentCommits,
} from "../../lib/projects/index.js";
import type { Worktree } from "../../lib/projects/types.js";
import { collapsePath } from "../../lib/utils/expand-path.js";

function collapseWorktree(w: Worktree): Worktree {
  return { ...w, path: collapsePath(w.path) };
}

export const worktreesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const manager = getProjectManager();
      await manager.syncWorktrees(input.projectId);
      return manager.listWorktrees(input.projectId).map(collapseWorktree);
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const manager = getProjectManager();
      const worktree = manager.getWorktree(input.id);
      return worktree ? collapseWorktree(worktree) : null;
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
      return collapseWorktree(await manager.createWorktree(input));
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

  getRecentCommits: publicProcedure
    .input(
      z.object({ id: z.string(), limit: z.number().min(1).max(50).optional() }),
    )
    .query(async ({ input }) => {
      const manager = getProjectManager();
      const worktree = manager.getWorktree(input.id);
      if (!worktree) throw new Error(`Worktree not found: ${input.id}`);

      return getRecentCommits(worktree.path, input.limit ?? 10);
    }),

  getBranchCommits: publicProcedure
    .input(
      z.object({ id: z.string(), limit: z.number().min(1).max(50).optional() }),
    )
    .query(async ({ input }) => {
      const manager = getProjectManager();
      const worktree = manager.getWorktree(input.id);
      if (!worktree) throw new Error(`Worktree not found: ${input.id}`);

      // Main worktree has no "since branch" — return empty
      if (worktree.isMainWorktree) return [];

      const project = manager.getProject(worktree.projectId);
      if (!project) throw new Error(`Project not found: ${worktree.projectId}`);

      const baseBranch =
        worktree.baseBranch ?? (await getDefaultBranch(project.repoPath));
      return getCommitsSinceBranch(
        worktree.path,
        baseBranch,
        input.limit ?? 50,
      );
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
      const projectManager = getProjectManager();
      const assignment = projectManager.assignAgentToWorktree(input);

      // Stamp session with project context so it survives after unassignment
      const worktree = projectManager.getWorktree(input.worktreeId);
      if (worktree) {
        getAgentManager().setSessionProjectContext(input.sessionId, {
          projectId: input.projectId,
          worktreeId: input.worktreeId,
          worktreeBranch: worktree.branch,
        });
      }

      return assignment;
    }),

  unassignAgent: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const manager = getProjectManager();
      manager.unassignAgent(input.sessionId);
      return { success: true };
    }),

  detectDocuments: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      const { expandPath } = await import("../../lib/utils/expand-path.js");
      const absPath = expandPath(input.worktreePath);
      const patterns = [
        { dir: "docs", match: /^(handoff|learnings|summary)/i },
        { dir: ".", match: /^HANDOFF\.md$/i },
      ];
      const results: Array<{
        path: string;
        name: string;
        modifiedAt: string;
        content: string;
      }> = [];

      for (const { dir, match } of patterns) {
        const dirPath = join(absPath, dir);
        let entries: string[];
        try {
          entries = await readdir(dirPath);
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (!match.test(entry)) continue;
          const filePath = join(dirPath, entry);
          try {
            const s = await stat(filePath);
            if (!s.isFile()) continue;
            const content = await readFile(filePath, "utf-8");
            results.push({
              path: relative(absPath, filePath),
              name: entry,
              modifiedAt: s.mtime.toISOString(),
              content: content.slice(0, 10000),
            });
          } catch {}
        }
      }

      return results;
    }),
});
