/**
 * SQLite Schema & Migrations
 *
 * Hand-rolled versioned migrations for project management tables.
 * DB file lives at `.agent-store/projects.db`.
 */

export const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        repo_path TEXT NOT NULL,
        description TEXT,
        settings TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS worktrees (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        branch TEXT NOT NULL,
        is_main_worktree INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agent_worktree_assignments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        worktree_id TEXT NOT NULL REFERENCES worktrees(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE INDEX IF NOT EXISTS idx_worktrees_project ON worktrees(project_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_worktree ON agent_worktree_assignments(worktree_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_session ON agent_worktree_assignments(session_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_project ON agent_worktree_assignments(project_id);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS code_reviews (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        base_branch TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS code_review_branches (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES code_reviews(id) ON DELETE CASCADE,
        branch_name TEXT NOT NULL,
        session_id TEXT,
        client_id TEXT,
        worktree_id TEXT REFERENCES worktrees(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_code_reviews_project ON code_reviews(project_id);
      CREATE INDEX IF NOT EXISTS idx_review_branches_review ON code_review_branches(review_id);
      CREATE INDEX IF NOT EXISTS idx_review_branches_session ON code_review_branches(session_id);
      CREATE INDEX IF NOT EXISTS idx_review_branches_worktree ON code_review_branches(worktree_id);
    `,
  },
];
