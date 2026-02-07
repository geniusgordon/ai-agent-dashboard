/**
 * Tests for git-operations.ts
 *
 * Tests validation logic and output parsing.
 * Mocks `execFile` to avoid needing actual git repos.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateBranchName } from "./git-operations.js";

// =============================================================================
// Branch Name Validation
// =============================================================================

describe("validateBranchName", () => {
  it("accepts valid branch names", () => {
    expect(() => validateBranchName("main")).not.toThrow();
    expect(() => validateBranchName("feature/add-login")).not.toThrow();
    expect(() => validateBranchName("fix-123")).not.toThrow();
    expect(() => validateBranchName("release/v2.0")).not.toThrow();
  });

  it("rejects empty branch names", () => {
    expect(() => validateBranchName("")).toThrow("cannot be empty");
  });

  it("rejects names starting with -", () => {
    expect(() => validateBranchName("-bad")).toThrow("cannot start with '-'");
  });

  it("rejects names starting with .", () => {
    expect(() => validateBranchName(".hidden")).toThrow(
      "cannot start or end with '.'",
    );
  });

  it("rejects names ending with .", () => {
    expect(() => validateBranchName("bad.")).toThrow(
      "cannot start or end with '.'",
    );
  });

  it("rejects names with spaces", () => {
    expect(() => validateBranchName("has space")).toThrow("invalid characters");
  });

  it("rejects names with ~", () => {
    expect(() => validateBranchName("bad~name")).toThrow("invalid characters");
  });

  it("rejects names with ^", () => {
    expect(() => validateBranchName("bad^name")).toThrow("invalid characters");
  });

  it("rejects names with :", () => {
    expect(() => validateBranchName("bad:name")).toThrow("invalid characters");
  });

  it("rejects names with ?", () => {
    expect(() => validateBranchName("bad?name")).toThrow("invalid characters");
  });

  it("rejects names with *", () => {
    expect(() => validateBranchName("bad*name")).toThrow("invalid characters");
  });

  it("rejects names with [", () => {
    expect(() => validateBranchName("bad[name")).toThrow("invalid characters");
  });

  it("rejects names with backslash", () => {
    expect(() => validateBranchName("bad\\name")).toThrow("invalid characters");
  });

  it("rejects names with ..", () => {
    expect(() => validateBranchName("bad..name")).toThrow(
      "cannot contain '..'",
    );
  });

  it("rejects names ending with .lock", () => {
    expect(() => validateBranchName("branch.lock")).toThrow(
      "cannot end with '.lock'",
    );
  });

  it("rejects names ending with /", () => {
    expect(() => validateBranchName("bad/")).toThrow("cannot end with '/'");
  });
});

// =============================================================================
// Worktree Porcelain Parsing
// =============================================================================

describe("listWorktrees (parsing)", () => {
  // We test the parsing logic by mocking execFile
  const mockExecFile = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockExecFile.mockReset();
  });

  it("parses porcelain output with multiple worktrees", async () => {
    // Mock the child_process module
    vi.doMock("node:child_process", () => ({
      execFile: (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: null, result: { stdout: string; stderr: string }) => void,
      ) => {
        cb(null, {
          stdout: [
            "worktree /repo",
            "HEAD abc123",
            "branch refs/heads/main",
            "",
            "worktree /repo/feature-x",
            "HEAD def456",
            "branch refs/heads/feature-x",
            "",
          ].join("\n"),
          stderr: "",
        });
      },
    }));

    const { listWorktrees } = await import("./git-operations.js");
    const result = await listWorktrees("/repo");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      path: "/repo",
      head: "abc123",
      branch: "main",
    });
    expect(result[1]).toMatchObject({
      path: "/repo/feature-x",
      head: "def456",
      branch: "feature-x",
    });
  });

  it("handles bare repo in worktree list and resolves branch from HEAD", async () => {
    vi.doMock("node:child_process", () => ({
      execFile: (
        _cmd: string,
        args: string[],
        _opts: unknown,
        cb: (err: null, result: { stdout: string; stderr: string }) => void,
      ) => {
        if (args.includes("worktree")) {
          cb(null, {
            stdout: ["worktree /repo.git", "HEAD abc123", "bare", ""].join(
              "\n",
            ),
            stderr: "",
          });
        } else if (args.includes("rev-parse")) {
          cb(null, { stdout: "main\n", stderr: "" });
        }
      },
    }));

    const { listWorktrees } = await import("./git-operations.js");
    const result = await listWorktrees("/repo.git");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      path: "/repo.git",
      isBare: true,
      branch: "main",
    });
  });

  it("handles detached HEAD", async () => {
    vi.doMock("node:child_process", () => ({
      execFile: (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: null, result: { stdout: string; stderr: string }) => void,
      ) => {
        cb(null, {
          stdout: [
            "worktree /repo/detached",
            "HEAD abc123",
            "detached",
            "",
          ].join("\n"),
          stderr: "",
        });
      },
    }));

    const { listWorktrees } = await import("./git-operations.js");
    const result = await listWorktrees("/repo/detached");

    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe("(detached)");
  });
});
