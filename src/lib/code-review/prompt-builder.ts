/**
 * Code Review Prompt Builder
 *
 * Constructs the prompt sent to AI agents for reviewing branch diffs.
 */

import type { ChangedFile } from "../projects/index.js";

/**
 * Build the review prompt sent to an AI agent.
 *
 * The agent receives this as its first (and only) message. It should contain
 * enough context for a thorough review: which branches are being compared,
 * what files changed, and the full diff.
 */
export function buildReviewPrompt(
  branchName: string,
  baseBranch: string,
  files: ChangedFile[],
  diff: string,
): string {
  const fileList = files
    .map((f) => `- ${f.path} (+${f.additions}, -${f.deletions})`)
    .join("\n");

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return `Review the changes in branch \`${branchName}\` compared to \`${baseBranch}\`.

${files.length} files changed, +${totalAdditions} -${totalDeletions}

${fileList}

\`\`\`diff
${diff}
\`\`\``;
}
