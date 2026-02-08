/**
 * Project Manager
 *
 * Manages projects, worktrees, and agent-to-worktree assignments.
 * Follows the same singleton pattern as AgentManager.
 */

import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { getDatabase } from "./db.js";
import * as git from "./git-operations.js";
import type {
  AgentWorktreeAssignment,
  CodeReview,
  CodeReviewBranch,
  CodeReviewBranchStatus,
  CodeReviewStatus,
  CreateWorktreeOptions,
  Project,
  ProjectSettings,
  Worktree,
} from "./types.js";

// =============================================================================
// Slug generation
// =============================================================================

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

// =============================================================================
// Row ↔ Domain type conversions
// =============================================================================

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  repo_path: string;
  description: string | null;
  settings: string;
  created_at: string;
  updated_at: string;
}

interface WorktreeRow {
  id: string;
  project_id: string;
  name: string;
  path: string;
  branch: string;
  is_main_worktree: number;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  session_id: string;
  client_id: string;
  worktree_id: string;
  project_id: string;
  created_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    repoPath: row.repo_path,
    description: row.description ?? undefined,
    settings: JSON.parse(row.settings) as ProjectSettings,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToWorktree(row: WorktreeRow): Worktree {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    path: row.path,
    branch: row.branch,
    isMainWorktree: row.is_main_worktree === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToAssignment(row: AssignmentRow): AgentWorktreeAssignment {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    worktreeId: row.worktree_id,
    projectId: row.project_id,
    createdAt: new Date(row.created_at),
  };
}

interface CodeReviewRow {
  id: string;
  project_id: string;
  base_branch: string;
  agent_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CodeReviewBranchRow {
  id: string;
  review_id: string;
  branch_name: string;
  session_id: string | null;
  client_id: string | null;
  worktree_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

function rowToCodeReview(
  row: CodeReviewRow,
  branches: CodeReviewBranch[],
): CodeReview {
  return {
    id: row.id,
    projectId: row.project_id,
    baseBranch: row.base_branch,
    agentType: row.agent_type as CodeReview["agentType"],
    status: row.status as CodeReviewStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    branches,
  };
}

function rowToCodeReviewBranch(row: CodeReviewBranchRow): CodeReviewBranch {
  return {
    id: row.id,
    reviewId: row.review_id,
    branchName: row.branch_name,
    sessionId: row.session_id,
    clientId: row.client_id,
    worktreeId: row.worktree_id,
    status: row.status as CodeReviewBranchStatus,
    error: row.error,
    createdAt: new Date(row.created_at),
  };
}

// =============================================================================
// Project Manager
// =============================================================================

export class ProjectManager {
  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  async createProject(opts: {
    name: string;
    repoPath: string;
    description?: string;
    settings?: ProjectSettings;
  }): Promise<Project> {
    const resolvedPath = resolve(opts.repoPath);
    git.validatePath(resolvedPath);

    if (!(await git.isGitRepo(resolvedPath))) {
      throw new Error(`Not a git repository: ${resolvedPath}`);
    }

    const repoRoot = await git.getRepoRoot(resolvedPath);

    const db = getDatabase();
    const id = randomUUID();
    const slug = this.uniqueSlug(opts.name);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO projects (id, name, slug, repo_path, description, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      opts.name,
      slug,
      repoRoot,
      opts.description ?? null,
      JSON.stringify(opts.settings ?? {}),
      now,
      now,
    );

    const project = this.getProject(id)!;

    // Sync existing worktrees from the filesystem
    await this.syncWorktrees(id);

    return project;
  }

  getProject(id: string): Project | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
      | ProjectRow
      | undefined;
    return row ? rowToProject(row) : undefined;
  }

  getProjectBySlug(slug: string): Project | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as
      | ProjectRow
      | undefined;
    return row ? rowToProject(row) : undefined;
  }

  listProjects(): Project[] {
    const db = getDatabase();
    const rows = db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
      .all() as ProjectRow[];
    return rows.map(rowToProject);
  }

  updateProject(
    id: string,
    updates: {
      name?: string;
      description?: string;
      settings?: ProjectSettings;
    },
  ): Project {
    const db = getDatabase();
    const existing = this.getProject(id);
    if (!existing) throw new Error(`Project not found: ${id}`);

    const now = new Date().toISOString();
    const newName = updates.name ?? existing.name;
    const newSlug =
      updates.name && updates.name !== existing.name
        ? this.uniqueSlug(updates.name)
        : existing.slug;

    db.prepare(
      `UPDATE projects SET name = ?, slug = ?, description = ?, settings = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      newName,
      newSlug,
      updates.description ?? existing.description ?? null,
      JSON.stringify(updates.settings ?? existing.settings),
      now,
      id,
    );

    return this.getProject(id)!;
  }

  deleteProject(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Worktree Lifecycle
  // ---------------------------------------------------------------------------

  async createWorktree(opts: CreateWorktreeOptions): Promise<Worktree> {
    const project = this.getProject(opts.projectId);
    if (!project) throw new Error(`Project not found: ${opts.projectId}`);

    const worktreeName = opts.name ?? opts.branchName;
    const worktreePath = resolve(project.repoPath, opts.branchName);

    await git.createWorktree(project.repoPath, worktreePath, opts.branchName, {
      createNewBranch: opts.createNewBranch,
      baseBranch: opts.baseBranch,
    });

    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO worktrees (id, project_id, name, path, branch, is_main_worktree, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      id,
      opts.projectId,
      worktreeName,
      worktreePath,
      opts.branchName,
      now,
      now,
    );

    // Touch project updated_at
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(
      now,
      opts.projectId,
    );

    return this.getWorktree(id)!;
  }

  getWorktree(id: string): Worktree | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM worktrees WHERE id = ?").get(id) as
      | WorktreeRow
      | undefined;
    return row ? rowToWorktree(row) : undefined;
  }

  listWorktrees(projectId: string): Worktree[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        "SELECT * FROM worktrees WHERE project_id = ? ORDER BY is_main_worktree DESC, created_at ASC",
      )
      .all(projectId) as WorktreeRow[];
    return rows.map(rowToWorktree);
  }

  async deleteWorktree(
    id: string,
    force = false,
    deleteBranch = false,
  ): Promise<void> {
    const worktree = this.getWorktree(id);
    if (!worktree) throw new Error(`Worktree not found: ${id}`);

    if (worktree.isMainWorktree) {
      throw new Error("Cannot delete the main worktree");
    }

    if (!force) {
      const hasChanges = await git.hasUncommittedChanges(worktree.path);
      if (hasChanges) {
        throw new Error(
          "Worktree has uncommitted changes. Use force=true to delete anyway.",
        );
      }
    }

    const project = this.getProject(worktree.projectId);
    if (project) {
      await git.removeWorktree(project.repoPath, worktree.path, force);
    }

    const db = getDatabase();
    db.prepare("DELETE FROM worktrees WHERE id = ?").run(id);

    // Optionally delete the branch after the worktree is removed
    if (deleteBranch && project) {
      try {
        await git.deleteBranch(project.repoPath, worktree.branch, force);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Worktree deleted, but branch could not be removed: ${msg}`,
        );
      }
    }
  }

  async getWorktreeStatus(id: string): Promise<{
    hasUncommittedChanges: boolean;
    branch: string | null;
  }> {
    const worktree = this.getWorktree(id);
    if (!worktree) throw new Error(`Worktree not found: ${id}`);

    const [hasChanges, branch] = await Promise.all([
      git.hasUncommittedChanges(worktree.path),
      git.getCurrentBranch(worktree.path),
    ]);

    return { hasUncommittedChanges: hasChanges, branch };
  }

  async syncWorktrees(projectId: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const fsWorktrees = await git.listWorktrees(project.repoPath);
    const dbWorktrees = this.listWorktrees(projectId);

    const db = getDatabase();
    const dbPathSet = new Set(dbWorktrees.map((w) => w.path));
    const fsPathSet = new Set(fsWorktrees.map((w) => w.path));
    const now = new Date().toISOString();

    // Insert worktrees found on filesystem but not in DB
    for (const fsWt of fsWorktrees) {
      if (!dbPathSet.has(fsWt.path)) {
        const id = randomUUID();
        const name = basename(fsWt.path);
        const branch = fsWt.branch ?? "(unknown)";

        db.prepare(
          `INSERT INTO worktrees (id, project_id, name, path, branch, is_main_worktree, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          projectId,
          name,
          fsWt.path,
          branch,
          fsWt.isBare ? 1 : 0,
          now,
          now,
        );
      }
    }

    // Update branches for existing worktrees (e.g. bare worktrees previously stored as "(unknown)")
    const fsMap = new Map(fsWorktrees.map((w) => [w.path, w]));
    for (const dbWt of dbWorktrees) {
      const fsWt = fsMap.get(dbWt.path);
      if (fsWt?.branch && fsWt.branch !== dbWt.branch) {
        db.prepare(
          "UPDATE worktrees SET branch = ?, updated_at = ? WHERE id = ?",
        ).run(fsWt.branch, now, dbWt.id);
      }
    }

    // Remove worktrees in DB that no longer exist on filesystem
    for (const dbWt of dbWorktrees) {
      if (!fsPathSet.has(dbWt.path)) {
        db.prepare("DELETE FROM worktrees WHERE id = ?").run(dbWt.id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Agent Assignments
  // ---------------------------------------------------------------------------

  assignAgentToWorktree(opts: {
    sessionId: string;
    clientId: string;
    worktreeId: string;
    projectId: string;
  }): AgentWorktreeAssignment {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO agent_worktree_assignments (id, session_id, client_id, worktree_id, project_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      opts.sessionId,
      opts.clientId,
      opts.worktreeId,
      opts.projectId,
      now,
    );

    // Touch project updated_at
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(
      now,
      opts.projectId,
    );

    return this.getAssignment(id)!;
  }

  unassignAgent(sessionId: string): void {
    const db = getDatabase();
    db.prepare(
      "DELETE FROM agent_worktree_assignments WHERE session_id = ?",
    ).run(sessionId);
  }

  getAssignment(id: string): AgentWorktreeAssignment | undefined {
    const db = getDatabase();
    const row = db
      .prepare("SELECT * FROM agent_worktree_assignments WHERE id = ?")
      .get(id) as AssignmentRow | undefined;
    return row ? rowToAssignment(row) : undefined;
  }

  getAssignmentForSession(
    sessionId: string,
  ): AgentWorktreeAssignment | undefined {
    const db = getDatabase();
    const row = db
      .prepare("SELECT * FROM agent_worktree_assignments WHERE session_id = ?")
      .get(sessionId) as AssignmentRow | undefined;
    return row ? rowToAssignment(row) : undefined;
  }

  getAssignmentsForWorktree(worktreeId: string): AgentWorktreeAssignment[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        "SELECT * FROM agent_worktree_assignments WHERE worktree_id = ? ORDER BY created_at DESC",
      )
      .all(worktreeId) as AssignmentRow[];
    return rows.map(rowToAssignment);
  }

  getAssignmentsForProject(projectId: string): AgentWorktreeAssignment[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        "SELECT * FROM agent_worktree_assignments WHERE project_id = ? ORDER BY created_at DESC",
      )
      .all(projectId) as AssignmentRow[];
    return rows.map(rowToAssignment);
  }

  // ---------------------------------------------------------------------------
  // Code Reviews
  // ---------------------------------------------------------------------------

  createCodeReview(opts: {
    projectId: string;
    baseBranch: string;
    agentType: string;
    branchNames: string[];
  }): CodeReview {
    const db = getDatabase();
    const reviewId = randomUUID();
    const now = new Date().toISOString();

    const branches: CodeReviewBranch[] = [];

    // Atomic: review + all branch rows in a single transaction
    db.transaction(() => {
      db.prepare(
        `INSERT INTO code_reviews (id, project_id, base_branch, agent_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'running', ?, ?)`,
      ).run(
        reviewId,
        opts.projectId,
        opts.baseBranch,
        opts.agentType,
        now,
        now,
      );

      for (const branchName of opts.branchNames) {
        const branchId = randomUUID();
        db.prepare(
          `INSERT INTO code_review_branches (id, review_id, branch_name, status, created_at)
           VALUES (?, ?, ?, 'pending', ?)`,
        ).run(branchId, reviewId, branchName, now);
        branches.push({
          id: branchId,
          reviewId,
          branchName,
          sessionId: null,
          clientId: null,
          worktreeId: null,
          status: "pending",
          error: null,
          createdAt: new Date(now),
        });
      }
    })();

    return {
      id: reviewId,
      projectId: opts.projectId,
      baseBranch: opts.baseBranch,
      agentType: opts.agentType as CodeReview["agentType"],
      status: "running",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      branches,
    };
  }

  getCodeReview(id: string): CodeReview | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM code_reviews WHERE id = ?").get(id) as
      | CodeReviewRow
      | undefined;
    if (!row) return undefined;

    const branchRows = db
      .prepare(
        "SELECT * FROM code_review_branches WHERE review_id = ? ORDER BY created_at ASC",
      )
      .all(id) as CodeReviewBranchRow[];

    return rowToCodeReview(row, branchRows.map(rowToCodeReviewBranch));
  }

  listCodeReviews(projectId: string): CodeReview[] {
    const db = getDatabase();

    // Single joined query to avoid N+1
    const rows = db
      .prepare(
        `SELECT
           r.id AS r_id, r.project_id AS r_project_id, r.base_branch AS r_base_branch,
           r.agent_type AS r_agent_type, r.status AS r_status,
           r.created_at AS r_created_at, r.updated_at AS r_updated_at,
           b.id AS b_id, b.review_id AS b_review_id, b.branch_name AS b_branch_name,
           b.session_id AS b_session_id, b.client_id AS b_client_id,
           b.worktree_id AS b_worktree_id, b.status AS b_status,
           b.error AS b_error, b.created_at AS b_created_at
         FROM code_reviews r
         LEFT JOIN code_review_branches b ON b.review_id = r.id
         WHERE r.project_id = ?
         ORDER BY r.created_at DESC, b.created_at ASC`,
      )
      .all(projectId) as Array<Record<string, unknown>>;

    // Group joined rows by review
    const reviewMap = new Map<
      string,
      { row: CodeReviewRow; branches: CodeReviewBranch[] }
    >();

    for (const row of rows) {
      const reviewId = row.r_id as string;
      if (!reviewMap.has(reviewId)) {
        reviewMap.set(reviewId, {
          row: {
            id: row.r_id as string,
            project_id: row.r_project_id as string,
            base_branch: row.r_base_branch as string,
            agent_type: row.r_agent_type as string,
            status: row.r_status as string,
            created_at: row.r_created_at as string,
            updated_at: row.r_updated_at as string,
          },
          branches: [],
        });
      }

      // LEFT JOIN: branch columns are null when a review has no branches
      if (row.b_id != null) {
        reviewMap.get(reviewId)!.branches.push(
          rowToCodeReviewBranch({
            id: row.b_id as string,
            review_id: row.b_review_id as string,
            branch_name: row.b_branch_name as string,
            session_id: row.b_session_id as string | null,
            client_id: row.b_client_id as string | null,
            worktree_id: row.b_worktree_id as string | null,
            status: row.b_status as string,
            error: row.b_error as string | null,
            created_at: row.b_created_at as string,
          }),
        );
      }
    }

    return Array.from(reviewMap.values()).map(({ row, branches }) =>
      rowToCodeReview(row, branches),
    );
  }

  updateCodeReviewBranch(
    branchId: string,
    updates: {
      sessionId?: string;
      clientId?: string;
      worktreeId?: string | null;
      status?: CodeReviewBranchStatus;
      error?: string | null;
    },
  ): void {
    const db = getDatabase();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.sessionId !== undefined) {
      sets.push("session_id = ?");
      values.push(updates.sessionId);
    }
    if (updates.clientId !== undefined) {
      sets.push("client_id = ?");
      values.push(updates.clientId);
    }
    if (updates.worktreeId !== undefined) {
      sets.push("worktree_id = ?");
      values.push(updates.worktreeId);
    }
    if (updates.status !== undefined) {
      sets.push("status = ?");
      values.push(updates.status);
    }
    if (updates.error !== undefined) {
      sets.push("error = ?");
      values.push(updates.error);
    }

    if (sets.length === 0) return;

    values.push(branchId);
    db.prepare(
      `UPDATE code_review_branches SET ${sets.join(", ")} WHERE id = ?`,
    ).run(...values);
  }

  updateCodeReviewStatus(reviewId: string): void {
    const db = getDatabase();
    const branchRows = db
      .prepare("SELECT status FROM code_review_branches WHERE review_id = ?")
      .all(reviewId) as Array<{ status: string }>;

    const statuses = branchRows.map((r) => r.status);
    let newStatus: CodeReviewStatus;

    if (statuses.every((s) => s === "completed" || s === "merged")) {
      newStatus = "completed";
    } else if (statuses.some((s) => s === "error")) {
      newStatus = "error";
    } else {
      newStatus = "running";
    }

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE code_reviews SET status = ?, updated_at = ? WHERE id = ?",
    ).run(newStatus, now, reviewId);
  }

  deleteCodeReview(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM code_reviews WHERE id = ?").run(id);
  }

  findWorktreeByBranch(
    projectId: string,
    branchName: string,
  ): Worktree | undefined {
    const db = getDatabase();
    const row = db
      .prepare("SELECT * FROM worktrees WHERE project_id = ? AND branch = ?")
      .get(projectId, branchName) as WorktreeRow | undefined;
    return row ? rowToWorktree(row) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Auto-detection
  // ---------------------------------------------------------------------------

  async importFromDirectory(
    dirPath: string,
    options?: { name?: string; description?: string },
  ): Promise<Project> {
    const resolvedPath = resolve(dirPath);
    git.validatePath(resolvedPath);

    if (!(await git.isGitRepo(resolvedPath))) {
      throw new Error(`Not a git repository: ${resolvedPath}`);
    }

    const repoRoot = await git.getRepoRoot(resolvedPath);

    // Check if project already exists for this repo
    const db = getDatabase();
    const existing = db
      .prepare("SELECT * FROM projects WHERE repo_path = ?")
      .get(repoRoot) as ProjectRow | undefined;

    if (existing) {
      const project = rowToProject(existing);
      await this.syncWorktrees(project.id);
      return project;
    }

    // Create new project from repo
    const name = options?.name || basename(repoRoot);
    return this.createProject({
      name,
      repoPath: repoRoot,
      description: options?.description,
    });
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  async listBranches(projectId: string): Promise<string[]> {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return git.listBranches(project.repoPath);
  }

  async listBranchesWithStatus(projectId: string): Promise<
    {
      name: string;
      isDefault: boolean;
      hasWorktree: boolean;
      worktreeId?: string;
    }[]
  > {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const [branches, defaultBranch, worktrees] = await Promise.all([
      git.listBranches(project.repoPath),
      git.getDefaultBranch(project.repoPath),
      Promise.resolve(this.listWorktrees(projectId)),
    ]);

    const worktreeByBranch = new Map(worktrees.map((wt) => [wt.branch, wt.id]));

    return branches.map((name) => ({
      name,
      isDefault: name === defaultBranch,
      hasWorktree: worktreeByBranch.has(name),
      worktreeId: worktreeByBranch.get(name),
    }));
  }

  async deleteBranch(
    projectId: string,
    branchName: string,
    force = false,
  ): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    await git.deleteBranch(project.repoPath, branchName, force);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private uniqueSlug(name: string): string {
    const db = getDatabase();
    const base = toSlug(name);
    let slug = base;
    let counter = 1;

    while (
      db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(slug) != null
    ) {
      slug = `${base}-${counter}`;
      counter++;
    }

    return slug;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let instance: ProjectManager | null = null;

export function getProjectManager(): ProjectManager {
  if (!instance) {
    instance = new ProjectManager();
  }
  return instance;
}
