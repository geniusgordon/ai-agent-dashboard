/**
 * SQLite Schema & Migrations
 *
 * Unified versioned migrations for all tables (projects, worktrees, sessions).
 * DB file lives at `.agent-store/projects.db`.
 *
 * Rules:
 *  - Each version number must be unique across the entire sequence.
 *  - Append new migrations at the end with the next version number.
 *  - Never modify an already-released migration.
 */

export const MIGRATIONS: Array<{ version: number; sql: string }> = [
  // ── Projects & Worktrees ───────────────────────────────────────────
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

  // ── Agent Sessions ─────────────────────────────────────────────────
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        cwd TEXT,
        name TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        available_modes TEXT,
        current_mode_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
    `,
  },

  // ── Code Reviews (original) ────────────────────────────────────────
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

  // ── Flatten code reviews (one row per branch) ──────────────────────
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS code_reviews_v2 (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        batch_id TEXT,
        branch_name TEXT NOT NULL,
        base_branch TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        session_id TEXT,
        client_id TEXT,
        worktree_id TEXT REFERENCES worktrees(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO code_reviews_v2 (id, project_id, batch_id, branch_name, base_branch, agent_type, session_id, client_id, worktree_id, status, error, created_at, updated_at)
        SELECT
          b.id,
          r.project_id,
          r.id,
          b.branch_name,
          r.base_branch,
          r.agent_type,
          b.session_id,
          b.client_id,
          b.worktree_id,
          b.status,
          b.error,
          b.created_at,
          r.updated_at
        FROM code_review_branches b
        JOIN code_reviews r ON b.review_id = r.id;

      DROP TABLE code_review_branches;
      DROP TABLE code_reviews;
      ALTER TABLE code_reviews_v2 RENAME TO code_reviews;

      CREATE INDEX IF NOT EXISTS idx_code_reviews_project ON code_reviews(project_id);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_batch ON code_reviews(batch_id);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_session ON code_reviews(session_id);
      CREATE INDEX IF NOT EXISTS idx_code_reviews_worktree ON code_reviews(worktree_id);
    `,
  },

  // ── Drop code reviews ──────────────────────────────────────────────
  {
    version: 5,
    sql: `
      DROP TABLE IF EXISTS code_reviews;
    `,
  },

  // ── Add project/worktree columns to sessions + backfill ────────────
  {
    version: 6,
    sql: `
      ALTER TABLE sessions ADD COLUMN project_id TEXT;
      ALTER TABLE sessions ADD COLUMN worktree_id TEXT;
      ALTER TABLE sessions ADD COLUMN worktree_branch TEXT;

      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_worktree ON sessions(worktree_id);

      -- Backfill from existing assignments
      UPDATE sessions SET
        project_id = (SELECT project_id FROM agent_worktree_assignments WHERE session_id = sessions.id),
        worktree_id = (SELECT worktree_id FROM agent_worktree_assignments WHERE session_id = sessions.id),
        worktree_branch = (SELECT w.branch FROM agent_worktree_assignments a JOIN worktrees w ON a.worktree_id = w.id WHERE a.session_id = sessions.id);
    `,
  },

  // ── Add base_branch to worktrees ───────────────────────────────────
  {
    version: 7,
    sql: `
      ALTER TABLE worktrees ADD COLUMN base_branch TEXT;
    `,
  },
];
