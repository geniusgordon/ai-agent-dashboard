/**
 * Persistent Storage for Agent Sessions
 *
 * Session metadata is stored in SQLite (shared DB with projects).
 * Event data is stored as append-only JSONL files in `.agent-store/events/`.
 *
 * On first access, automatically migrates any legacy JSON session files
 * from `.agent-store/sessions/` into the new format.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getDatabase } from "../projects/db.js";
import type {
  AgentEvent,
  AgentEventType,
  AgentType,
  SessionStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const STORE_DIR = ".agent-store";
const EVENTS_DIR = join(STORE_DIR, "events");

function ensureEventsDir(): void {
  if (!existsSync(EVENTS_DIR)) {
    mkdirSync(EVENTS_DIR, { recursive: true });
  }
}

function getEventsPath(sessionId: string): string {
  return join(EVENTS_DIR, `${sessionId}.jsonl`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoredEvent {
  type: AgentEventType;
  clientId: string;
  sessionId: string;
  timestamp: string;
  payload: unknown;
}

export interface StoredSession {
  id: string;
  clientId: string;
  agentType: AgentType;
  cwd?: string;
  name?: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  availableModes?: Array<{ id: string; name: string; description?: string }>;
  currentModeId?: string;
  projectId?: string;
  worktreeId?: string;
  worktreeBranch?: string;
}

/** Legacy format — only used during migration from old JSON files. */
interface LegacyStoredSession extends StoredSession {
  events: StoredEvent[];
}

interface SessionRow {
  id: string;
  client_id: string;
  agent_type: string;
  cwd: string | null;
  name: string | null;
  status: string;
  available_modes: string | null;
  current_mode_id: string | null;
  project_id: string | null;
  worktree_id: string | null;
  worktree_branch: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row conversion
// ---------------------------------------------------------------------------

function rowToStoredSession(row: SessionRow): StoredSession {
  return {
    id: row.id,
    clientId: row.client_id,
    agentType: row.agent_type as AgentType,
    cwd: row.cwd ?? undefined,
    name: row.name ?? undefined,
    status: row.status as SessionStatus,
    availableModes: row.available_modes
      ? JSON.parse(row.available_modes)
      : undefined,
    currentModeId: row.current_mode_id ?? undefined,
    projectId: row.project_id ?? undefined,
    worktreeId: row.worktree_id ?? undefined,
    worktreeBranch: row.worktree_branch ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStoredEvent(event: AgentEvent): StoredEvent {
  return {
    type: event.type,
    clientId: event.clientId,
    sessionId: event.sessionId,
    timestamp: event.timestamp.toISOString(),
    payload: event.payload,
  };
}

// ---------------------------------------------------------------------------
// Legacy JSON migration (runs once)
// ---------------------------------------------------------------------------

let migrationDone = false;

function migrateJsonSessionsIfNeeded(): void {
  if (migrationDone) return;

  const oldSessionsDir = join(STORE_DIR, "sessions");
  if (!existsSync(oldSessionsDir)) {
    migrationDone = true;
    return;
  }

  const files = readdirSync(oldSessionsDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    migrationDone = true;
    return;
  }

  console.log(
    `[store] Migrating ${files.length} JSON session file(s) to SQLite + JSONL…`,
  );

  const db = getDatabase();
  ensureEventsDir();

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, client_id, agent_type, cwd, name, status, available_modes, current_mode_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const migrate = db.transaction(() => {
    for (const file of files) {
      try {
        const data = readFileSync(join(oldSessionsDir, file), "utf-8");
        const legacy = JSON.parse(data) as LegacyStoredSession;

        insertStmt.run(
          legacy.id,
          legacy.clientId,
          legacy.agentType,
          legacy.cwd ?? null,
          legacy.name ?? null,
          legacy.status,
          legacy.availableModes ? JSON.stringify(legacy.availableModes) : null,
          legacy.currentModeId ?? null,
          legacy.createdAt,
          legacy.updatedAt,
        );

        if (legacy.events && legacy.events.length > 0) {
          const lines = `${legacy.events.map((e) => JSON.stringify(e)).join("\n")}\n`;
          writeFileSync(getEventsPath(legacy.id), lines);
        }
      } catch (err) {
        console.error(`[store] Failed to migrate ${file}:`, err);
      }
    }
  });

  migrate();

  renameSync(oldSessionsDir, join(STORE_DIR, "sessions.bak"));
  migrationDone = true;
  console.log(
    "[store] Migration complete. Old files moved to .agent-store/sessions.bak/",
  );
}

// ---------------------------------------------------------------------------
// Session metadata (SQLite)
// ---------------------------------------------------------------------------

/**
 * Save a session to SQLite (metadata only).
 * If `events` is non-empty, also writes the initial JSONL file.
 */
export function saveSession(
  session: {
    id: string;
    clientId: string;
    agentType: AgentType;
    cwd?: string;
    name?: string;
    status: SessionStatus;
    createdAt: Date;
    updatedAt: Date;
    availableModes?: Array<{ id: string; name: string; description?: string }>;
    currentModeId?: string;
  },
  events: AgentEvent[],
): void {
  migrateJsonSessionsIfNeeded();

  const db = getDatabase();
  db.prepare(
    `INSERT OR REPLACE INTO sessions
      (id, client_id, agent_type, cwd, name, status, available_modes, current_mode_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    session.id,
    session.clientId,
    session.agentType,
    session.cwd ?? null,
    session.name ?? null,
    session.status,
    session.availableModes ? JSON.stringify(session.availableModes) : null,
    session.currentModeId ?? null,
    session.createdAt.toISOString(),
    session.updatedAt.toISOString(),
  );

  if (events.length > 0) {
    ensureEventsDir();
    const lines = `${events.map((e) => JSON.stringify(toStoredEvent(e))).join("\n")}\n`;
    writeFileSync(getEventsPath(session.id), lines);
  }
}

/**
 * Load session metadata from SQLite.
 */
export function loadSession(sessionId: string): StoredSession | null {
  migrateJsonSessionsIfNeeded();

  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  return row ? rowToStoredSession(row) : null;
}

/**
 * Load all session metadata from SQLite (ordered by newest first).
 */
export function loadAllSessions(): StoredSession[] {
  migrateJsonSessionsIfNeeded();

  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM sessions ORDER BY created_at DESC")
    .all() as SessionRow[];
  return rows.map(rowToStoredSession);
}

/**
 * Delete a session from SQLite and its JSONL event file.
 */
export function deleteSession(sessionId: string): void {
  cancelPendingTimestamp(sessionId);
  const db = getDatabase();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);

  const eventsPath = getEventsPath(sessionId);
  if (existsSync(eventsPath)) {
    unlinkSync(eventsPath);
  }
}

/**
 * Update session status.
 */
export function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): void {
  cancelPendingTimestamp(sessionId);
  const db = getDatabase();
  db.prepare("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    new Date().toISOString(),
    sessionId,
  );
}

/**
 * Update session name.
 */
export function updateSessionName(sessionId: string, name: string): void {
  const db = getDatabase();
  db.prepare("UPDATE sessions SET name = ?, updated_at = ? WHERE id = ?").run(
    name,
    new Date().toISOString(),
    sessionId,
  );
}

/**
 * Update session project context (projectId, worktreeId, worktreeBranch).
 */
export function updateSessionProjectContext(
  sessionId: string,
  context: { projectId: string; worktreeId: string; worktreeBranch: string },
): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE sessions SET project_id = ?, worktree_id = ?, worktree_branch = ?, updated_at = ? WHERE id = ?",
  ).run(
    context.projectId,
    context.worktreeId,
    context.worktreeBranch,
    new Date().toISOString(),
    sessionId,
  );
}

/**
 * Update session mode.
 */
export function updateSessionMode(
  sessionId: string,
  currentModeId: string,
): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE sessions SET current_mode_id = ?, updated_at = ? WHERE id = ?",
  ).run(currentModeId, new Date().toISOString(), sessionId);
}

// ---------------------------------------------------------------------------
// Event data (JSONL)
// ---------------------------------------------------------------------------

/** Pending `updated_at` flushes, keyed by sessionId. */
const pendingTimestamps = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 2_000;

/** Cancel a pending debounced write (no flush — caller will write directly). */
function cancelPendingTimestamp(sessionId: string): void {
  const timer = pendingTimestamps.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    pendingTimestamps.delete(sessionId);
  }
}

function debouncedUpdatedAt(sessionId: string): void {
  cancelPendingTimestamp(sessionId);

  const timer = setTimeout(() => {
    pendingTimestamps.delete(sessionId);
    const db = getDatabase();
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      sessionId,
    );
  }, DEBOUNCE_MS);

  // Don't keep the process alive just for this timer
  timer.unref();
  pendingTimestamps.set(sessionId, timer);
}

/**
 * Append a single event to the session's JSONL file.
 * The `updated_at` timestamp in SQLite is debounced to avoid excessive writes
 * during high-frequency streaming.
 */
export function appendSessionEvent(sessionId: string, event: AgentEvent): void {
  ensureEventsDir();
  const line = `${JSON.stringify(toStoredEvent(event))}\n`;
  appendFileSync(getEventsPath(sessionId), line);

  debouncedUpdatedAt(sessionId);
}

/**
 * Load all events for a session from its JSONL file.
 */
export function loadSessionEvents(sessionId: string): StoredEvent[] {
  const path = getEventsPath(sessionId);
  if (!existsSync(path)) return [];

  const content = readFileSync(path, "utf-8");
  const events: StoredEvent[] = [];
  for (const line of content.split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line) as StoredEvent);
    } catch {
      console.warn(`[store] Skipping corrupt JSONL line in ${sessionId}`);
    }
  }
  return events;
}
