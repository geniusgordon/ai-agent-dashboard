/**
 * Code Review Prompt Builder
 *
 * Constructs the prompt sent to AI agents for reviewing branch diffs.
 */

import type { ChangedFile, GitCommit } from "../projects/index.js";

export interface ReviewContext {
  branchName: string;
  baseBranch: string;
  files: ChangedFile[];
  diff: string;
  mergeBase: string;
  baseDivergedCount: number;
  branchCommits: GitCommit[];
}

const MAX_DIFF_CHARS = 200_000;
const MAX_COMMITS_SHOWN = 20;

function formatCommits(commits: GitCommit[]): string {
  if (commits.length === 0) return "(no commits)";

  const shown = commits.slice(0, MAX_COMMITS_SHOWN);
  const lines = shown.map((c) => `- \`${c.hash}\` ${c.message}`);

  if (commits.length > MAX_COMMITS_SHOWN) {
    lines.push(`- … and ${commits.length - MAX_COMMITS_SHOWN} more`);
  }

  return lines.join("\n");
}

/**
 * Build the review prompt sent to an AI agent.
 *
 * The agent receives this as its first (and only) message. It should contain
 * enough context for a thorough review: which branches are being compared,
 * what files changed, and the full diff.
 */
export function buildReviewPrompt(ctx: ReviewContext): string {
  const fileList = ctx.files
    .map((f) => `- ${f.path} (+${f.additions}, -${f.deletions})`)
    .join("\n");

  const totalAdditions = ctx.files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = ctx.files.reduce((sum, f) => sum + f.deletions, 0);

  const truncated = ctx.diff.length > MAX_DIFF_CHARS;
  const safeDiff = truncated ? ctx.diff.slice(0, MAX_DIFF_CHARS) : ctx.diff;
  const truncationNote = truncated
    ? "\n\n(Diff truncated — full diff too large to include)"
    : "";

  const shortMergeBase = ctx.mergeBase.slice(0, 10);

  const divergenceNote =
    ctx.baseDivergedCount > 0
      ? `\n\n> **Note**: \`${ctx.baseBranch}\` has advanced ${ctx.baseDivergedCount} commit(s) since this fork point. The diff below does NOT reflect those changes. Consider whether the reviewed changes may interact with recent updates to \`${ctx.baseBranch}\`.`
      : "";

  return `Review the changes in branch \`${ctx.branchName}\`.

## Diff context

- Base branch: \`${ctx.baseBranch}\`
- Fork point (merge-base): \`${shortMergeBase}\`
- The diff below shows only the changes introduced on \`${ctx.branchName}\` since the fork point — it does not include changes made on \`${ctx.baseBranch}\` after the fork.${divergenceNote}

## Branch commits

${formatCommits(ctx.branchCommits)}

## Changed files

${ctx.files.length} files changed, +${totalAdditions} -${totalDeletions}

${fileList}

## Diff

\`\`\`diff
${safeDiff}
\`\`\`${truncationNote}`;
}
