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
];
