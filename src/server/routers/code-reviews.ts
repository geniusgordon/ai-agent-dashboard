/**
 * Code Reviews Router - tRPC endpoints for code review orchestration
 *
 * Each code review is one branch. Batch creation spawns multiple reviews
 * with a shared batch_id, but each review operates independently.
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
   * Start code reviews — spawns one agent per branch.
   * Creates independent review rows sharing a batch_id.
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

      // Create individual review rows (shares a batch_id)
      const reviews = projectManager.createCodeReviews({
        projectId: input.projectId,
        baseBranch: input.baseBranch,
        agentType: input.agentType,
        branchNames: input.branchNames,
      });

      // Spawn an agent for each review in parallel
      const spawnPromises = reviews.map(async (review) => {
        const worktree = projectManager.findWorktreeByBranch(
          input.projectId,
          review.branchName,
        );
        const cwd = worktree?.path ?? project.repoPath;

        const client = await agentManager.spawnClient({
          agentType: input.agentType,
          cwd,
        });

        const session = await agentManager.createSession({
          clientId: client.id,
        });

        agentManager.renameSession(session.id, `[review] ${review.branchName}`);

        projectManager.updateCodeReview(review.id, {
          sessionId: session.id,
          clientId: client.id,
          worktreeId: worktree?.id ?? null,
          status: "running",
        });

        if (worktree) {
          projectManager.assignAgentToWorktree({
            sessionId: session.id,
            clientId: client.id,
            worktreeId: worktree.id,
            projectId: input.projectId,
          });
        }

        const [diff, files] = await Promise.all([
          getDiff(project.repoPath, input.baseBranch, review.branchName),
          getFilesChanged(
            project.repoPath,
            input.baseBranch,
            review.branchName,
          ),
        ]);

        const prompt = buildReviewPrompt(
          review.branchName,
          input.baseBranch,
          files,
          diff,
        );

        agentManager.sendMessage(session.id, prompt);
      });

      const results = await Promise.allSettled(spawnPromises);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "rejected") {
          const errorMsg = result.reason?.message ?? "Unknown error";
          projectManager.updateCodeReview(reviews[i].id, {
            status: "error",
            error: errorMsg,
          });
        }
      }

      // Return fresh reviews
      return reviews.map((r) => projectManager.getCodeReview(r.id)!);
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
   * Merge a single reviewed branch into the base branch.
   */
  merge: publicProcedure
    .input(
      z.object({
        reviewId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const projectManager = getProjectManager();
      const review = projectManager.getCodeReview(input.reviewId);
      if (!review) throw new Error("Code review not found");

      const project = projectManager.getProject(review.projectId);
      if (!project) throw new Error("Project not found");

      const worktrees = projectManager.listWorktrees(review.projectId);
      const mainWorktree = worktrees.find((wt) => wt.isMainWorktree);
      if (!mainWorktree) {
        throw new Error("No main worktree found for this project");
      }

      const currentBranch = await getCurrentBranch(mainWorktree.path);
      if (currentBranch !== review.baseBranch) {
        throw new Error(
          `Main worktree has '${currentBranch}' checked out, expected '${review.baseBranch}'`,
        );
      }

      const result = await mergeBranch(mainWorktree.path, review.branchName, {
        noFf: true,
        message: `Merge branch '${review.branchName}'`,
      });

      projectManager.updateCodeReview(review.id, {
        status: result.success ? "merged" : "error",
        error: result.success ? null : (result.error ?? null),
      });

      return result;
    }),

  /**
   * Clean up after merge — delete worktree and/or branch for a review.
   */
  cleanup: publicProcedure
    .input(
      z.object({
        reviewId: z.string(),
        deleteWorktree: z.boolean(),
        deleteBranch: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const projectManager = getProjectManager();
      const review = projectManager.getCodeReview(input.reviewId);
      if (!review) throw new Error("Code review not found");

      const project = projectManager.getProject(review.projectId);
      if (!project) throw new Error("Project not found");

      const result = {
        worktreeDeleted: false,
        branchDeleted: false,
        error: undefined as string | undefined,
      };

      try {
        const worktree = projectManager.findWorktreeByBranch(
          review.projectId,
          review.branchName,
        );

        if (worktree && !worktree.isMainWorktree && input.deleteWorktree) {
          await projectManager.deleteWorktree(
            worktree.id,
            true,
            input.deleteBranch,
          );
          result.worktreeDeleted = true;
          result.branchDeleted = input.deleteBranch;
        } else if (input.deleteBranch && !worktree) {
          await deleteBranch(project.repoPath, review.branchName, true);
          result.branchDeleted = true;
        }
      } catch (error) {
        result.error = (error as Error).message;
      }

      return result;
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
