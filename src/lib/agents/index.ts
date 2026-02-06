/**
 * AI Agent Dashboard - Agent Management
 *
 * @example
 * ```ts
 * import { getSessionManager, ClaudeCodeAdapter } from '~/lib/agents'
 *
 * const manager = getSessionManager()
 * manager.registerAdapter(new ClaudeCodeAdapter())
 *
 * const session = await manager.spawn({
 *   type: 'claude-code',
 *   cwd: '/path/to/project',
 *   prompt: 'Help me refactor this code',
 * })
 *
 * manager.onEvent((event) => {
 *   console.log('Event:', event.type, event.payload)
 * })
 * ```
 */

// Adapters
export { BaseAdapter } from "./adapters/base";
export { ClaudeCodeAdapter } from "./adapters/claude";
export { CodexAdapter } from "./adapters/codex";
// Manager
export {
	getSessionManager,
	resetSessionManager,
	SessionManager as SessionManagerImpl,
} from "./manager";
// Types
export type {
	AgentAdapter,
	AgentEvent,
	AgentEventType,
	AgentSession,
	AgentType,
	ApprovalDetails,
	ApprovalRequest,
	ApprovalStatus,
	ApprovalType,
	ErrorEventPayload,
	EventHandler,
	InitEventPayload,
	MessageEventPayload,
	SessionManager,
	SessionStatus,
	SpawnOptions,
	ThinkingEventPayload,
	ToolResultEventPayload,
	ToolUseEventPayload,
	UnsubscribeFn,
} from "./types";
