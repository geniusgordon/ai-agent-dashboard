/**
 * Git Operations
 *
 * Git command wrappers using `simple-git` for typed results and robust error handling.
 * All user-provided inputs (branch names, refs, paths) are validated before use.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import simpleGit, {
  CheckRepoActions,
  type LogResult,
  type SimpleGit,
} from "simple-git";
import type { BranchInfo, GitWorktreeInfo } from "./types.js";

// =============================================================================
// simple-git instance factory
// =============================================================================

const GIT_TIMEOUT = { block: 15_000 };

function getGit(cwd: string): SimpleGit {
  return simpleGit({
    baseDir: cwd,
    maxConcurrentProcesses: 6,
    trimmed: true,
    timeout: GIT_TIMEOUT,
  });
}

// Custom log format matching our GitCommit type (short hash via %h)
const COMMIT_FORMAT = {
  hash: "%h",
  message: "%s",
  authorName: "%an",
  date: "%aI",
};

function mapLogToCommits(log: LogResult<typeof COMMIT_FORMAT>): GitCommit[] {
  return log.all.map((e) => ({
    hash: e.hash,
    message: e.message,
    authorName: e.authorName,
    date: e.date,
  }));
}

// =============================================================================
// Validation
// =============================================================================

const INVALID_BRANCH_CHARS = /[\s~^:?*[\\]/;
const DOUBLE_DOT = /\.\./;
const LOCK_SUFFIX = /\.lock$/;

export function validateBranchName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error("Branch name cannot be empty");
  }
  if (name.startsWith("-")) {
    throw new Error("Branch name cannot start with '-'");
  }
  if (name.startsWith(".") || name.endsWith(".")) {
    throw new Error("Branch name cannot start or end with '.'");
  }
  if (INVALID_BRANCH_CHARS.test(name)) {
    throw new Error(
      "Branch name contains invalid characters (spaces, ~, ^, :, ?, *, [, \\)",
    );
  }
  if (DOUBLE_DOT.test(name)) {
    throw new Error("Branch name cannot contain '..'");
  }
  if (LOCK_SUFFIX.test(name)) {
    throw new Error("Branch name cannot end with '.lock'");
  }
  if (name.endsWith("/")) {
    throw new Error("Branch name cannot end with '/'");
  }
}

const HEX_SHA = /^[0-9a-f]{4,40}$/;

/**
 * Validate a git ref that may be a branch name or a hex commit SHA.
 * Used for functions like `getCommitCount` where inputs can come from
 * either user input (branch names) or prior git output (SHA hashes).
 */
export function validateRef(ref: string): void {
  if (!ref || ref.length === 0) {
    throw new Error("Git ref cannot be empty");
  }
  if (ref.startsWith("-")) {
    throw new Error("Git ref cannot start with '-'");
  }
  // Accept full/abbreviated hex SHAs (e.g. from getMergeBase output)
  if (HEX_SHA.test(ref)) return;
  // Otherwise validate as a branch name
  validateBranchName(ref);
}

export function validatePath(dirPath: string): void {
  if (!dirPath) {
    throw new Error("Path cannot be empty");
  }
  if (!existsSync(dirPath)) {
    throw new Error(`Path does not exist: ${dirPath}`);
  }
}

// =============================================================================
// Git Operations
// =============================================================================

export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    return await getGit(dirPath).checkIsRepo();
  } catch {
    return false;
  }
}

export async function isBareRepo(dirPath: string): Promise<boolean> {
  try {
    return await getGit(dirPath).checkIsRepo(CheckRepoActions.BARE);
  } catch {
    return false;
  }
}

export async function getRepoRoot(dirPath: string): Promise<string> {
  const bare = await isBareRepo(dirPath);
  if (bare) return resolve(dirPath);

  return getGit(dirPath).revparse(["--show-toplevel"]);
}

export async function getCurrentBranch(
  dirPath: string,
): Promise<string | null> {
  try {
    const branch = await getGit(dirPath).revparse(["--abbrev-ref", "HEAD"]);
    return branch === "HEAD" ? null : branch;
  } catch {
    return null;
  }
}

export async function getBranchInfo(dirPath: string): Promise<BranchInfo> {
  const isRepo = await isGitRepo(dirPath);
  if (!isRepo) {
    return { branch: null, isGitRepo: false };
  }

  const branch = await getCurrentBranch(dirPath);
  return { branch, isGitRepo: true };
}

export async function listWorktrees(
  repoPath: string,
): Promise<GitWorktreeInfo[]> {
  const stdout = await getGit(repoPath).raw([
    "worktree",
    "list",
    "--porcelain",
  ]);

  const worktrees: GitWorktreeInfo[] = [];
  let current: Partial<GitWorktreeInfo> = {};

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) worktrees.push(current as GitWorktreeInfo);
      current = { path: line.slice(9).trim(), isBare: false };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5).trim();
    } else if (line.startsWith("branch ")) {
      // "branch refs/heads/main" → "main"
      current.branch = line.slice(7).trim().replace("refs/heads/", "");
    } else if (line === "bare") {
      current.isBare = true;
    } else if (line === "detached") {
      current.branch = current.branch ?? "(detached)";
    } else if (line === "" && current.path) {
      worktrees.push(current as GitWorktreeInfo);
      current = {};
    }
  }

  if (current.path) worktrees.push(current as GitWorktreeInfo);

  // Bare worktrees have no `branch` line in porcelain output — resolve from HEAD
  for (const wt of worktrees) {
    if (wt.isBare && !wt.branch) {
      wt.branch = (await getCurrentBranch(wt.path)) ?? undefined!;
    }
  }

  return worktrees;
}

export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  options: { createNewBranch: boolean; baseBranch?: string },
): Promise<void> {
  validateBranchName(branchName);
  if (options.baseBranch) {
    validateBranchName(options.baseBranch);
  }

  const args = ["worktree", "add"];

  if (options.createNewBranch) {
    args.push("-b", branchName, worktreePath);
    if (options.baseBranch) {
      args.push(options.baseBranch);
    }
  } else {
    args.push(worktreePath, branchName);
  }

  await getGit(repoPath).raw(args);
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false,
): Promise<void> {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(worktreePath);

  await getGit(repoPath).raw(args);
}

export async function isBranchMerged(
  repoPath: string,
  branchName: string,
  baseBranch: string,
): Promise<boolean> {
  validateBranchName(branchName);
  validateBranchName(baseBranch);

  const output = await getGit(repoPath).raw(["branch", "--merged", baseBranch]);
  const merged = output
    .split("\n")
    .map((line) => line.replace(/^[* ]+/, "").trim())
    .filter(Boolean);
  return merged.includes(branchName);
}

export async function hasUncommittedChanges(
  worktreePath: string,
): Promise<boolean> {
  try {
    const status = await getGit(worktreePath).status();
    return !status.isClean();
  } catch {
    return false;
  }
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const summary = await getGit(repoPath).branchLocal();
  return summary.all;
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  const sg = getGit(repoPath);

  // Try remote HEAD first — this correctly resolves the default branch
  // regardless of which branch is currently checked out locally.
  try {
    const ref = await sg.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    // "refs/remotes/origin/main" → "main"
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // No origin remote or origin/HEAD not set — fall through
  }

  // Fallback: check for common default branch names
  try {
    const branches = await listBranches(repoPath);
    for (const candidate of ["dev", "staging", "main", "master"]) {
      if (branches.includes(candidate)) return candidate;
    }
    // Last resort: bare repo HEAD or first branch
    const head = await sg.raw(["symbolic-ref", "--short", "HEAD"]);
    return head;
  } catch {
    return "main";
  }
}

export interface GitCommit {
  hash: string;
  message: string;
  authorName: string;
  date: string;
}

export async function getRecentCommits(
  worktreePath: string,
  limit = 10,
): Promise<GitCommit[]> {
  try {
    const log = await getGit(worktreePath).log({
      maxCount: limit,
      format: COMMIT_FORMAT,
    });
    return mapLogToCommits(log);
  } catch {
    return [];
  }
}

/**
 * Get commits on the current branch that are not on the given base branch.
 * Uses `git log base..HEAD` to show only the branch-specific history.
 * Returns empty array for the main/default branch or if there are no unique commits.
 */
export async function getCommitsSinceBranch(
  worktreePath: string,
  baseBranch: string,
  limit = 50,
): Promise<GitCommit[]> {
  try {
    const log = await getGit(worktreePath).log({
      from: baseBranch,
      to: "HEAD",
      symmetric: false,
      maxCount: limit,
      format: COMMIT_FORMAT,
    });
    return mapLogToCommits(log);
  } catch {
    return [];
  }
}

// =============================================================================
// Code Review Operations
// =============================================================================

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

export async function getMergeBase(
  repoPath: string,
  branchA: string,
  branchB: string,
): Promise<string> {
  validateBranchName(branchA);
  validateBranchName(branchB);

  return getGit(repoPath).raw(["merge-base", branchA, branchB]);
}

export async function getCommitCount(
  repoPath: string,
  fromRef: string,
  toRef: string,
): Promise<number> {
  validateRef(fromRef);
  validateRef(toRef);

  const count = await getGit(repoPath).raw([
    "rev-list",
    "--count",
    `${fromRef}..${toRef}`,
  ]);
  return Number.parseInt(count, 10);
}

export async function getDiff(
  repoPath: string,
  baseBranch: string,
  compareBranch: string,
): Promise<string> {
  validateBranchName(baseBranch);
  validateBranchName(compareBranch);

  return getGit(repoPath).diff([`${baseBranch}...${compareBranch}`]);
}

export async function getFilesChanged(
  repoPath: string,
  baseBranch: string,
  compareBranch: string,
): Promise<ChangedFile[]> {
  validateBranchName(baseBranch);
  validateBranchName(compareBranch);

  try {
    const stdout = await getGit(repoPath).diff([
      "--numstat",
      `${baseBranch}...${compareBranch}`,
    ]);

    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [add, del, path] = line.split("\t");
        return {
          path,
          additions: add === "-" ? 0 : Number.parseInt(add, 10),
          deletions: del === "-" ? 0 : Number.parseInt(del, 10),
        };
      });
  } catch {
    return [];
  }
}

export interface MergeResult {
  success: boolean;
  commitHash?: string;
  error?: string;
}

export async function mergeBranch(
  worktreePath: string,
  branchName: string,
  options?: { noFf?: boolean; message?: string },
): Promise<MergeResult> {
  validateBranchName(branchName);
  const sg = getGit(worktreePath);

  const args: string[] = [];
  if (options?.noFf) args.push("--no-ff");
  if (options?.message) args.push("-m", options.message);
  args.push(branchName);

  try {
    await sg.merge(args);
    // Get the merge commit hash
    const commitHash = await sg.revparse(["--short", "HEAD"]);
    return { success: true, commitHash };
  } catch (error) {
    // Abort the failed merge to leave worktree clean
    try {
      await sg.merge(["--abort"]);
    } catch {
      // Already clean or no merge in progress
    }
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function deleteBranch(
  repoPath: string,
  branchName: string,
  force = false,
): Promise<void> {
  validateBranchName(branchName);

  // Safety: refuse to delete a branch that's checked out in any worktree
  const worktrees = await listWorktrees(repoPath);
  const checkedOut = worktrees.find((wt) => wt.branch === branchName);
  if (checkedOut) {
    throw new Error(
      `Cannot delete branch '${branchName}': checked out in worktree at '${checkedOut.path}'`,
    );
  }

  await getGit(repoPath).deleteLocalBranch(branchName, force);
}

export async function pushToRemote(
  worktreePath: string,
  branchName?: string,
  setUpstream = false,
): Promise<{ success: boolean; error?: string }> {
  if (branchName) validateBranchName(branchName);

  const sg = getGit(worktreePath);
  try {
    const args: string[] = ["origin"];
    if (branchName) args.push(branchName);
    if (setUpstream) {
      await sg.raw(["push", "--set-upstream", ...args]);
    } else {
      await sg.push(args);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function pullFromRemote(
  worktreePath: string,
  branchName?: string,
): Promise<{ success: boolean; error?: string }> {
  if (branchName) validateBranchName(branchName);

  const sg = getGit(worktreePath);
  try {
    await sg.pull("origin", branchName ?? undefined);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
