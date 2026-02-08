/**
 * Project & Worktree Types
 *
 * Core types for project management with git worktree support.
 */

import type { AgentType } from "../agents/types.js";

// =============================================================================
// Project Types
// =============================================================================

export interface Project {
  id: string;
  name: string;
  slug: string;
  repoPath: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  defaultAgentType?: AgentType;
  autoCreateWorktree?: boolean;
  env?: Record<string, string>;
}

// =============================================================================
// Worktree Types
// =============================================================================

export interface Worktree {
  id: string;
  projectId: string;
  name: string;
  path: string;
  branch: string;
  isMainWorktree: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorktreeOptions {
  projectId: string;
  branchName: string;
  baseBranch?: string;
  createNewBranch: boolean;
  name?: string;
}

// =============================================================================
// Agent Assignment Types
// =============================================================================

export interface AgentWorktreeAssignment {
  id: string;
  sessionId: string;
  clientId: string;
  worktreeId: string;
  projectId: string;
  createdAt: Date;
}

// =============================================================================
// Code Review Types
// =============================================================================

export type CodeReviewStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "merged";

export interface CodeReview {
  id: string;
  projectId: string;
  batchId: string | null;
  branchName: string;
  baseBranch: string;
  agentType: AgentType;
  sessionId: string | null;
  clientId: string | null;
  worktreeId: string | null;
  status: CodeReviewStatus;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Git Info Types
// =============================================================================

export interface GitWorktreeInfo {
  path: string;
  head: string;
  branch: string;
  isBare: boolean;
}

export interface BranchInfo {
  branch: string | null;
  isGitRepo: boolean;
}
