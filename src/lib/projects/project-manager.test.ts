/**
 * Tests for ProjectManager
 *
 * Uses in-memory SQLite for fast, isolated tests.
 * Mocks git operations to avoid needing actual repos.
 */

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIGRATIONS } from "./schema.js";

// Mock git operations
vi.mock("./git-operations.js", () => ({
  validatePath: vi.fn(),
  isGitRepo: vi.fn().mockResolvedValue(true),
  isBareRepo: vi.fn().mockResolvedValue(false),
  getRepoRoot: vi.fn().mockImplementation((p: string) => Promise.resolve(p)),
  listWorktrees: vi.fn().mockResolvedValue([]),
  createWorktree: vi.fn().mockResolvedValue(undefined),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
  hasUncommittedChanges: vi.fn().mockResolvedValue(false),
  getCurrentBranch: vi.fn().mockResolvedValue("main"),
  listBranches: vi.fn().mockResolvedValue(["main", "develop"]),
  validateBranchName: vi.fn(),
}));

// Mock db module to use in-memory database
let testDb: Database.Database;

vi.mock("./db.js", () => ({
  getDatabase: () => testDb,
  closeDatabase: () => testDb?.close(),
}));

function setupTestDb() {
  testDb = new Database(":memory:");
  testDb.pragma("foreign_keys = ON");
  for (const migration of MIGRATIONS) {
    testDb.exec(migration.sql);
  }
  testDb
    .prepare("INSERT INTO schema_version (version) VALUES (?)")
    .run(MIGRATIONS.length);
}

describe("ProjectManager", () => {
  let manager: Awaited<typeof import("./project-manager.js")>["ProjectManager"];
  let ProjectManagerClass: typeof manager;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupTestDb();
    const mod = await import("./project-manager.js");
    ProjectManagerClass = mod.ProjectManager;
  });

  afterEach(() => {
    testDb?.close();
  });

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  describe("createProject", () => {
    it("creates a project and returns it", async () => {
      const pm = new ProjectManagerClass();
      const project = await pm.createProject({
        name: "My Project",
        repoPath: "/repos/my-project",
        description: "A test project",
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe("My Project");
      expect(project.slug).toBe("my-project");
      expect(project.repoPath).toBe("/repos/my-project");
      expect(project.description).toBe("A test project");
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it("generates unique slugs for duplicate names", async () => {
      const pm = new ProjectManagerClass();
      const p1 = await pm.createProject({
        name: "My Project",
        repoPath: "/repos/project-1",
      });
      const p2 = await pm.createProject({
        name: "My Project",
        repoPath: "/repos/project-2",
      });

      expect(p1.slug).toBe("my-project");
      expect(p2.slug).toBe("my-project-1");
    });
  });

  describe("getProject", () => {
    it("returns undefined for non-existent project", () => {
      const pm = new ProjectManagerClass();
      expect(pm.getProject("non-existent")).toBeUndefined();
    });

    it("returns the project by ID", async () => {
      const pm = new ProjectManagerClass();
      const created = await pm.createProject({
        name: "Test",
        repoPath: "/repos/test",
      });

      const found = pm.getProject(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe("Test");
    });
  });

  describe("listProjects", () => {
    it("returns empty array when no projects", () => {
      const pm = new ProjectManagerClass();
      expect(pm.listProjects()).toEqual([]);
    });

    it("returns all projects", async () => {
      const pm = new ProjectManagerClass();
      await pm.createProject({ name: "A", repoPath: "/repos/a" });
      await pm.createProject({ name: "B", repoPath: "/repos/b" });

      const projects = pm.listProjects();
      expect(projects).toHaveLength(2);
      const names = projects.map((p) => p.name).sort();
      expect(names).toEqual(["A", "B"]);
    });
  });

  describe("updateProject", () => {
    it("updates name and description", async () => {
      const pm = new ProjectManagerClass();
      const project = await pm.createProject({
        name: "Old",
        repoPath: "/repos/old",
      });

      const updated = pm.updateProject(project.id, {
        name: "New",
        description: "Updated description",
      });

      expect(updated.name).toBe("New");
      expect(updated.description).toBe("Updated description");
      expect(updated.slug).toBe("new"); // slug updated
    });

    it("throws for non-existent project", () => {
      const pm = new ProjectManagerClass();
      expect(() => pm.updateProject("nope", { name: "X" })).toThrow(
        "Project not found",
      );
    });
  });

  describe("deleteProject", () => {
    it("deletes project and cascades to worktrees", async () => {
      const pm = new ProjectManagerClass();
      const project = await pm.createProject({
        name: "ToDelete",
        repoPath: "/repos/delete",
      });

      pm.deleteProject(project.id);
      expect(pm.getProject(project.id)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Agent Assignments
  // ---------------------------------------------------------------------------

  describe("agent assignments", () => {
    it("assigns and retrieves agent to worktree", async () => {
      const pm = new ProjectManagerClass();
      const project = await pm.createProject({
        name: "AssignTest",
        repoPath: "/repos/assign",
      });

      // Manually insert a worktree for testing
      testDb
        .prepare(
          `INSERT INTO worktrees (id, project_id, name, path, branch, is_main_worktree, created_at, updated_at)
           VALUES ('wt-1', ?, 'main', '/repos/assign', 'main', 1, datetime('now'), datetime('now'))`,
        )
        .run(project.id);

      const assignment = pm.assignAgentToWorktree({
        sessionId: "session-1",
        clientId: "client-1",
        worktreeId: "wt-1",
        projectId: project.id,
      });

      expect(assignment.sessionId).toBe("session-1");
      expect(assignment.clientId).toBe("client-1");
      expect(assignment.worktreeId).toBe("wt-1");

      // Retrieve by session
      const found = pm.getAssignmentForSession("session-1");
      expect(found).toBeDefined();
      expect(found!.id).toBe(assignment.id);

      // Retrieve by worktree
      const wtAssignments = pm.getAssignmentsForWorktree("wt-1");
      expect(wtAssignments).toHaveLength(1);

      // Retrieve by project
      const projAssignments = pm.getAssignmentsForProject(project.id);
      expect(projAssignments).toHaveLength(1);
    });

    it("unassigns by session ID", async () => {
      const pm = new ProjectManagerClass();
      const project = await pm.createProject({
        name: "Unassign",
        repoPath: "/repos/unassign",
      });

      testDb
        .prepare(
          `INSERT INTO worktrees (id, project_id, name, path, branch, is_main_worktree, created_at, updated_at)
           VALUES ('wt-2', ?, 'main', '/repos/unassign', 'main', 1, datetime('now'), datetime('now'))`,
        )
        .run(project.id);

      pm.assignAgentToWorktree({
        sessionId: "session-2",
        clientId: "client-2",
        worktreeId: "wt-2",
        projectId: project.id,
      });

      pm.unassignAgent("session-2");
      expect(pm.getAssignmentForSession("session-2")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  describe("importFromDirectory", () => {
    it("creates a project from directory path", async () => {
      const pm = new ProjectManagerClass();
      const project = await pm.importFromDirectory("/repos/imported");

      expect(project.name).toBe("imported"); // basename
      expect(project.repoPath).toBe("/repos/imported");
    });

    it("returns existing project if repo already imported", async () => {
      const pm = new ProjectManagerClass();
      const first = await pm.importFromDirectory("/repos/existing");
      const second = await pm.importFromDirectory("/repos/existing");

      expect(first.id).toBe(second.id);
    });
  });
});
