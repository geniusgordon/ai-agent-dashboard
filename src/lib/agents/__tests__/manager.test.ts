import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseAdapter } from "../adapters/base";
import {
	getSessionManager,
	resetSessionManager,
	type SessionManager as SessionManagerImpl,
} from "../manager";
import type {
	AgentEventType,
	AgentSession,
	AgentType,
	SpawnOptions,
} from "../types";

// Mock adapter for testing
class MockAdapter extends BaseAdapter {
	readonly type: AgentType = "claude-code";

	async spawn(options: SpawnOptions): Promise<AgentSession> {
		const session: AgentSession = {
			id: this.generateId(),
			type: this.type,
			status: "running",
			cwd: options.cwd,
			prompt: options.prompt,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		this.sessions.set(session.id, session);
		return session;
	}

	async kill(sessionId: string): Promise<void> {
		this.updateSession(sessionId, { status: "killed" });
	}

	async sendMessage(_sessionId: string, _message: string): Promise<void> {
		// Mock implementation
	}

	async approve(_approvalId: string): Promise<void> {
		// Mock implementation
	}

	async reject(_approvalId: string, _reason?: string): Promise<void> {
		// Mock implementation
	}

	async dispose(): Promise<void> {
		this.sessions.clear();
	}

	// Helper for testing
	emitTestEvent(sessionId: string, type: AgentEventType, payload: unknown) {
		this.emitEvent({
			type,
			sessionId,
			timestamp: new Date(),
			payload,
		});
	}
}

describe("SessionManager", () => {
	let manager: SessionManagerImpl;
	let mockAdapter: MockAdapter;

	beforeEach(() => {
		resetSessionManager();
		manager = getSessionManager();
		mockAdapter = new MockAdapter();
		manager.registerAdapter(mockAdapter);
	});

	afterEach(async () => {
		await manager.dispose();
	});

	describe("spawn", () => {
		it("should spawn a session with the correct adapter", async () => {
			const session = await manager.spawn({
				type: "claude-code",
				cwd: "/test/path",
				prompt: "test prompt",
			});

			expect(session).toBeDefined();
			expect(session.type).toBe("claude-code");
			expect(session.cwd).toBe("/test/path");
			expect(session.prompt).toBe("test prompt");
			expect(session.status).toBe("running");
		});

		it("should throw if no adapter is registered for the type", async () => {
			await expect(
				manager.spawn({
					type: "codex" as AgentType,
					cwd: "/test",
					prompt: "test",
				}),
			).rejects.toThrow("No adapter registered");
		});
	});

	describe("listAllSessions", () => {
		it("should return all sessions across adapters", async () => {
			await manager.spawn({ type: "claude-code", cwd: "/test1", prompt: "p1" });
			await manager.spawn({ type: "claude-code", cwd: "/test2", prompt: "p2" });

			const sessions = manager.listAllSessions();
			expect(sessions).toHaveLength(2);
		});
	});

	describe("kill", () => {
		it("should kill a session", async () => {
			const session = await manager.spawn({
				type: "claude-code",
				cwd: "/test",
				prompt: "test",
			});

			await manager.kill(session.id);

			const updated = manager.getSession(session.id);
			expect(updated?.status).toBe("killed");
		});
	});

	describe("events", () => {
		it("should emit events to subscribers", async () => {
			const handler = vi.fn();
			manager.onEvent(handler);

			const session = await manager.spawn({
				type: "claude-code",
				cwd: "/test",
				prompt: "test",
			});

			// Emit a test event from the adapter
			mockAdapter.emitTestEvent(session.id, "message", { content: "hello" });

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "message",
					sessionId: session.id,
					payload: { content: "hello" },
				}),
			);
		});
	});

	describe("singleton", () => {
		it("should return the same instance", () => {
			const m1 = getSessionManager();
			const m2 = getSessionManager();
			expect(m1).toBe(m2);
		});

		it("should reset the instance", async () => {
			const m1 = getSessionManager();
			resetSessionManager();
			const m2 = getSessionManager();
			expect(m1).not.toBe(m2);
		});
	});
});
