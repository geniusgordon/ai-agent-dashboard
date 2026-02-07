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
];
