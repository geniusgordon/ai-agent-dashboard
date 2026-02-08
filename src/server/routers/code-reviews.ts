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
   * List code reviews for a project (most recent first).
   */
  list: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      return getProjectManager().listCodeReviews(input.projectId);
    }),

  /**
   * Get a single code review by ID.
   */
  get: publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .query(({ input }) => {
      const review = getProjectManager().getCodeReview(input.reviewId);
      if (!review) throw new Error("Code review not found");
      return review;
    }),

  /**
   * Start a batch code review — spawns one agent per branch.
   * Persists review metadata in SQLite and binds to existing worktrees.
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

      // Persist the review batch
      const review = projectManager.createCodeReview({
        projectId: input.projectId,
        baseBranch: input.baseBranch,
        agentType: input.agentType,
        branchNames: input.branchNames,
      });

      // Spawn an agent for each branch in parallel
      const spawnPromises = review.branches.map(async (branch) => {
        // Look up existing worktree for this branch
        const worktree = projectManager.findWorktreeByBranch(
          input.projectId,
          branch.branchName,
        );
        const cwd = worktree?.path ?? project.repoPath;

        const client = await agentManager.spawnClient({
          agentType: input.agentType,
          cwd,
        });

        const session = await agentManager.createSession({
          clientId: client.id,
        });

        agentManager.renameSession(session.id, `[review] ${branch.branchName}`);

        // Update the persisted branch entry with session + worktree binding
        projectManager.updateCodeReviewBranch(branch.id, {
          sessionId: session.id,
          clientId: client.id,
          worktreeId: worktree?.id ?? null,
          status: "running",
        });

        // If worktree exists, create an agent assignment so it shows on WorktreeCard
        if (worktree) {
          projectManager.assignAgentToWorktree({
            sessionId: session.id,
            clientId: client.id,
            worktreeId: worktree.id,
            projectId: input.projectId,
          });
        }

        // Get diff context and send review prompt
        const [diff, files] = await Promise.all([
          getDiff(project.repoPath, input.baseBranch, branch.branchName),
          getFilesChanged(
            project.repoPath,
            input.baseBranch,
            branch.branchName,
          ),
        ]);

        const prompt = buildReviewPrompt(
          branch.branchName,
          input.baseBranch,
          files,
          diff,
        );

        agentManager.sendMessage(session.id, prompt);

        return {
          branchId: branch.id,
          sessionId: session.id,
          clientId: client.id,
        };
      });

      const failures: Array<{ branchName: string; error: string }> = [];

      const results = await Promise.allSettled(spawnPromises);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "rejected") {
          const branch = review.branches[i];
          const errorMsg = result.reason?.message ?? "Unknown error";
          failures.push({ branchName: branch.branchName, error: errorMsg });

          // Mark failed branch
          projectManager.updateCodeReviewBranch(branch.id, {
            status: "error",
            error: errorMsg,
          });
        }
      }

      // Update review-level status if any failures
      if (failures.length > 0) {
        projectManager.updateCodeReviewStatus(review.id);
      }

      // Return the fresh persisted review
      return projectManager.getCodeReview(review.id)!;
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
   * Updates review branch status to "merged" on success.
   */
  mergeBranches: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        baseBranch: z.string(),
        branchNames: z.array(z.string()).min(1),
        reviewId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const projectManager = getProjectManager();
      const project = projectManager.getProject(input.projectId);
      if (!project) throw new Error("Project not found");

      // Find the main worktree
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

      // Load review branches for status updates
      const review = projectManager.getCodeReview(input.reviewId);

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

        // Update review branch status
        if (review) {
          const reviewBranch = review.branches.find(
            (b) => b.branchName === branchName,
          );
          if (reviewBranch) {
            projectManager.updateCodeReviewBranch(reviewBranch.id, {
              status: result.success ? "merged" : "error",
              error: result.success ? null : (result.error ?? null),
            });
          }
        }

        // Stop on first failure — subsequent merges may depend on order
        if (!result.success) break;
      }

      // Update review-level status
      if (review) {
        projectManager.updateCodeReviewStatus(review.id);
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

  /**
   * Delete a code review record.
   */
  delete: publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(({ input }) => {
      getProjectManager().deleteCodeReview(input.reviewId);
    }),
});
