/**
 * Code Reviews Router - tRPC endpoints for code review orchestration
 *
 * Spawns one agent per branch to review changes. No persistent state —
 * reviews are just agent sessions visible in the normal Sessions list.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "../../integrations/trpc/init.js";
import { getAgentManager } from "../../lib/agents/index.js";
import { buildReviewPrompt } from "../../lib/code-review/prompt-builder.js";
import {
  getCommitCount,
  getCommitsSinceBranch,
  getDiff,
  getFilesChanged,
  getMergeBase,
  getProjectManager,
} from "../../lib/projects/index.js";

const AgentTypeSchema = z.enum(["gemini", "claude-code", "codex"]);

export const codeReviewsRouter = createTRPCRouter({
  /**
   * Start code reviews — spawns one agent per branch.
   * Returns the created session IDs.
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

      // Spawn an agent for each branch in parallel
      const spawnPromises = input.branchNames.map(async (branchName) => {
        const worktree = projectManager.findWorktreeByBranch(
          input.projectId,
          branchName,
        );
        const cwd = worktree?.path ?? project.repoPath;

        const client = await agentManager.findOrSpawnClient({
          agentType: input.agentType,
          cwd,
        });

        const session = await agentManager.createSession({
          clientId: client.id,
        });

        agentManager.renameSession(session.id, `[review] ${branchName}`);

        if (worktree) {
          projectManager.assignAgentToWorktree({
            sessionId: session.id,
            clientId: client.id,
            worktreeId: worktree.id,
            projectId: input.projectId,
          });
          agentManager.setSessionProjectContext(session.id, {
            projectId: input.projectId,
            worktreeId: worktree.id,
            worktreeBranch: worktree.branch,
          });
        }

        const [diff, files, mergeBase] = await Promise.all([
          getDiff(project.repoPath, input.baseBranch, branchName),
          getFilesChanged(project.repoPath, input.baseBranch, branchName),
          getMergeBase(project.repoPath, input.baseBranch, branchName),
        ]);

        const [baseDivergedCount, branchCommits] = await Promise.all([
          getCommitCount(project.repoPath, mergeBase, input.baseBranch),
          getCommitsSinceBranch(cwd, input.baseBranch),
        ]);

        const prompt = buildReviewPrompt({
          branchName,
          baseBranch: input.baseBranch,
          files,
          diff,
          mergeBase,
          baseDivergedCount,
          branchCommits,
        });

        agentManager.sendMessage(session.id, prompt);

        return session.id;
      });

      const results = await Promise.allSettled(spawnPromises);

      const sessionIds: string[] = [];
      const errors: string[] = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          sessionIds.push(result.value);
        } else {
          errors.push(result.reason?.message ?? "Unknown error");
        }
      }

      if (sessionIds.length === 0 && errors.length > 0) {
        throw new Error(`All reviews failed to start: ${errors.join("; ")}`);
      }

      return { sessionIds, errors };
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
});
