/**
 * Code Reviews Router - tRPC endpoints for batch code review orchestration
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";
import { buildReviewPrompt } from "../../lib/code-review/prompt-builder.js";
import {
  deleteBranch,
  getCurrentBranch,
} from "../../lib/projects/git-operations.js";
import {
  getDiff,
  getFilesChanged,
  getProjectManager,
  mergeBranch,
} from "../../lib/projects/index.js";

const AgentTypeSchema = z.enum(["gemini", "claude-code", "codex"]);

export const codeReviewsRouter = createTRPCRouter({
  /**
   * Start a batch code review — spawns one agent per branch.
   * Returns session info so the UI can track progress.
   */
  startBatch: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        baseBranch: z.string(),
        branchNames: z.array(z.string()).min(1),
        agentType: AgentTypeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const projectManager = getProjectManager();
      const project = projectManager.getProject(input.projectId);
      if (!project) throw new Error("Project not found");

      const agentManager = getAgentManager();
      const reviewId = `review_${Date.now()}`;

      const sessions: Array<{
        branchName: string;
        sessionId: string;
        clientId: string;
      }> = [];

      // Spawn an agent for each branch in parallel
      const spawnPromises = input.branchNames.map(async (branchName) => {
        const client = await agentManager.spawnClient({
          agentType: input.agentType,
          cwd: project.repoPath,
        });

        const session = await agentManager.createSession({
          clientId: client.id,
        });

        agentManager.renameSession(session.id, `[review] ${branchName}`);

        // Get diff context
        const [diff, files] = await Promise.all([
          getDiff(project.repoPath, input.baseBranch, branchName),
          getFilesChanged(project.repoPath, input.baseBranch, branchName),
        ]);

        const prompt = buildReviewPrompt(
          branchName,
          input.baseBranch,
          files,
          diff,
        );

        agentManager.sendMessage(session.id, prompt);

        return { branchName, sessionId: session.id, clientId: client.id };
      });

      const failures: Array<{ branchName: string; error: string }> = [];

      const results = await Promise.allSettled(spawnPromises);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          sessions.push(result.value);
        } else {
          failures.push({
            branchName: input.branchNames[i],
            error: result.reason?.message ?? "Unknown error",
          });
        }
      }

      return { reviewId, sessions, failures };
    }),

  /**
   * Get diff for a single branch vs base (for UI preview).
   */
  getDiff: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        baseBranch: z.string(),
        compareBranch: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const projectManager = getProjectManager();
      const project = projectManager.getProject(input.projectId);
      if (!project) throw new Error("Project not found");

      const [diff, files] = await Promise.all([
        getDiff(project.repoPath, input.baseBranch, input.compareBranch),
        getFilesChanged(
          project.repoPath,
          input.baseBranch,
          input.compareBranch,
        ),
      ]);

      return { diff, files };
    }),

  /**
   * Merge selected branches into the base branch.
   * Runs in the main worktree after verifying the correct branch is checked out.
   */
  mergeBranches: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        baseBranch: z.string(),
        branchNames: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const projectManager = getProjectManager();
      const project = projectManager.getProject(input.projectId);
      if (!project) throw new Error("Project not found");

      // Find the main worktree (first in list, sorted by is_main_worktree DESC)
      const worktrees = projectManager.listWorktrees(input.projectId);
      const mainWorktree = worktrees.find((wt) => wt.isMainWorktree);
      if (!mainWorktree) {
        throw new Error("No main worktree found for this project");
      }

      // Verify the main worktree has the expected base branch checked out
      const currentBranch = await getCurrentBranch(mainWorktree.path);
      if (currentBranch !== input.baseBranch) {
        throw new Error(
          `Main worktree has '${currentBranch}' checked out, expected '${input.baseBranch}'`,
        );
      }

      const results: Array<{
        branchName: string;
        success: boolean;
        commitHash?: string;
        error?: string;
      }> = [];

      // Merge sequentially to avoid conflicts between merges
      for (const branchName of input.branchNames) {
        const result = await mergeBranch(mainWorktree.path, branchName, {
          noFf: true,
          message: `Merge branch '${branchName}'`,
        });
        results.push({ branchName, ...result });

        // Stop on first failure — subsequent merges may depend on order
        if (!result.success) break;
      }

      return { results };
    }),

  /**
   * Clean up after merge — delete worktrees and/or branches.
   */
  cleanup: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        branchNames: z.array(z.string()).min(1),
        deleteWorktrees: z.boolean(),
        deleteBranches: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const projectManager = getProjectManager();
      const project = projectManager.getProject(input.projectId);
      if (!project) throw new Error("Project not found");

      const worktrees = projectManager.listWorktrees(input.projectId);

      const results: Array<{
        branchName: string;
        worktreeDeleted: boolean;
        branchDeleted: boolean;
        error?: string;
      }> = [];

      for (const branchName of input.branchNames) {
        const result = {
          branchName,
          worktreeDeleted: false,
          branchDeleted: false,
        } as (typeof results)[number];

        try {
          // Delete worktree if exists and requested
          const worktree = worktrees.find((wt) => wt.branch === branchName);
          if (worktree && !worktree.isMainWorktree && input.deleteWorktrees) {
            await projectManager.deleteWorktree(
              worktree.id,
              true,
              input.deleteBranches,
            );
            result.worktreeDeleted = true;
            result.branchDeleted = input.deleteBranches;
          } else if (input.deleteBranches && !worktree) {
            await deleteBranch(project.repoPath, branchName, true);
            result.branchDeleted = true;
          }
        } catch (error) {
          result.error = (error as Error).message;
        }

        results.push(result);
      }

      return { results };
    }),
});
