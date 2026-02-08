/**
 * Project Management Module
 *
 * Git-aware project and worktree management for the AI Agent Dashboard.
 */

export { closeDatabase, getDatabase } from "./db.js";
export type { ChangedFile, MergeResult } from "./git-operations.js";
export {
  getBranchInfo,
  getDiff,
  getFilesChanged,
  hasUncommittedChanges,
  isGitRepo,
  listBranches,
  listWorktrees as listGitWorktrees,
  mergeBranch,
  validateBranchName,
} from "./git-operations.js";
export { getProjectManager, ProjectManager } from "./project-manager.js";

export type {
  AgentWorktreeAssignment,
  BranchInfo,
  CreateWorktreeOptions,
  GitWorktreeInfo,
  Project,
  ProjectSettings,
  Worktree,
} from "./types.js";
