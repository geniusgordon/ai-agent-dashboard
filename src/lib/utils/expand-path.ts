import { resolve } from "node:path";

const HOME_DIR = process.env.HOME ?? "";

/**
 * Expand a leading `~` to the user's home directory and resolve the path.
 * Throws if HOME is not set when `~` is used.
 */
export function expandPath(p: string): string {
  if (p === "~" || p.startsWith("~/")) {
    if (!HOME_DIR) throw new Error("HOME environment variable is not set");
    p = HOME_DIR + p.slice(1);
  }
  return resolve(p);
}

/**
 * Collapse absolute home-prefixed paths back to `~` for display.
 */
export function collapsePath(p: string): string {
  if (HOME_DIR && (p === HOME_DIR || p.startsWith(`${HOME_DIR}/`))) {
    return `~${p.slice(HOME_DIR.length)}`;
  }
  return p;
}
