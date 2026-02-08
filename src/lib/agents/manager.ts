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
import { recordRecentDirectory } from "./recent-dirs.js";
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

const HOME_DIR = process.env.HOME ?? "";

/**
 * Collapse absolute home-prefixed paths back to ~ for display.
 */
function collapsePath(cwd: string): string {
  if (HOME_DIR && (cwd === HOME_DIR || cwd.startsWith(`${HOME_DIR}/`))) {
    return `~${cwd.slice(HOME_DIR.length)}`;
  }
  return cwd;
}

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
  availableModes?: Array<{ id: string; name: string; description?: string }>;
  currentModeId?: string;
}

/**
 * A message waiting in the per-session queue
 */
interface QueuedMessage {
  id: string;
  message: string;
  contentBlocks?: Array<{ type: "image"; data: string; mimeType: string }>;
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
  private messageQueues: Map<string, QueuedMessage[]> = new Map();
  private processingSession: Set<string> = new Set();

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
      recordRecentDirectory(collapsePath(options.cwd));
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
      availableModes: acpSession.availableModes,
      currentModeId: acpSession.currentModeId,
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
      // Check if client is still active
      const client = this.clients.get(managed.clientId);
      const isActive = client?.acpClient.isRunning() ?? false;
      return {
        ...this.toAgentSession(managed),
        isActive,
      };
    }

    // Try loading from disk - these are always inactive (no client)
    const stored = store.loadSession(sessionId);
    if (stored) {
      return {
        id: stored.id,
        clientId: stored.clientId,
        agentType: stored.agentType,
        cwd: collapsePath(stored.cwd ?? "unknown"),
        name: stored.name,
        status: stored.status,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
        availableModes: stored.availableModes,
        currentModeId: stored.currentModeId,
        isActive: false,
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
          cwd: collapsePath(s.cwd ?? "unknown"),
          name: s.name,
          status: s.status,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          availableModes: s.availableModes,
          currentModeId: s.currentModeId,
          isActive: false, // Stored sessions without in-memory counterpart are inactive
        })),
    ];

    const filtered = clientId
      ? allSessions.filter((s) => s.clientId === clientId)
      : allSessions;

    // Sort by createdAt descending (newest first)
    return filtered.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
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

  /**
   * Reconnect a disconnected session
   * Spawns a new client and loads the existing session
   */
  async reconnectSession(sessionId: string): Promise<AgentSession> {
    // Get session from disk
    const stored = store.loadSession(sessionId);
    if (!stored) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Spawn new client
    const client = await this.spawnClient({
      agentType: stored.agentType,
      cwd: stored.cwd ?? process.cwd(),
    });

    // Check if agent supports loadSession
    const managed = this.clients.get(client.id);
    if (!managed) {
      throw new Error("Failed to get managed client");
    }

    const supportsLoad = managed.acpClient.supportsLoadSession();

    if (supportsLoad) {
      // Load existing session
      const sessionCwd = stored.cwd ?? process.cwd();
      console.log(
        `[reconnectSession] Loading session ${sessionId} with loadSession, cwd: ${sessionCwd}`,
      );
      try {
        await managed.acpClient.loadSession(sessionId, sessionCwd);
      } catch (error) {
        console.error(`[reconnectSession] loadSession failed:`, error);
        // Fall back to creating new session
        console.log(`[reconnectSession] Falling back to new session`);
        const newSession = await managed.acpClient.createSession(
          stored.cwd ?? process.cwd(),
        );

        // Update stored session to point to new client
        const session: ManagedSession = {
          id: newSession.id,
          clientId: client.id,
          agentType: stored.agentType,
          status: "idle",
          cwd: stored.cwd ?? process.cwd(),
          name: stored.name,
          createdAt: new Date(stored.createdAt),
          updatedAt: new Date(),
          availableModes: newSession.availableModes,
          currentModeId: newSession.currentModeId,
        };

        this.sessions.set(session.id, session);
        this.sessionToClient.set(session.id, client.id);

        return this.toAgentSession(session);
      }
    } else {
      console.log(
        `[reconnectSession] Agent doesn't support loadSession, creating new session`,
      );
    }

    // Get the loaded session from ACP client (has modes info)
    const acpSession = managed.acpClient.getSession(sessionId);

    // Create managed session pointing to new client
    const session: ManagedSession = {
      id: sessionId,
      clientId: client.id,
      agentType: stored.agentType,
      status: "idle",
      cwd: stored.cwd ?? process.cwd(),
      name: stored.name,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(),
      availableModes: acpSession?.availableModes,
      currentModeId: acpSession?.currentModeId,
    };

    this.sessions.set(sessionId, session);
    this.sessionToClient.set(sessionId, client.id);

    // Load events from disk into memory
    const storedEvents = store.loadSessionEvents(sessionId);
    const events = storedEvents.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    })) as AgentEvent[];
    this.sessionEvents.set(sessionId, events);

    return {
      ...this.toAgentSession(session),
      isActive: true,
    };
  }

  // -------------------------------------------------------------------------
  // Kill / Cleanup
  // -------------------------------------------------------------------------

  /**
   * Delete a session from disk (permanent)
   */
  deleteSession(sessionId: string): void {
    // Remove from memory if exists
    this.sessions.delete(sessionId);
    this.sessionToClient.delete(sessionId);
    this.sessionEvents.delete(sessionId);

    // Delete from disk
    store.deleteSession(sessionId);
  }

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

    // Drain any queued messages before cleanup
    this.drainQueue(sessionId, "Session killed");
    this.messageQueues.delete(sessionId);

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
   * Mark a session as completed (soft close — client stays alive)
   */
  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      store.updateSessionStatus(sessionId, "completed");
      return;
    }

    // Drop any queued messages — user said "done"
    this.drainQueue(sessionId, "Session completed");
    this.messageQueues.delete(sessionId);

    session.status = "completed";
    session.updatedAt = new Date();

    this.emitEvent({
      type: "complete",
      clientId: session.clientId,
      sessionId,
      timestamp: new Date(),
      payload: { stopReason: "user_completed" },
    });

    // Remove from in-memory tracking (keep on disk for history)
    this.sessions.delete(sessionId);
    this.sessionToClient.delete(sessionId);
    this.sessionEvents.delete(sessionId);

    store.updateSessionStatus(sessionId, "completed");

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
        this.drainQueue(sessionId, "Client killed");
        this.messageQueues.delete(sessionId);
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

  /**
   * Enqueue a message and return immediately.
   * The user message event is emitted right away so it appears in the chat log.
   * Actual processing happens in the background via processQueue().
   */
  sendMessage(
    sessionId: string,
    message: string,
    contentBlocks?: Array<{ type: "image"; data: string; mimeType: string }>,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const managed = this.clients.get(session.clientId);
    if (!managed) {
      throw new Error(`Client not found: ${session.clientId}`);
    }

    // Emit user message event immediately so it shows in the chat log
    const eventPayload: Record<string, unknown> = {
      content: message,
      isUser: true,
    };
    if (contentBlocks && contentBlocks.length > 0) {
      eventPayload.images = contentBlocks.map((b) => ({
        mimeType: b.mimeType,
        dataUrl: `data:${b.mimeType};base64,${b.data}`,
      }));
    }

    this.emitEvent({
      type: "message",
      clientId: session.clientId,
      sessionId,
      timestamp: new Date(),
      payload: eventPayload,
    });

    // Enqueue for background processing
    const queue = this.messageQueues.get(sessionId) ?? [];
    queue.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      contentBlocks,
    });
    this.messageQueues.set(sessionId, queue);

    // Kick off processing (no-op if already running for this session)
    this.processQueue(sessionId);
  }

  /**
   * Process queued messages one at a time for a session.
   * Only one prompt() runs at a time per session (ACP protocol constraint).
   */
  private async processQueue(sessionId: string): Promise<void> {
    if (this.processingSession.has(sessionId)) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const managed = this.clients.get(session.clientId);
    if (!managed) return;

    this.processingSession.add(sessionId);

    try {
      while (true) {
        const queue = this.messageQueues.get(sessionId);
        if (!queue || queue.length === 0) break;

        const current = this.sessions.get(sessionId);
        if (
          !current ||
          current.status === "killed" ||
          current.status === "completed" ||
          current.status === "error"
        ) {
          this.drainQueue(sessionId, "Session is no longer active");
          break;
        }

        const next = queue.shift()!;

        current.status = "running";
        current.updatedAt = new Date();

        try {
          const acpContent: Array<
            | { type: "text"; text: string }
            | { type: "image"; data: string; mimeType: string }
          > = [];

          if (next.contentBlocks) {
            for (const block of next.contentBlocks) {
              acpContent.push({
                type: "image",
                data: block.data,
                mimeType: block.mimeType,
              });
            }
          }
          if (next.message) {
            acpContent.push({ type: "text", text: next.message });
          }

          const result = await managed.acpClient.prompt(sessionId, acpContent);

          current.status = "idle";
          current.updatedAt = new Date();

          this.emitEvent({
            type: "complete",
            clientId: current.clientId,
            sessionId,
            timestamp: new Date(),
            payload: { stopReason: result.stopReason },
          });
        } catch (error) {
          current.status = "error";
          current.updatedAt = new Date();

          this.emitEvent({
            type: "error",
            clientId: current.clientId,
            sessionId,
            timestamp: new Date(),
            payload: { message: (error as Error).message },
          });

          this.drainQueue(sessionId, (error as Error).message);
          break;
        }
      }
    } finally {
      this.processingSession.delete(sessionId);
    }
  }

  /**
   * Clear all queued messages for a session and emit a notification.
   */
  private drainQueue(sessionId: string, reason: string): void {
    const queue = this.messageQueues.get(sessionId);
    if (queue && queue.length > 0) {
      const count = queue.length;
      queue.length = 0;

      const session = this.sessions.get(sessionId);
      if (session) {
        this.emitEvent({
          type: "error",
          clientId: session.clientId,
          sessionId,
          timestamp: new Date(),
          payload: {
            message: `${count} queued message(s) dropped: ${reason}`,
          },
        });
      }
    }
  }

  /**
   * Set session mode (e.g., "ask", "code", "architect")
   */
  async setMode(sessionId: string, modeId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const managed = this.clients.get(session.clientId);
    if (!managed) {
      throw new Error(`Client not found: ${session.clientId}`);
    }

    await managed.acpClient.setMode(sessionId, modeId);

    // Update local session state
    session.currentModeId = modeId;
    session.updatedAt = new Date();

    // Persist to disk
    store.updateSessionMode(sessionId, modeId);
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
      // Always merge - memory events are stored as fragments
      return this.mergeConsecutiveEvents(memEvents);
    }

    // Load from disk and merge consecutive message/thinking chunks
    const storedEvents = store.loadSessionEvents(sessionId);
    if (storedEvents.length > 0) {
      const events = storedEvents.map((e) => ({
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
    this.messageQueues.clear();
    this.processingSession.clear();
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

    // Terminal lifecycle events (surface in session logs)
    acpClient.on("terminal:created", (evt) => {
      this.emitEvent({
        type: "tool-call",
        clientId,
        sessionId: evt.sessionId,
        timestamp: new Date(evt.startedAt),
        payload: {
          toolCallId: evt.terminalId,
          title: `terminal: ${evt.command}${evt.args.length ? ` ${evt.args.join(" ")}` : ""}`,
          kind: "terminal",
          status: "in_progress",
        },
      });
    });

    acpClient.on("terminal:exit", (evt) => {
      const status = evt.exitStatus.exitCode === 0 ? "completed" : "failed";
      this.emitEvent({
        type: "tool-update",
        clientId,
        sessionId: evt.sessionId,
        timestamp: new Date(evt.endedAt),
        payload: {
          toolCallId: evt.terminalId,
          status,
          content: {
            cwd: evt.cwd,
            command: evt.command,
            args: evt.args,
            exitStatus: evt.exitStatus,
            truncated: evt.truncated,
            output: evt.output,
            durationMs: evt.durationMs,
          },
        },
      });
    });

    acpClient.on("terminal:error", (evt) => {
      this.emitEvent({
        type: "tool-update",
        clientId,
        sessionId: evt.sessionId,
        timestamp: new Date(),
        payload: {
          toolCallId: evt.terminalId,
          status: "failed",
          content: {
            cwd: evt.cwd,
            command: evt.command,
            args: evt.args,
            error: evt.message,
          },
        },
      });
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

      case "agent_message_chunk": {
        const content =
          update.content.type === "text" ? update.content.text : "";

        // Intercept mode change system messages and emit as mode-change events
        if (content.startsWith("Mode changed to:")) {
          const modeId = content.replace("Mode changed to:", "").trim();
          const session = this.sessions.get(sessionId);
          if (session && modeId) {
            session.currentModeId = modeId;
            session.updatedAt = new Date();
            store.updateSessionMode(sessionId, modeId);
          }
          return {
            type: "mode-change",
            clientId,
            sessionId,
            timestamp,
            payload: { currentModeId: modeId },
          };
        }

        return {
          type: "message",
          clientId,
          sessionId,
          timestamp,
          payload: { content },
        };
      }

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
      cwd: collapsePath(managed.cwd),
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
      cwd: collapsePath(managed.cwd),
      name: managed.name,
      createdAt: managed.createdAt,
      updatedAt: managed.updatedAt,
      availableModes: managed.availableModes,
      currentModeId: managed.currentModeId,
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
        rawInput: toolCall?.rawInput,
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
