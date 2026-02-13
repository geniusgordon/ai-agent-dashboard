/**
 * Session Action Prompt Builder
 *
 * Generates prompts for session-level git actions that delegate work
 * to the session's existing agent (commit, merge, PR creation).
 */

export function buildCommitPrompt(): string {
  return `Please commit the current changes in this repository:

1. Review the uncommitted changes with \`git status\` and \`git diff\`
2. Stage the appropriate changes (use \`git add -A\` or selectively stage)
3. Run lint and typecheck before committing:
   - \`pnpm check\` (lint and format)
   - \`pnpm typecheck\` (TypeScript type checking)
   If either command reports errors, fix them before proceeding. Re-stage any files changed by fixes.
4. Write a clear, descriptive commit message following conventional commits:
   - First line: concise summary in imperative mood (50-72 chars)
   - Optionally add a blank line and detailed description
5. Commit with \`git commit\`
6. Confirm the result with \`git log -1 --oneline\`

If there are no changes to commit, let me know.`;
}

export function buildMergePrompt(targetBranch: string): string {
  return `Please merge the current branch into \`${targetBranch}\`.

This project uses a bare repo with worktrees. Each branch has its own worktree directory.

1. Check the current branch: \`git branch --show-current\`
2. Check for merge conflicts before merging:
   \`\`\`
   git merge-tree $(git merge-base HEAD ${targetBranch}) HEAD ${targetBranch}
   \`\`\`
   If this reports conflicts, list them and stop — do NOT proceed with the merge. Ask me how to resolve them.
3. Find the worktree directory for \`${targetBranch}\`:
   \`\`\`
   git worktree list
   \`\`\`
4. \`cd\` into the \`${targetBranch}\` worktree directory and merge:
   \`\`\`
   cd <${targetBranch}-worktree-path>
   git merge $(git -C <original-worktree-path> branch --show-current)
   \`\`\`
5. Confirm the result: \`git log -1 --oneline\``;
}

export function buildPRPrompt(
  currentBranch: string,
  baseBranch: string,
): string {
  return `Please create a pull request from \`${currentBranch}\` into \`${baseBranch}\`:

1. Review the changes:
   - \`git log ${baseBranch}..${currentBranch} --oneline\`
   - \`git diff ${baseBranch}...${currentBranch} --stat\`
2. Write a clear PR title and description:
   - Title: concise summary of the changes
   - Description: what changed, why, and any relevant context
3. Create the PR:
   \`\`\`
   gh pr create --base ${baseBranch} --head ${currentBranch} --title "..." --body "..."
   \`\`\`
4. Share the PR URL

If there are no commits to create a PR from, let me know.`;
}
