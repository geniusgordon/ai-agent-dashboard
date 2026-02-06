/**
 * ACP (Agent Client Protocol) Module
 *
 * Unified interface for communicating with ACP-compatible coding agents:
 * - Gemini CLI (native --experimental-acp)
 * - Claude Code (via @zed-industries/claude-code-acp)
 * - Codex (via @zed-industries/codex-acp)
 *
 * @see https://agentclientprotocol.com
 */

// Re-export useful types from SDK
export type {
	ContentBlock,
	InitializeResponse,
	McpServer,
	NewSessionResponse,
	PromptResponse,
	RequestPermissionRequest,
	RequestPermissionResponse,
	SessionNotification,
} from "@agentclientprotocol/sdk";
export {
	ACPClient,
	type ACPClientEvents,
	type AgentConfig,
	type AgentType,
	createACPClient,
	type PendingPermission,
	type Session,
} from "./client.js";
export {
	ACPManager,
	type ACPManagerEvents,
	getACPManager,
	type ManagedClient,
	type ManagedPermission,
	type ManagedSession,
} from "./manager.js";
