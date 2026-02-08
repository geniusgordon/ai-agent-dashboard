/**
 * SQLite Schema & Migrations for Agent Sessions
 *
 * Session metadata stored in the shared `.agent-store/projects.db`.
 * Event data stored separately as JSONL files in `.agent-store/events/`.
 */

export const MIGRATIONS: Array<{ version: number; sql: string }> = [
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
  {
    version: 5,
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
];
