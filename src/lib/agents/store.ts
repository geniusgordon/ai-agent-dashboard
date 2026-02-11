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
import { open, stat } from "node:fs/promises";
import { join } from "node:path";
import { getDatabase } from "../projects/db.js";
import type {
  AgentEvent,
  AgentEventType,
  AgentType,
  SessionConfigOption,
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

/**
 * Maximum number of raw JSONL lines kept in memory per session.
 * After merging consecutive message chunks this yields ~200-500 visible events
 * — plenty for chat history.  When exceeded, emitEvent() batch-trims 25% off
 * the front so the array oscillates between 75%-100% of the cap.
 */
export const MAX_SESSION_EVENTS = 20_000;

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
  configOptions?: SessionConfigOption[];
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
  config_options: string | null;
  project_id: string | null;
  worktree_id: string | null;
  worktree_branch: string | null;
  created_at: string;
  updated_at: string;
}

// NOTE: Keep session columns in sync with migrations in src/lib/projects/schema.ts
// since sessions share the same SQLite database file.

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
    configOptions: row.config_options
      ? (JSON.parse(row.config_options) as SessionConfigOption[])
      : undefined,
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
    payload: JSON.parse(JSON.stringify(event.payload)),
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
      (id, client_id, agent_type, cwd, name, status, available_modes, current_mode_id, config_options, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          legacy.configOptions ? JSON.stringify(legacy.configOptions) : null,
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
    configOptions?: SessionConfigOption[];
    projectId?: string;
    worktreeId?: string;
    worktreeBranch?: string;
  },
  events: AgentEvent[],
): void {
  migrateJsonSessionsIfNeeded();

  const db = getDatabase();
  db.prepare(
    `INSERT OR REPLACE INTO sessions
      (id, client_id, agent_type, cwd, name, status, available_modes, current_mode_id, config_options, project_id, worktree_id, worktree_branch, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    session.id,
    session.clientId,
    session.agentType,
    session.cwd ?? null,
    session.name ?? null,
    session.status,
    session.availableModes ? JSON.stringify(session.availableModes) : null,
    session.currentModeId ?? null,
    session.configOptions ? JSON.stringify(session.configOptions) : null,
    session.projectId ?? null,
    session.worktreeId ?? null,
    session.worktreeBranch ?? null,
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
  // Cancel any pending write buffer (data is being deleted anyway)
  const pending = pendingWrites.get(sessionId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingWrites.delete(sessionId);
  }

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

/**
 * Update session config options.
 */
export function updateSessionConfigOptions(
  sessionId: string,
  configOptions: SessionConfigOption[],
): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE sessions SET config_options = ?, updated_at = ? WHERE id = ?",
  ).run(JSON.stringify(configOptions), new Date().toISOString(), sessionId);
}

// ---------------------------------------------------------------------------
// Event data (JSONL)
// ---------------------------------------------------------------------------

/** Pending `updated_at` flushes, keyed by sessionId. */
const pendingTimestamps = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 2_000;

// ---------------------------------------------------------------------------
// Write coalescing buffer
// ---------------------------------------------------------------------------

interface PendingWrite {
  event: StoredEvent;
  timer: NodeJS.Timeout;
}

/** Per-session buffer for coalescing consecutive mergeable events. */
const pendingWrites = new Map<string, PendingWrite>();
const FLUSH_MS = 500;

/**
 * Whether two events can be merged (same type, both message/thinking,
 * same sessionId, same isUser flag).
 */
export function canMergeEvents(a: StoredEvent, b: StoredEvent): boolean {
  if (a.type !== b.type) return false;
  if (a.type !== "message" && a.type !== "thinking") return false;
  if (a.sessionId !== b.sessionId) return false;
  const aPayload = a.payload as Record<string, unknown>;
  const bPayload = b.payload as Record<string, unknown>;
  return (aPayload.isUser === true) === (bPayload.isUser === true);
}

/** Extract string content from an event payload. */
function getEventContent(payload: Record<string, unknown>): string {
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.content === "object" && payload.content !== null) {
    return ((payload.content as Record<string, unknown>).text as string) ?? "";
  }
  return "";
}

/** Merge event b's content into event a (mutates a). */
function mergeInto(a: StoredEvent, b: StoredEvent): void {
  const aPayload = a.payload as Record<string, unknown>;
  const bPayload = b.payload as Record<string, unknown>;
  aPayload.content = getEventContent(aPayload) + getEventContent(bPayload);
  a.timestamp = b.timestamp;
}

/** Flush the pending write buffer for a single session to disk. */
function flushPending(sessionId: string): void {
  const pending = pendingWrites.get(sessionId);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingWrites.delete(sessionId);

  ensureEventsDir();
  const line = `${JSON.stringify(pending.event)}\n`;
  appendFileSync(getEventsPath(sessionId), line);
}

/** Flush pending buffer for one session. Safe to call if nothing is pending. */
export function flushSessionWrites(sessionId: string): void {
  flushPending(sessionId);
}

/** Flush all pending write buffers (e.g. on shutdown). */
export function flushAllSessionWrites(): void {
  for (const sessionId of [...pendingWrites.keys()]) {
    flushPending(sessionId);
  }
}

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
 *
 * Consecutive mergeable events (message/thinking with same sender) are
 * coalesced in a per-session buffer before writing, dramatically reducing
 * JSONL lines for token-by-token agents like Codex.
 *
 * Non-mergeable events flush the buffer first, then write immediately.
 * A 500ms timer auto-flushes so the last tokens are never lost.
 */
export function appendSessionEvent(sessionId: string, event: AgentEvent): void {
  const stored = toStoredEvent(event);
  const pending = pendingWrites.get(sessionId);

  const isMergeable = stored.type === "message" || stored.type === "thinking";

  if (isMergeable) {
    if (pending && canMergeEvents(pending.event, stored)) {
      // Merge into existing buffer entry and reset timer
      mergeInto(pending.event, stored);
      clearTimeout(pending.timer);
      const timer = setTimeout(() => flushPending(sessionId), FLUSH_MS);
      timer.unref();
      pending.timer = timer;
    } else {
      // Flush any existing buffer, then start a new one
      flushPending(sessionId);
      const timer = setTimeout(() => flushPending(sessionId), FLUSH_MS);
      timer.unref();
      pendingWrites.set(sessionId, { event: stored, timer });
    }
  } else {
    // Non-mergeable: flush buffer first, then write immediately
    flushPending(sessionId);
    ensureEventsDir();
    const line = `${JSON.stringify(stored)}\n`;
    appendFileSync(getEventsPath(sessionId), line);
  }

  debouncedUpdatedAt(sessionId);
}

/**
 * Read the last `maxLines` newline-delimited lines from a file without loading
 * the entire file into memory.  Reads backwards in CHUNK_SIZE-byte blocks.
 * Small files (≤ CHUNK_SIZE) are read in a single call — no penalty for the
 * common case.
 *
 * JSON.stringify escapes non-ASCII as \uXXXX, so every 0x0A byte in the file
 * is a real line separator — byte-level \n scanning is safe.
 */
const CHUNK_SIZE = 64 * 1024; // 64 KB

async function tailLines(
  filePath: string,
  maxLines: number,
): Promise<string[]> {
  const info = await stat(filePath);
  const fileSize = info.size;
  if (fileSize === 0) return [];

  const fh = await open(filePath, "r");
  try {
    const lines: string[] = [];
    let position = fileSize;
    let trailing = ""; // bytes after the last \n we've seen so far

    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;

      const buf = Buffer.alloc(readSize);
      await fh.read(buf, 0, readSize, position);
      const chunk = buf.toString("utf-8");

      const text = chunk + trailing;
      trailing = "";

      const parts = text.split("\n");
      // The first element is a partial line (or the start of the file) —
      // carry it forward for the next iteration.
      trailing = parts[0];

      // Walk from end to start (newest lines first)
      for (let i = parts.length - 1; i >= 1; i--) {
        if (parts[i].length > 0) {
          lines.push(parts[i]);
          if (lines.length >= maxLines) break;
        }
      }
    }

    // If we've consumed the whole file, the leftover `trailing` is the
    // very first line.
    if (position === 0 && trailing.length > 0 && lines.length < maxLines) {
      lines.push(trailing);
    }

    // `lines` is newest-first — reverse to chronological order.
    lines.reverse();
    return lines;
  } finally {
    await fh.close();
  }
}

/**
 * Load the most recent events for a session from its JSONL file.
 * Reads only the last MAX_SESSION_EVENTS lines from disk (async, backwards)
 * so that even a 500 MB event file won't cause OOM.
 */
export async function loadSessionEvents(
  sessionId: string,
): Promise<StoredEvent[]> {
  const eventsPath = getEventsPath(sessionId);
  if (!existsSync(eventsPath)) return [];

  const lines = await tailLines(eventsPath, MAX_SESSION_EVENTS);
  const events: StoredEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as StoredEvent);
    } catch {
      console.warn(`[store] Skipping corrupt JSONL line in ${sessionId}`);
    }
  }
  return events;
}
