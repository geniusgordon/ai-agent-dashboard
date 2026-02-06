/**
 * Base Adapter - Abstract class with common functionality
 */

import type {
	AgentAdapter,
	AgentEvent,
	AgentSession,
	AgentType,
	ApprovalRequest,
	EventHandler,
	SpawnOptions,
	UnsubscribeFn,
} from "../types";

export abstract class BaseAdapter implements AgentAdapter {
	abstract readonly type: AgentType;

	// In-memory storage
	protected sessions: Map<string, AgentSession> = new Map();
	protected approvals: Map<string, ApprovalRequest> = new Map();

	// Event handlers
	protected sessionHandlers: Map<string, Set<EventHandler>> = new Map();
	protected globalHandlers: Set<EventHandler> = new Set();

	// ---------------------------------------------------------------------------
	// Abstract methods (must be implemented by subclasses)
	// ---------------------------------------------------------------------------

	abstract spawn(options: SpawnOptions): Promise<AgentSession>;
	abstract kill(sessionId: string): Promise<void>;
	abstract sendMessage(sessionId: string, message: string): Promise<void>;
	abstract approve(approvalId: string): Promise<void>;
	abstract reject(approvalId: string, reason?: string): Promise<void>;
	abstract dispose(): Promise<void>;

	// ---------------------------------------------------------------------------
	// Common implementations
	// ---------------------------------------------------------------------------

	getSession(sessionId: string): AgentSession | undefined {
		return this.sessions.get(sessionId);
	}

	listSessions(): AgentSession[] {
		return Array.from(this.sessions.values());
	}

	getPendingApprovals(sessionId: string): ApprovalRequest[] {
		return Array.from(this.approvals.values()).filter(
			(a) => a.sessionId === sessionId && a.status === "pending",
		);
	}

	onEvent(sessionId: string, handler: EventHandler): UnsubscribeFn {
		let handlers = this.sessionHandlers.get(sessionId);
		if (!handlers) {
			handlers = new Set();
			this.sessionHandlers.set(sessionId, handlers);
		}
		handlers.add(handler);

		return () => {
			handlers?.delete(handler);
		};
	}

	onAllEvents(handler: EventHandler): UnsubscribeFn {
		this.globalHandlers.add(handler);
		return () => {
			this.globalHandlers.delete(handler);
		};
	}

	// ---------------------------------------------------------------------------
	// Helper methods for subclasses
	// ---------------------------------------------------------------------------

	protected emitEvent(event: AgentEvent): void {
		// Emit to session-specific handlers
		const handlers = this.sessionHandlers.get(event.sessionId);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(event);
				} catch (err) {
					console.error("[BaseAdapter] Error in event handler:", err);
				}
			}
		}

		// Emit to global handlers
		for (const handler of this.globalHandlers) {
			try {
				handler(event);
			} catch (err) {
				console.error("[BaseAdapter] Error in global event handler:", err);
			}
		}
	}

	protected updateSession(
		sessionId: string,
		update: Partial<AgentSession>,
	): AgentSession | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		const updated = {
			...session,
			...update,
			updatedAt: new Date(),
		};
		this.sessions.set(sessionId, updated);
		return updated;
	}

	protected generateId(): string {
		return crypto.randomUUID();
	}
}
