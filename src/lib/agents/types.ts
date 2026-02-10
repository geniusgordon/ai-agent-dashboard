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
  /** Raw ACP config options advertised by the agent */
  configOptions?: SessionConfigOption[];
  /** ACP option id used for model switching */
  modelOptionId?: string;
  /** Available model values */
  availableModels?: SessionConfigValueOption[];
  /** Current model value */
  currentModel?: string;
  /** ACP option id used for thought-level switching */
  thoughtLevelOptionId?: string;
  /** Available thought-level values */
  availableThoughtLevels?: SessionConfigValueOption[];
  /** Current thought-level value */
  currentThoughtLevel?: string;
  /** Project this session belongs to */
  projectId?: string;
  /** Worktree this session was assigned to */
  worktreeId?: string;
  /** Branch name from the assigned worktree */
  worktreeBranch?: string;
  /** Latest context window usage info */
  usageInfo?: UsageUpdatePayload;
  /** Available slash commands advertised by the agent */
  availableCommands?: Array<{
    name: string;
    description: string;
    hasInput: boolean;
  }>;
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

export interface SessionConfigValueOption {
  value: string;
  name: string;
}

export interface SessionConfigOption {
  id: string;
  name: string;
  category: "mode" | "model" | "thought_level" | "_custom";
  currentValue: string;
  options: SessionConfigValueOption[];
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
  | "config-update" // config options changed (model/thought level/etc.)
  | "usage-update" // usage_update (context window)
  | "commands-update" // available_commands_update
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

export interface DiffContentBlock {
  type: "diff";
  /** Absent or null for newly created files. */
  oldText?: string | null;
  newText: string;
  path: string;
}

export function isDiffContentBlock(item: unknown): item is DiffContentBlock {
  if (typeof item !== "object" || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    r.type === "diff" &&
    typeof r.newText === "string" &&
    typeof r.path === "string"
  );
}

/** Returns true when `v` is an array containing at least one diff block. */
export function hasDiffContent(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0 && v.some(isDiffContentBlock);
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

/** Session-level context window usage (from usage_update notification). */
export interface UsageUpdatePayload {
  used: number;
  size: number;
  cost?: { amount: number; currency: string } | null;
  /** Per-turn token breakdown (present when emitted from PromptResponse.usage). */
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedReadTokens?: number | null;
  cachedWriteTokens?: number | null;
}

export interface CommandsUpdatePayload {
  commands: Array<{ name: string; description: string; hasInput: boolean }>;
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
    /** Raw input parameters sent to the tool (e.g. skill name/args) */
    rawInput?: unknown;
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

  // Cancel
  cancelSession(sessionId: string): Promise<void>;

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
