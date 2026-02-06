/**
 * Session Manager
 *
 * Manages multiple agent adapters and provides a unified interface.
 */

import type {
	AgentAdapter,
	AgentEvent,
	AgentSession,
	AgentType,
	ApprovalRequest,
	EventHandler,
	SessionManager as ISessionManager,
	SpawnOptions,
	UnsubscribeFn,
} from "./types";

export class SessionManager implements ISessionManager {
	private adapters: Map<AgentType, AgentAdapter> = new Map();
	private sessionToAdapter: Map<string, AgentType> = new Map();
	private globalHandlers: Set<EventHandler> = new Set();

	// ---------------------------------------------------------------------------
	// Adapter Management
	// ---------------------------------------------------------------------------

	registerAdapter(adapter: AgentAdapter): void {
		console.log(`[SessionManager] Registering adapter: ${adapter.type}`);
		this.adapters.set(adapter.type, adapter);

		// Subscribe to all events from this adapter
		adapter.onAllEvents((event) => {
			this.emitEvent(event);
		});
	}

	getAdapter(type: AgentType): AgentAdapter | undefined {
		return this.adapters.get(type);
	}

	// ---------------------------------------------------------------------------
	// Session Operations
	// ---------------------------------------------------------------------------

	async spawn(options: SpawnOptions): Promise<AgentSession> {
		const adapter = this.adapters.get(options.type);
		if (!adapter) {
			throw new Error(`No adapter registered for agent type: ${options.type}`);
		}

		const session = await adapter.spawn(options);

		// Track which adapter owns this session
		this.sessionToAdapter.set(session.id, options.type);

		return session;
	}

	async kill(sessionId: string): Promise<void> {
		const adapterType = this.sessionToAdapter.get(sessionId);
		if (!adapterType) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		const adapter = this.adapters.get(adapterType);
		if (!adapter) {
			throw new Error(`Adapter not found for type: ${adapterType}`);
		}

		await adapter.kill(sessionId);
		// Note: We don't delete the mapping here so the session can still be queried
		// The session status will be 'killed' but remains accessible for history
	}

	async sendMessage(sessionId: string, message: string): Promise<void> {
		const adapter = this.getAdapterForSession(sessionId);
		await adapter.sendMessage(sessionId, message);
	}

	getSession(sessionId: string): AgentSession | undefined {
		const adapterType = this.sessionToAdapter.get(sessionId);
		if (!adapterType) {
			return undefined;
		}
		const adapter = this.adapters.get(adapterType);
		return adapter?.getSession(sessionId);
	}

	listAllSessions(): AgentSession[] {
		const sessions: AgentSession[] = [];
		for (const adapter of this.adapters.values()) {
			sessions.push(...adapter.listSessions());
		}
		return sessions;
	}

	// ---------------------------------------------------------------------------
	// Approval Operations
	// ---------------------------------------------------------------------------

	async approve(approvalId: string, sessionId: string): Promise<void> {
		const adapter = this.getAdapterForSession(sessionId);
		await adapter.approve(approvalId);
	}

	async reject(
		approvalId: string,
		sessionId: string,
		reason?: string,
	): Promise<void> {
		const adapter = this.getAdapterForSession(sessionId);
		await adapter.reject(approvalId, reason);
	}

	getAllPendingApprovals(): ApprovalRequest[] {
		const approvals: ApprovalRequest[] = [];
		for (const adapter of this.adapters.values()) {
			for (const session of adapter.listSessions()) {
				approvals.push(...adapter.getPendingApprovals(session.id));
			}
		}
		return approvals;
	}

	getPendingApprovals(sessionId: string): ApprovalRequest[] {
		const adapter = this.getAdapterForSession(sessionId);
		return adapter?.getPendingApprovals(sessionId) ?? [];
	}

	// ---------------------------------------------------------------------------
	// Events
	// ---------------------------------------------------------------------------

	onEvent(handler: EventHandler): UnsubscribeFn {
		this.globalHandlers.add(handler);
		return () => {
			this.globalHandlers.delete(handler);
		};
	}

	onSessionEvent(sessionId: string, handler: EventHandler): UnsubscribeFn {
		const adapter = this.getAdapterForSession(sessionId);
		return adapter.onEvent(sessionId, handler);
	}

	private emitEvent(event: AgentEvent): void {
		for (const handler of this.globalHandlers) {
			try {
				handler(event);
			} catch (err) {
				console.error("[SessionManager] Error in event handler:", err);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	async dispose(): Promise<void> {
		console.log("[SessionManager] Disposing all adapters...");

		const disposePromises = Array.from(this.adapters.values()).map((adapter) =>
			adapter.dispose(),
		);
		await Promise.all(disposePromises);

		this.adapters.clear();
		this.sessionToAdapter.clear();
		this.globalHandlers.clear();
	}

	// ---------------------------------------------------------------------------
	// Private Helpers
	// ---------------------------------------------------------------------------

	private getAdapterForSession(sessionId: string): AgentAdapter {
		const adapterType = this.sessionToAdapter.get(sessionId);
		if (!adapterType) {
			throw new Error(`Unknown session: ${sessionId}`);
		}

		const adapter = this.adapters.get(adapterType);
		if (!adapter) {
			throw new Error(`Adapter not found for type: ${adapterType}`);
		}

		return adapter;
	}
}

// Singleton instance
let instance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
	if (!instance) {
		instance = new SessionManager();
	}
	return instance;
}

export function resetSessionManager(): void {
	if (instance) {
		instance.dispose();
		instance = null;
	}
}
