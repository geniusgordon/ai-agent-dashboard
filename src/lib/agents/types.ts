/**
 * AI Agent Dashboard - Core Types
 *
 * Unified interface for controlling AI coding agents via ACP
 * (Agent Client Protocol)
 *
 * @see https://agentclientprotocol.com
 */

// =============================================================================
// Agent Types
// =============================================================================

export type AgentType = "gemini" | "claude-code" | "codex";

export type SessionStatus =
  | "idle"
  | "starting"
  | "running"
  | "waiting-approval"
  | "completed"
  | "error"
  | "killed";

const TERMINAL_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "completed",
  "error",
  "killed",
]);

export function isSessionActive(status: SessionStatus): boolean {
  return !TERMINAL_STATUSES.has(status);
}

export type ClientStatus = "starting" | "ready" | "error" | "stopped";

// =============================================================================
// Session & Client Types
// =============================================================================

export interface AgentSession {
  id: string;
  clientId: string;
  agentType: AgentType;
  status: SessionStatus;
  cwd: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  /** Whether this session has an active client connection */
  isActive?: boolean;
  /** Available modes for this session */
  availableModes?: SessionMode[];
  /** Current mode ID */
  currentModeId?: string;
  /** Branch name from the assigned worktree, if any */
  worktreeBranch?: string;
}

export interface AgentClient {
  id: string;
  agentType: AgentType;
  status: ClientStatus;
  cwd: string;
  createdAt: Date;
  capabilities?: AgentCapabilities;
  error?: string;
}

export interface AgentCapabilities {
  loadSession: boolean;
  promptCapabilities: {
    image: boolean;
    audio: boolean;
    embeddedContext: boolean;
  };
  mcpCapabilities: {
    http: boolean;
    sse: boolean;
  };
}

export interface SpawnClientOptions {
  agentType: AgentType;
  cwd: string;
  env?: Record<string, string>;
}

/**
 * Session mode info
 */
export interface SessionMode {
  id: string;
  name: string;
  description?: string;
}

export interface CreateSessionOptions {
  clientId: string;
  cwd?: string; // Defaults to client's cwd
}

// =============================================================================
// Event Types (normalized from ACP session/update)
// =============================================================================

export type AgentEventType =
  | "thinking" // agent_thought_chunk
  | "message" // agent_message_chunk
  | "tool-call" // tool_call
  | "tool-update" // tool_call_update
  | "plan" // plan
  | "mode-change" // agent changed its mode
  | "complete" // prompt response received
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  clientId: string;
  sessionId: string;
  timestamp: Date;
  payload: unknown;
}

export interface ThinkingPayload {
  content: string;
}

export interface MessagePayload {
  content: string;
  delta?: boolean;
  isUser?: boolean;
}

export interface ToolCallPayload {
  toolCallId: string;
  title: string;
  kind: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface ToolUpdatePayload {
  toolCallId: string;
  status: string;
  content?: unknown;
}

export interface TerminalExitContent {
  cwd: string;
  command: string;
  args: string[];
  exitStatus: { exitCode: number | null; signal: string | null };
  truncated: boolean;
  output: string;
  durationMs: number;
}

export interface TerminalErrorContent {
  cwd: string;
  command: string;
  args: string[];
  error: string;
}

export function isTerminalExitContent(v: unknown): v is TerminalExitContent {
  return (
    typeof v === "object" &&
    v !== null &&
    "command" in v &&
    "exitStatus" in v &&
    "output" in v
  );
}

export function isTerminalErrorContent(v: unknown): v is TerminalErrorContent {
  return (
    typeof v === "object" &&
    v !== null &&
    "command" in v &&
    "error" in v &&
    !("exitStatus" in v)
  );
}

export interface PlanPayload {
  entries: Array<{
    content: string;
    priority: string;
    status: string;
  }>;
}

export interface ModeChangePayload {
  currentModeId: string;
}

export interface CompletePayload {
  stopReason: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// =============================================================================
// Approval Types (from ACP session/request_permission)
// =============================================================================

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  clientId: string;
  sessionId: string;
  status: ApprovalStatus;
  createdAt: Date;
  resolvedAt?: Date;
  toolCall: {
    toolCallId: string;
    title: string;
    kind: string;
  };
  options: ApprovalOption[];
}

export interface ApprovalOption {
  optionId: string;
  name: string;
  kind: "allow_once" | "allow_always" | "deny" | string;
  description?: string;
}

// =============================================================================
// Manager Interface
// =============================================================================

export type EventHandler = (event: AgentEvent) => void;
export type ApprovalHandler = (approval: ApprovalRequest) => void;
export type UnsubscribeFn = () => void;

export interface IAgentManager {
  // Client lifecycle
  findOrSpawnClient(options: SpawnClientOptions): Promise<AgentClient>;
  spawnClient(options: SpawnClientOptions): Promise<AgentClient>;
  stopClient(clientId: string): Promise<void>;
  getClient(clientId: string): AgentClient | undefined;
  listClients(): AgentClient[];

  // Session lifecycle
  createSession(options: CreateSessionOptions): Promise<AgentSession>;
  getSession(sessionId: string): AgentSession | undefined;
  listSessions(clientId?: string): AgentSession[];

  // Communication
  sendMessage(
    sessionId: string,
    message: string,
    contentBlocks?: Array<{ type: "image"; data: string; mimeType: string }>,
  ): void;

  // Approvals
  getPendingApprovals(): ApprovalRequest[];
  approveRequest(approvalId: string, optionId: string): Promise<void>;
  denyRequest(approvalId: string): Promise<void>;

  // Events
  onEvent(handler: EventHandler): UnsubscribeFn;
  onApproval(handler: ApprovalHandler): UnsubscribeFn;

  // Cleanup
  dispose(): Promise<void>;
}
