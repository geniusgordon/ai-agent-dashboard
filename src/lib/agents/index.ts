/**
 * Agent Management Module
 *
 * Unified interface for managing AI coding agents via ACP.
 * Supports Gemini CLI, Claude Code, and Codex.
 */

export { AgentManager, getAgentManager } from "./manager.js";

export type {
  // Agent types
  AgentType,
  AgentSession,
  AgentClient,
  AgentCapabilities,
  ClientStatus,
  SessionStatus,

  // Options
  SpawnClientOptions,
  CreateSessionOptions,

  // Events
  AgentEvent,
  AgentEventType,
  ThinkingPayload,
  MessagePayload,
  ToolCallPayload,
  ToolUpdatePayload,
  PlanPayload,
  CompletePayload,
  ErrorPayload,

  // Approvals
  ApprovalRequest,
  ApprovalOption,
  ApprovalStatus,

  // Manager interface
  IAgentManager,
  EventHandler,
  ApprovalHandler,
  UnsubscribeFn,
} from "./types.js";
