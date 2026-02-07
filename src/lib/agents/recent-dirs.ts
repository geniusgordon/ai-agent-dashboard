/**
 * Recently Used Working Directories
 *
 * Tracks directories used when spawning agent clients,
 * persisted to disk for quick re-selection.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STORE_DIR = ".agent-store";
const RECENT_DIRS_FILE = join(STORE_DIR, "recent-directories.json");
const MAX_ENTRIES = 10;

export interface RecentDirectory {
  path: string;
  lastUsed: string;
}

/**
 * Load recent directories from disk, sorted by most recently used first.
 */
export function loadRecentDirectories(): RecentDirectory[] {
  if (!existsSync(RECENT_DIRS_FILE)) {
    return [];
  }

  try {
    const data = readFileSync(RECENT_DIRS_FILE, "utf-8");
    const dirs = JSON.parse(data) as RecentDirectory[];
    return dirs.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
    );
  } catch {
    return [];
  }
}

/**
 * Record a directory as recently used.
 * Deduplicates by exact path match, bumps timestamp, and trims to MAX_ENTRIES.
 */
export function recordRecentDirectory(path: string): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }

  const dirs = loadRecentDirectories();
  const filtered = dirs.filter((d) => d.path !== path);

  const updated: RecentDirectory[] = [
    { path, lastUsed: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_ENTRIES);

  writeFileSync(RECENT_DIRS_FILE, JSON.stringify(updated, null, 2));
}
