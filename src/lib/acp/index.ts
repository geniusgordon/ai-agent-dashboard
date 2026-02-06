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

export {
  ACPClient,
  createACPClient,
  type AgentType,
  type AgentConfig,
  type Session,
  type PendingPermission,
  type ACPClientEvents,
} from "./client.js";

export {
  ACPManager,
  getACPManager,
  type ManagedClient,
  type ManagedSession,
  type ManagedPermission,
  type ACPManagerEvents,
} from "./manager.js";

// Re-export useful types from SDK
export type {
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  InitializeResponse,
  NewSessionResponse,
  PromptResponse,
  ContentBlock,
  McpServer,
} from "@agentclientprotocol/sdk";
