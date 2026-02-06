/**
 * Persistent Storage for Agent Sessions
 *
 * Stores session data to JSON files for persistence across restarts.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  AgentEvent,
  AgentEventType,
  AgentType,
  SessionStatus,
} from "./types";

// Store directory (relative to project root)
const STORE_DIR = ".agent-store";
const SESSIONS_DIR = join(STORE_DIR, "sessions");

interface StoredEvent {
  type: AgentEventType;
  clientId: string;
  sessionId: string;
  timestamp: string;
  payload: unknown;
}

interface StoredSession {
  id: string;
  clientId: string;
  agentType: AgentType;
  cwd?: string;
  name?: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  events: StoredEvent[];
}

/**
 * Ensure store directories exist
 */
function ensureStoreDirs(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Get session file path
 */
function getSessionPath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.json`);
}

/**
 * Save a session to disk
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
  },
  events: AgentEvent[],
): void {
  ensureStoreDirs();

  const stored: StoredSession = {
    id: session.id,
    clientId: session.clientId,
    agentType: session.agentType,
    cwd: session.cwd,
    name: session.name,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    events: events.map((e) => ({
      type: e.type,
      clientId: e.clientId,
      sessionId: e.sessionId,
      timestamp: e.timestamp.toISOString(),
      payload: e.payload,
    })),
  };

  writeFileSync(getSessionPath(session.id), JSON.stringify(stored, null, 2));
}

/**
 * Load a session from disk
 */
export function loadSession(sessionId: string): StoredSession | null {
  const path = getSessionPath(sessionId);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const data = readFileSync(path, "utf-8");
    return JSON.parse(data) as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Load all sessions from disk
 */
export function loadAllSessions(): StoredSession[] {
  ensureStoreDirs();

  const sessions: StoredSession[] = [];
  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const data = readFileSync(join(SESSIONS_DIR, file), "utf-8");
      sessions.push(JSON.parse(data) as StoredSession);
    } catch {
      // Skip invalid files
    }
  }

  return sessions;
}

/**
 * Delete a session from disk
 */
export function deleteSession(sessionId: string): void {
  const path = getSessionPath(sessionId);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Update session status on disk
 */
export function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): void {
  const stored = loadSession(sessionId);
  if (stored) {
    stored.status = status;
    stored.updatedAt = new Date().toISOString();
    writeFileSync(getSessionPath(sessionId), JSON.stringify(stored, null, 2));
  }
}

/**
 * Append event to session on disk
 */
export function appendSessionEvent(sessionId: string, event: AgentEvent): void {
  const stored = loadSession(sessionId);
  if (stored) {
    stored.events.push({
      type: event.type,
      clientId: event.clientId,
      sessionId: event.sessionId,
      timestamp: event.timestamp.toISOString(),
      payload: event.payload,
    });
    stored.updatedAt = new Date().toISOString();
    writeFileSync(getSessionPath(sessionId), JSON.stringify(stored, null, 2));
  }
}

/**
 * Update session name on disk
 */
export function updateSessionName(sessionId: string, name: string): void {
  const stored = loadSession(sessionId);
  if (stored) {
    stored.name = name;
    stored.updatedAt = new Date().toISOString();
    writeFileSync(getSessionPath(sessionId), JSON.stringify(stored, null, 2));
  }
}
