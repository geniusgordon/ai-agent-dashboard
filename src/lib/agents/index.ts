/**
 * Agent Management Module
 *
 * Unified interface for managing AI coding agents via ACP.
 * Supports Gemini CLI, Claude Code, and Codex.
 */

export { AgentManager, getAgentManager } from "./manager.js";
export { loadRecentDirectories } from "./recent-dirs.js";

export type {
  AgentCapabilities,
  AgentClient,
  // Events
  AgentEvent,
  AgentEventType,
  AgentSession,
  // Agent types
  AgentType,
  ApprovalHandler,
  ApprovalOption,
  // Approvals
  ApprovalRequest,
  ApprovalStatus,
  ClientStatus,
  CompletePayload,
  CreateSessionOptions,
  DerivedSessionConfigState,
  ErrorPayload,
  EventHandler,
  // Manager interface
  IAgentManager,
  MessagePayload,
  PlanPayload,
  SessionConfigOption,
  SessionConfigValueOption,
  SessionStatus,
  // Options
  SpawnClientOptions,
  ThinkingPayload,
  ToolCallPayload,
  ToolUpdatePayload,
  UnsubscribeFn,
} from "./types.js";
export {
  deriveSessionConfigState,
  normalizeSessionConfigOptions,
} from "./types.js";
