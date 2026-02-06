/**
 * Agent Manager - ACP-based Implementation
 *
 * Manages AI coding agents through the Agent Client Protocol (ACP).
 * Supports Gemini CLI, Claude Code, and Codex.
 */

import { EventEmitter } from "node:events";
import type * as acp from "@agentclientprotocol/sdk";
import {
  type AgentType as ACPAgentType,
  ACPClient,
  type PendingPermission,
} from "../acp/index.js";
import * as store from "./store.js";
import type {
  AgentClient,
  AgentEvent,
  AgentSession,
  AgentType,
  ApprovalHandler,
  ApprovalOption,
  ApprovalRequest,
  ClientStatus,
  CreateSessionOptions,
  EventHandler,
  IAgentManager,
  SessionStatus,
  SpawnClientOptions,
  UnsubscribeFn,
} from "./types.js";

/**
 * Internal client state
 */
interface ManagedClient {
  id: string;
  acpClient: ACPClient;
  agentType: AgentType;
  status: ClientStatus;
  cwd: string;
  createdAt: Date;
  capabilities?: acp.InitializeResponse;
  error?: Error;
}

/**
 * Internal session state
 */
interface ManagedSession {
  id: string;
  clientId: string;
  agentType: AgentType;
  status: SessionStatus;
  cwd: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Internal approval state
 */
interface ManagedApproval {
  id: string;
  clientId: string;
  sessionId: string;
  createdAt: Date;
  pending: PendingPermission;
  request: acp.RequestPermissionRequest;
}

/**
 * Agent Manager Implementation
 */
export class AgentManager extends EventEmitter implements IAgentManager {
  private clients: Map<string, ManagedClient> = new Map();
  private sessions: Map<string, ManagedSession> = new Map();
  private approvals: Map<string, ManagedApproval> = new Map();
  private sessionToClient: Map<string, string> = new Map();
  private sessionEvents: Map<string, AgentEvent[]> = new Map();

  // -------------------------------------------------------------------------
  // Client Lifecycle
  // -------------------------------------------------------------------------

  async spawnClient(options: SpawnClientOptions): Promise<AgentClient> {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const acpClient = new ACPClient(
      {
        type: options.agentType as ACPAgentType,
        env: options.env,
      },
      options.cwd,
    );

    const managed: ManagedClient = {
      id: clientId,
      acpClient,
      agentType: options.agentType,
      status: "starting",
      cwd: options.cwd,
      createdAt: new Date(),
    };

    this.clients.set(clientId, managed);
    this.setupClientListeners(clientId, acpClient);

    try {
      const capabilities = await acpClient.start();
      managed.status = "ready";
      managed.capabilities = capabilities;
    } catch (error) {
      managed.status = "error";
      managed.error = error as Error;
      throw error;
    }

    return this.toAgentClient(managed);
  }

  async stopClient(clientId: string): Promise<void> {
    const managed = this.clients.get(clientId);
    if (!managed) return;

    managed.acpClient.stop();
    managed.status = "stopped";

    // Clean up sessions for this client
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.clientId === clientId) {
        this.sessions.delete(sessionId);
        this.sessionToClient.delete(sessionId);
      }
    }

    // Clean up approvals for this client
    for (const [approvalId, approval] of this.approvals.entries()) {
      if (approval.clientId === clientId) {
        this.approvals.delete(approvalId);
      }
    }

    this.clients.delete(clientId);
  }

  getClient(clientId: string): AgentClient | undefined {
    const managed = this.clients.get(clientId);
    return managed ? this.toAgentClient(managed) : undefined;
  }

  listClients(): AgentClient[] {
    return Array.from(this.clients.values()).map((m) => this.toAgentClient(m));
  }

  /**
   * Check if a client's ACP process is still running
   */
  isClientAlive(clientId: string): boolean {
    const managed = this.clients.get(clientId);
    if (!managed) return false;
    return managed.acpClient.isRunning();
  }

  /**
   * Clean up stale sessions that have no active client
   * Returns the number of sessions cleaned
   */
  cleanupStaleSessions(): number {
    const activeClientIds = new Set(
      Array.from(this.clients.values())
        .filter((c) => c.acpClient.isRunning())
        .map((c) => c.id),
    );

    let cleaned = 0;

    // Clean up in-memory sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!activeClientIds.has(session.clientId)) {
        session.status = "error";
        this.sessions.delete(sessionId);
        this.sessionToClient.delete(sessionId);
        this.sessionEvents.delete(sessionId);
        // Update on disk
        store.updateSessionStatus(sessionId, "error");
        cleaned++;
      }
    }

    // Clean up dead clients
    for (const [clientId, managed] of this.clients.entries()) {
      if (!managed.acpClient.isRunning()) {
        this.clients.delete(clientId);
      }
    }

    return cleaned;
  }

  // -------------------------------------------------------------------------
  // Session Lifecycle
  // -------------------------------------------------------------------------

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const managed = this.clients.get(options.clientId);
    if (!managed) {
      throw new Error(`Client not found: ${options.clientId}`);
    }

    if (managed.status !== "ready") {
      throw new Error(`Client not ready: ${managed.status}`);
    }

    // Expand ~ to home directory
    let cwd = options.cwd ?? managed.cwd;
    if (cwd.startsWith("~")) {
      cwd = cwd.replace("~", process.env.HOME ?? "");
    }

    const acpSession = await managed.acpClient.createSession(cwd);

    const session: ManagedSession = {
      id: acpSession.id,
      clientId: options.clientId,
      agentType: managed.agentType,
      status: "idle",
      cwd,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.sessionToClient.set(session.id, options.clientId);

    // Persist to disk
    store.saveSession(session, []);

    return this.toAgentSession(session);
  }

  getSession(sessionId: string): AgentSession | undefined {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      return this.toAgentSession(managed);
    }

    // Try loading from disk
    const stored = store.loadSession(sessionId);
    if (stored) {
      return {
        id: stored.id,
        clientId: stored.clientId,
        agentType: stored.agentType,
        cwd: stored.cwd ?? "unknown",
        name: stored.name,
        status: stored.status,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
      };
    }

    return undefined;
  }

  listSessions(clientId?: string): AgentSession[] {
    // Get active client IDs
    const activeClientIds = new Set(
      Array.from(this.clients.values())
        .filter((c) => c.acpClient.isRunning())
        .map((c) => c.id),
    );

    // Combine in-memory and stored sessions
    const memSessions = Array.from(this.sessions.values());
    const storedSessions = store.loadAllSessions();

    // Merge: prefer in-memory sessions
    const memIds = new Set(memSessions.map((s) => s.id));
    const allSessions: AgentSession[] = [
      ...memSessions.map((s) => ({
        ...this.toAgentSession(s),
        isActive: activeClientIds.has(s.clientId),
      })),
      ...storedSessions
        .filter((s) => !memIds.has(s.id))
        .map((s) => ({
          id: s.id,
          clientId: s.clientId,
          agentType: s.agentType,
          cwd: s.cwd ?? "unknown",
          name: s.name,
          status: s.status,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          isActive: false, // Stored sessions without in-memory counterpart are inactive
        })),
    ];

    const filtered = clientId
      ? allSessions.filter((s) => s.clientId === clientId)
      : allSessions;
    return filtered;
  }

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  /**
   * Rename a session
   */
  renameSession(sessionId: string, name: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.name = name;
      session.updatedAt = new Date();
    }
    // Always update on disk
    store.updateSessionName(sessionId, name);
  }

  // -------------------------------------------------------------------------
  // Kill / Cleanup
  // -------------------------------------------------------------------------

  /**
   * Kill a specific session
   */
  killSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Try to update on disk anyway
      store.updateSessionStatus(sessionId, "killed");
      return;
    }

    session.status = "killed";
    session.updatedAt = new Date();

    this.emitEvent({
      type: "complete",
      clientId: session.clientId,
      sessionId,
      timestamp: new Date(),
      payload: { stopReason: "killed" },
    });

    // Remove from tracking
    this.sessions.delete(sessionId);
    this.sessionToClient.delete(sessionId);
    this.sessionEvents.delete(sessionId);

    // Update on disk (keep for history)
    store.updateSessionStatus(sessionId, "killed");

    // Remove related approvals
    for (const [approvalId, approval] of this.approvals) {
      if (approval.sessionId === sessionId) {
        this.approvals.delete(approvalId);
      }
    }
  }

  /**
   * Kill an entire client (and all its sessions)
   */
  killClient(clientId: string): void {
    const managed = this.clients.get(clientId);
    if (!managed) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Kill all sessions for this client
    for (const [sessionId, session] of this.sessions) {
      if (session.clientId === clientId) {
        session.status = "killed";
        this.sessions.delete(sessionId);
        this.sessionToClient.delete(sessionId);
        this.sessionEvents.delete(sessionId);
      }
    }

    // Remove related approvals
    for (const [approvalId, approval] of this.approvals) {
      if (approval.clientId === clientId) {
        this.approvals.delete(approvalId);
      }
    }

    // Stop the ACP process
    managed.acpClient.stop();
    managed.status = "stopped";

    // Remove from tracking
    this.clients.delete(clientId);
  }

  // -------------------------------------------------------------------------
  // Communication
  // -------------------------------------------------------------------------

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const managed = this.clients.get(session.clientId);
    if (!managed) {
      throw new Error(`Client not found: ${session.clientId}`);
    }

    session.status = "running";
    session.updatedAt = new Date();

    this.emitEvent({
      type: "message",
      clientId: session.clientId,
      sessionId,
      timestamp: new Date(),
      payload: { content: message, isUser: true },
    });

    try {
      const result = await managed.acpClient.sendMessage(sessionId, message);

      session.status = "idle";
      session.updatedAt = new Date();

      this.emitEvent({
        type: "complete",
        clientId: session.clientId,
        sessionId,
        timestamp: new Date(),
        payload: { stopReason: result.stopReason },
      });
    } catch (error) {
      session.status = "error";
      session.updatedAt = new Date();
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Approvals
  // -------------------------------------------------------------------------

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.approvals.values()).map((a) =>
      this.toApprovalRequest(a),
    );
  }

  async approveRequest(approvalId: string, optionId: string): Promise<void> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    approval.pending.resolve({
      outcome: { outcome: "selected", optionId },
    });

    this.approvals.delete(approvalId);

    // Update session status
    const session = this.sessions.get(approval.sessionId);
    if (session && session.status === "waiting-approval") {
      session.status = "running";
      session.updatedAt = new Date();
    }
  }

  async denyRequest(approvalId: string): Promise<void> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    approval.pending.resolve({
      outcome: { outcome: "cancelled" },
    });

    this.approvals.delete(approvalId);

    // Update session status
    const session = this.sessions.get(approval.sessionId);
    if (session && session.status === "waiting-approval") {
      session.status = "running";
      session.updatedAt = new Date();
    }
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  /**
   * Get event history for a session
   */
  getSessionEvents(sessionId: string): AgentEvent[] {
    // Try in-memory first
    const memEvents = this.sessionEvents.get(sessionId);
    if (memEvents && memEvents.length > 0) {
      return memEvents;
    }

    // Load from disk and merge consecutive message/thinking chunks
    const stored = store.loadSession(sessionId);
    if (stored) {
      const events = stored.events.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })) as AgentEvent[];

      return this.mergeConsecutiveEvents(events);
    }

    return [];
  }

  /**
   * Merge consecutive message/thinking events with same sender
   */
  private mergeConsecutiveEvents(events: AgentEvent[]): AgentEvent[] {
    const merged: AgentEvent[] = [];

    for (const event of events) {
      const last = merged[merged.length - 1];

      if (last) {
        const lastPayload = last.payload as Record<string, unknown>;
        const newPayload = event.payload as Record<string, unknown>;
        const lastIsUser = lastPayload.isUser === true;
        const newIsUser = newPayload.isUser === true;

        const canMerge =
          last.type === event.type &&
          (event.type === "message" || event.type === "thinking") &&
          last.sessionId === event.sessionId &&
          lastIsUser === newIsUser;

        if (canMerge) {
          // Extract content
          const getContent = (p: Record<string, unknown>): string => {
            if (typeof p.content === "string") return p.content;
            if (typeof p.content === "object" && p.content !== null) {
              const nested = p.content as Record<string, unknown>;
              return (nested.text as string) ?? "";
            }
            return "";
          };

          const lastContent = getContent(lastPayload);
          const newContent = getContent(newPayload);

          // Update last event with merged content
          last.payload = { ...lastPayload, content: lastContent + newContent };
          last.timestamp = event.timestamp;
          continue;
        }
      }

      merged.push({ ...event });
    }

    return merged;
  }

  onEvent(handler: EventHandler): UnsubscribeFn {
    this.on("event", handler);
    return () => this.off("event", handler);
  }

  onApproval(handler: ApprovalHandler): UnsubscribeFn {
    this.on("approval", handler);
    return () => this.off("approval", handler);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  async dispose(): Promise<void> {
    for (const managed of this.clients.values()) {
      managed.acpClient.stop();
    }
    this.clients.clear();
    this.sessions.clear();
    this.approvals.clear();
    this.sessionToClient.clear();
    this.removeAllListeners();
  }

  // -------------------------------------------------------------------------
  // Private: Event Handling
  // -------------------------------------------------------------------------

  private setupClientListeners(clientId: string, acpClient: ACPClient): void {
    // Handle session updates (streaming)
    acpClient.on("session:update", (sessionId, notification) => {
      const event = this.normalizeSessionUpdate(
        clientId,
        sessionId,
        notification,
      );
      if (event) {
        this.emitEvent(event);
      }
    });

    // Handle permission requests
    acpClient.on("permission:request", (pending) => {
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const approval: ManagedApproval = {
        id: approvalId,
        clientId,
        sessionId: pending.sessionId,
        createdAt: new Date(),
        pending,
        request: pending.request,
      };

      this.approvals.set(approvalId, approval);

      // Update session status
      const session = this.sessions.get(pending.sessionId);
      if (session) {
        session.status = "waiting-approval";
        session.updatedAt = new Date();
      }

      this.emit("approval", this.toApprovalRequest(approval));
    });

    // Handle errors
    acpClient.on("agent:error", (error) => {
      const managed = this.clients.get(clientId);
      if (managed) {
        managed.status = "error";
        managed.error = error;
      }
    });

    // Handle exit
    acpClient.on("agent:exit", () => {
      const managed = this.clients.get(clientId);
      if (managed) {
        managed.status = "stopped";
      }
    });
  }

  private normalizeSessionUpdate(
    clientId: string,
    sessionId: string,
    notification: acp.SessionNotification,
  ): AgentEvent | null {
    const update = notification.update;
    const timestamp = new Date();

    switch (update.sessionUpdate) {
      case "agent_thought_chunk":
        return {
          type: "thinking",
          clientId,
          sessionId,
          timestamp,
          payload: {
            content: update.content.type === "text" ? update.content.text : "",
          },
        };

      case "agent_message_chunk":
        return {
          type: "message",
          clientId,
          sessionId,
          timestamp,
          payload: {
            content: update.content.type === "text" ? update.content.text : "",
          },
        };

      case "tool_call":
        return {
          type: "tool-call",
          clientId,
          sessionId,
          timestamp,
          payload: {
            toolCallId: update.toolCallId,
            title: update.title,
            kind: update.kind,
            status: update.status,
          },
        };

      case "tool_call_update":
        return {
          type: "tool-update",
          clientId,
          sessionId,
          timestamp,
          payload: {
            toolCallId: update.toolCallId,
            status: update.status,
            content: update.content,
          },
        };

      case "plan":
        return {
          type: "plan",
          clientId,
          sessionId,
          timestamp,
          payload: { entries: update.entries },
        };

      default:
        return null;
    }
  }

  private emitEvent(event: AgentEvent): void {
    // Store event in history
    const events = this.sessionEvents.get(event.sessionId) ?? [];
    events.push(event);
    this.sessionEvents.set(event.sessionId, events);

    // Persist to disk
    store.appendSessionEvent(event.sessionId, event);

    // Emit to listeners
    this.emit("event", event);
  }

  // -------------------------------------------------------------------------
  // Private: Type Conversions
  // -------------------------------------------------------------------------

  private toAgentClient(managed: ManagedClient): AgentClient {
    return {
      id: managed.id,
      agentType: managed.agentType,
      status: managed.status,
      cwd: managed.cwd,
      createdAt: managed.createdAt,
      capabilities: managed.capabilities
        ? {
            loadSession:
              managed.capabilities.agentCapabilities?.loadSession ?? false,
            promptCapabilities: {
              image:
                managed.capabilities.agentCapabilities?.promptCapabilities
                  ?.image ?? false,
              audio:
                managed.capabilities.agentCapabilities?.promptCapabilities
                  ?.audio ?? false,
              embeddedContext:
                managed.capabilities.agentCapabilities?.promptCapabilities
                  ?.embeddedContext ?? false,
            },
            mcpCapabilities: {
              http:
                managed.capabilities.agentCapabilities?.mcpCapabilities?.http ??
                false,
              sse:
                managed.capabilities.agentCapabilities?.mcpCapabilities?.sse ??
                false,
            },
          }
        : undefined,
      error: managed.error?.message,
    };
  }

  private toAgentSession(managed: ManagedSession): AgentSession {
    return {
      id: managed.id,
      clientId: managed.clientId,
      agentType: managed.agentType,
      status: managed.status,
      cwd: managed.cwd,
      name: managed.name,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
    };
  }

  private toApprovalRequest(managed: ManagedApproval): ApprovalRequest {
    const toolCall = managed.request.toolCall;
    const options: ApprovalOption[] = (managed.request.options ?? []).map(
      (opt) => ({
        optionId: opt.optionId,
        name: opt.name,
        kind: opt.kind,
        description: (opt as { description?: string }).description,
      }),
    );

    return {
      id: managed.id,
      clientId: managed.clientId,
      sessionId: managed.sessionId,
      status: "pending",
      createdAt: managed.createdAt,
      toolCall: {
        toolCallId: toolCall?.toolCallId ?? "",
        title: toolCall?.title ?? "Unknown",
        kind: toolCall?.kind ?? "unknown",
      },
      options,
    };
  }
}

// Singleton instance
let managerInstance: AgentManager | null = null;

/**
 * Get the global AgentManager instance
 */
export function getAgentManager(): AgentManager {
  if (!managerInstance) {
    managerInstance = new AgentManager();
  }
  return managerInstance;
}
