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
3. Write a clear, descriptive commit message following conventional commits:
   - First line: concise summary in imperative mood (50-72 chars)
   - Optionally add a blank line and detailed description
4. Commit with \`git commit\`
5. Confirm the result with \`git log -1 --oneline\`

If there are no changes to commit, let me know.`;
}

export function buildMergePrompt(targetBranch: string): string {
  return `Please merge \`${targetBranch}\` into the current branch:

1. Check the current branch with \`git branch --show-current\`
2. Fetch latest: \`git fetch origin\`
3. Merge: \`git merge ${targetBranch}\`
4. If there are conflicts:
   - Review conflicting files with \`git status\`
   - Examine each conflict and resolve by keeping the appropriate changes
   - Stage resolved files and complete the merge with \`git commit\`
5. Confirm the result with \`git log -1 --oneline\`

Preserve important changes from both branches when resolving conflicts.`;
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
