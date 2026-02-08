/**
 * Git Operations
 *
 * Safe git command wrappers using `execFile` (not `exec`) for shell injection prevention.
 * All inputs are validated before use.
 */

import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { BranchInfo, GitWorktreeInfo } from "./types.js";

const execFile = promisify(execFileCb);

const TIMEOUT = 15_000;

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

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFile("git", args, { cwd, timeout: TIMEOUT });
}

export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    await git(["rev-parse", "--git-dir"], dirPath);
    return true;
  } catch {
    return false;
  }
}

export async function isBareRepo(dirPath: string): Promise<boolean> {
  try {
    const { stdout } = await git(
      ["rev-parse", "--is-bare-repository"],
      dirPath,
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function getRepoRoot(dirPath: string): Promise<string> {
  const bare = await isBareRepo(dirPath);
  if (bare) return resolve(dirPath);

  const { stdout } = await git(["rev-parse", "--show-toplevel"], dirPath);
  return stdout.trim();
}

export async function getCurrentBranch(
  dirPath: string,
): Promise<string | null> {
  try {
    const { stdout } = await git(
      ["rev-parse", "--abbrev-ref", "HEAD"],
      dirPath,
    );
    const branch = stdout.trim();
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
  const { stdout } = await git(["worktree", "list", "--porcelain"], repoPath);

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

  const args = ["worktree", "add"];

  if (options.createNewBranch) {
    args.push("-b", branchName, worktreePath);
    if (options.baseBranch) {
      args.push(options.baseBranch);
    }
  } else {
    args.push(worktreePath, branchName);
  }

  await git(args, repoPath);
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false,
): Promise<void> {
  const args = ["worktree", "remove"];
  if (force) args.push("--force");
  args.push(worktreePath);

  await git(args, repoPath);
}

export async function hasUncommittedChanges(
  worktreePath: string,
): Promise<boolean> {
  try {
    const { stdout } = await git(["status", "--porcelain"], worktreePath);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function listBranches(repoPath: string): Promise<string[]> {
  const { stdout } = await git(
    ["branch", "--list", "--format=%(refname:short)"],
    repoPath,
  );

  return stdout
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await git(["symbolic-ref", "--short", "HEAD"], repoPath);
    return stdout.trim();
  } catch {
    // Fallback for bare repos or detached HEAD — use first branch
    const branches = await listBranches(repoPath);
    return branches[0] ?? "main";
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
    const SEP = "<<SEP>>";
    const { stdout } = await git(
      [
        "log",
        `--max-count=${limit}`,
        `--format=${["%h", "%s", "%an", "%aI"].join(SEP)}`,
      ],
      worktreePath,
    );

    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, message, authorName, date] = line.split(SEP);
        return { hash, message, authorName, date };
      });
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

export async function getDiff(
  repoPath: string,
  baseBranch: string,
  compareBranch: string,
): Promise<string> {
  validateBranchName(baseBranch);
  validateBranchName(compareBranch);

  const { stdout } = await git(
    ["diff", `${baseBranch}...${compareBranch}`],
    repoPath,
  );
  return stdout;
}

export async function getFilesChanged(
  repoPath: string,
  baseBranch: string,
  compareBranch: string,
): Promise<ChangedFile[]> {
  validateBranchName(baseBranch);
  validateBranchName(compareBranch);

  const { stdout } = await git(
    ["diff", "--numstat", `${baseBranch}...${compareBranch}`],
    repoPath,
  );

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

  const args = ["merge"];
  if (options?.noFf) args.push("--no-ff");
  if (options?.message) args.push("-m", options.message);
  args.push(branchName);

  try {
    await git(args, worktreePath);
    // Get the merge commit hash
    const { stdout } = await git(
      ["rev-parse", "--short", "HEAD"],
      worktreePath,
    );
    return { success: true, commitHash: stdout.trim() };
  } catch (error) {
    // Abort the failed merge to leave worktree clean
    try {
      await git(["merge", "--abort"], worktreePath);
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

  const flag = force ? "-D" : "-d";
  await git(["branch", flag, branchName], repoPath);
}
