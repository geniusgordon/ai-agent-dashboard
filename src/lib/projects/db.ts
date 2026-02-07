/**
 * Database Singleton
 *
 * WAL mode, foreign keys enabled, auto-migration on first access.
 * Stores DB at `.agent-store/projects.db`.
 */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "./schema.js";

const STORE_DIR = resolve(process.cwd(), ".agent-store");
const DB_PATH = resolve(STORE_DIR, "projects.db");

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  // Ensure schema_version table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const currentVersion =
    (
      database
        .prepare("SELECT MAX(version) as v FROM schema_version")
        .get() as { v: number | null }
    )?.v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      database.transaction(() => {
        database.exec(migration.sql);
        database
          .prepare("INSERT INTO schema_version (version) VALUES (?)")
          .run(migration.version);
      })();
      console.log(`[projects/db] Applied migration v${migration.version}`);
    }
  }
}

/**
 * Close the database connection (for testing/cleanup)
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
