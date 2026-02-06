/**
 * AI Agent Dashboard - Core Types
 *
 * Unified interface for controlling AI coding agents (Claude Code, Codex, etc.)
 */

// =============================================================================
// Session Types
// =============================================================================

export type AgentType = "claude-code" | "codex";

export type SessionStatus =
	| "idle"
	| "starting"
	| "running"
	| "waiting-approval"
	| "completed"
	| "error"
	| "killed";

export interface AgentSession {
	id: string;
	type: AgentType;
	status: SessionStatus;
	cwd: string;
	createdAt: Date;
	updatedAt: Date;
	model?: string;
	prompt?: string;
	/** Native session ID from the agent (e.g., Claude Code's session_id) */
	nativeSessionId?: string;
	/** Error message if status is 'error' */
	error?: string;
}

export interface SpawnOptions {
	type: AgentType;
	cwd: string;
	prompt: string;
	model?: string;
	/** Permission mode for Claude Code */
	permissionMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions";
	/** Sandbox mode for Codex */
	sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
}

// =============================================================================
// Event Types
// =============================================================================

export type AgentEventType =
	| "init"
	| "message"
	| "thinking"
	| "tool-use"
	| "tool-result"
	| "approval-request"
	| "approval-response"
	| "error"
	| "complete"
	| "raw"; // For debugging: raw unparsed event

export interface AgentEvent {
	type: AgentEventType;
	sessionId: string;
	timestamp: Date;
	payload: unknown;
}

// Specific event payloads
export interface InitEventPayload {
	nativeSessionId: string;
	cwd: string;
	model: string;
	tools: string[];
}

export interface MessageEventPayload {
	role: "assistant" | "user";
	content: string;
}

export interface ThinkingEventPayload {
	content: string;
}

export interface ToolUseEventPayload {
	toolName: string;
	toolId: string;
	input: unknown;
}

export interface ToolResultEventPayload {
	toolId: string;
	output: unknown;
	isError?: boolean;
}

export interface ErrorEventPayload {
	message: string;
	code?: string;
	details?: unknown;
}

// =============================================================================
// Approval Types
// =============================================================================

export type ApprovalType =
	| "command"
	| "file-edit"
	| "file-create"
	| "file-delete"
	| "file-read"
	| "unknown";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
	id: string;
	sessionId: string;
	type: ApprovalType;
	status: ApprovalStatus;
	description: string;
	createdAt: Date;
	resolvedAt?: Date;
	details: ApprovalDetails;
}

export interface ApprovalDetails {
	/** For command approvals */
	command?: string[];
	cwd?: string;
	/** For file approvals */
	filePath?: string;
	/** Diff or content for file edits */
	diff?: string;
	content?: string;
	/** Raw data from the agent */
	raw?: unknown;
}

// =============================================================================
// Adapter Interface
// =============================================================================

export type EventHandler = (event: AgentEvent) => void;
export type UnsubscribeFn = () => void;

export interface AgentAdapter {
	readonly type: AgentType;

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Spawn a new agent session
	 */
	spawn(options: SpawnOptions): Promise<AgentSession>;

	/**
	 * Kill a running session
	 */
	kill(sessionId: string): Promise<void>;

	/**
	 * Get session by ID
	 */
	getSession(sessionId: string): AgentSession | undefined;

	/**
	 * List all sessions managed by this adapter
	 */
	listSessions(): AgentSession[];

	// ---------------------------------------------------------------------------
	// Communication
	// ---------------------------------------------------------------------------

	/**
	 * Send a message to a running session
	 * (Only works if the agent supports bidirectional communication)
	 */
	sendMessage(sessionId: string, message: string): Promise<void>;

	// ---------------------------------------------------------------------------
	// Approvals
	// ---------------------------------------------------------------------------

	/**
	 * Approve a pending approval request
	 */
	approve(approvalId: string): Promise<void>;

	/**
	 * Reject a pending approval request
	 */
	reject(approvalId: string, reason?: string): Promise<void>;

	/**
	 * Get pending approval requests for a session
	 */
	getPendingApprovals(sessionId: string): ApprovalRequest[];

	// ---------------------------------------------------------------------------
	// Events
	// ---------------------------------------------------------------------------

	/**
	 * Subscribe to events from a session
	 * Returns an unsubscribe function
	 */
	onEvent(sessionId: string, handler: EventHandler): UnsubscribeFn;

	/**
	 * Subscribe to events from all sessions
	 */
	onAllEvents(handler: EventHandler): UnsubscribeFn;

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	/**
	 * Dispose of the adapter and all sessions
	 */
	dispose(): Promise<void>;
}

// =============================================================================
// Session Manager Types
// =============================================================================

export interface SessionManager {
	/**
	 * Register an adapter for an agent type
	 */
	registerAdapter(adapter: AgentAdapter): void;

	/**
	 * Get adapter for an agent type
	 */
	getAdapter(type: AgentType): AgentAdapter | undefined;

	/**
	 * Spawn a new session (delegates to the appropriate adapter)
	 */
	spawn(options: SpawnOptions): Promise<AgentSession>;

	/**
	 * Kill a session
	 */
	kill(sessionId: string): Promise<void>;

	/**
	 * Get all sessions across all adapters
	 */
	listAllSessions(): AgentSession[];

	/**
	 * Get all pending approvals across all adapters
	 */
	getAllPendingApprovals(): ApprovalRequest[];

	/**
	 * Subscribe to events from all adapters
	 */
	onEvent(handler: EventHandler): UnsubscribeFn;

	/**
	 * Dispose of all adapters
	 */
	dispose(): Promise<void>;
}
