/**
 * Tests for AgentManager.findOrSpawnClient
 *
 * Mocks ACPClient to avoid spawning real agent processes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the ACP client module
let sessionIdCounter = 0;
const mockACPClient = {
  start: vi.fn().mockResolvedValue({ agentCapabilities: {} }),
  stop: vi.fn(),
  isRunning: vi.fn().mockReturnValue(true),
  createSession: vi.fn().mockImplementation(() => {
    const id = `session_${++sessionIdCounter}`;
    return Promise.resolve({
      id,
      availableModes: [],
      currentModeId: undefined,
    });
  }),
  on: vi.fn(),
};

vi.mock("../acp/index.js", () => ({
  ACPClient: vi.fn().mockImplementation(() => ({
    ...mockACPClient,
    // Each instance needs its own isRunning so we can control per-client
    isRunning: vi.fn().mockReturnValue(true),
    start: vi.fn().mockResolvedValue({ agentCapabilities: {} }),
    stop: vi.fn(),
    createSession: vi.fn().mockImplementation(() => {
      const id = `session_${++sessionIdCounter}`;
      return Promise.resolve({
        id,
        availableModes: [],
        currentModeId: undefined,
      });
    }),
    on: vi.fn(),
  })),
}));

// Mock store to avoid disk I/O
vi.mock("./store.js", () => ({
  saveSession: vi.fn(),
  loadSession: vi.fn(),
  loadAllSessions: vi.fn().mockReturnValue([]),
  loadSessionEvents: vi.fn().mockReturnValue([]),
  appendSessionEvent: vi.fn(),
  updateSessionStatus: vi.fn(),
  updateSessionName: vi.fn(),
  updateSessionMode: vi.fn(),
  deleteSession: vi.fn(),
}));

// Mock recent dirs
vi.mock("./recent-dirs.js", () => ({
  recordRecentDirectory: vi.fn(),
}));

describe("AgentManager", () => {
  let AgentManagerClass: typeof import("./manager.js").AgentManager;
  let manager: InstanceType<typeof AgentManagerClass>;

  beforeEach(async () => {
    vi.clearAllMocks();
    sessionIdCounter = 0;
    const mod = await import("./manager.js");
    AgentManagerClass = mod.AgentManager;
    manager = new AgentManagerClass();
  });

  afterEach(async () => {
    await manager.dispose();
  });

  // ---------------------------------------------------------------------------
  // findOrSpawnClient
  // ---------------------------------------------------------------------------

  describe("findOrSpawnClient", () => {
    it("spawns a new client when none exists", async () => {
      const client = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      expect(client.id).toBeDefined();
      expect(client.agentType).toBe("claude-code");
      expect(manager.listClients()).toHaveLength(1);
    });

    it("reuses an existing client with same agentType and cwd", async () => {
      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      const second = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      expect(second.id).toBe(first.id);
      expect(manager.listClients()).toHaveLength(1);
    });

    it("spawns a new client for a different cwd", async () => {
      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project-a",
      });

      const second = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project-b",
      });

      expect(second.id).not.toBe(first.id);
      expect(manager.listClients()).toHaveLength(2);
    });

    it("spawns a new client for a different agentType", async () => {
      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      const second = await manager.findOrSpawnClient({
        agentType: "gemini",
        cwd: "/home/user/project",
      });

      expect(second.id).not.toBe(first.id);
      expect(manager.listClients()).toHaveLength(2);
    });

    it("does not reuse a stopped client", async () => {
      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      // Stop the client — makes isRunning() return false
      await manager.stopClient(first.id);

      const second = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      expect(second.id).not.toBe(first.id);
    });

    it("normalizes trailing slashes via path.resolve", async () => {
      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      const second = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project/",
      });

      expect(second.id).toBe(first.id);
      expect(manager.listClients()).toHaveLength(1);
    });

    it("normalizes .. segments via path.resolve", async () => {
      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project",
      });

      const second = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "/home/user/project/subdir/..",
      });

      expect(second.id).toBe(first.id);
      expect(manager.listClients()).toHaveLength(1);
    });

    it("normalizes ~ to HOME", async () => {
      const home = process.env.HOME ?? "";

      const first = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: `${home}/project`,
      });

      const second = await manager.findOrSpawnClient({
        agentType: "claude-code",
        cwd: "~/project",
      });

      expect(second.id).toBe(first.id);
      expect(manager.listClients()).toHaveLength(1);
    });

    it("deduplicates concurrent spawns for the same key", async () => {
      // Fire 5 concurrent findOrSpawnClient calls with same params
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          manager.findOrSpawnClient({
            agentType: "claude-code",
            cwd: "/home/user/project",
          }),
        ),
      );

      // All should return the same client
      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(1);
      expect(manager.listClients()).toHaveLength(1);
    });

    it("deduplicates concurrent spawns but allows different keys", async () => {
      const [a, b] = await Promise.all([
        manager.findOrSpawnClient({
          agentType: "claude-code",
          cwd: "/home/user/project-a",
        }),
        manager.findOrSpawnClient({
          agentType: "claude-code",
          cwd: "/home/user/project-b",
        }),
      ]);

      expect(a.id).not.toBe(b.id);
      expect(manager.listClients()).toHaveLength(2);
    });
  });
});
