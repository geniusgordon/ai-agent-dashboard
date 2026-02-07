/**
 * ACP (Agent Client Protocol) Client Implementation
 *
 * This module implements an ACP Client that can communicate with any
 * ACP-compatible agent (Gemini CLI, claude-code-acp, codex-acp, etc.)
 *
 * @see https://agentclientprotocol.com
 */

import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

// Re-export useful types from the SDK
export type {
  ContentBlock,
  InitializeResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";

/**
 * Supported agent types
 */
export type AgentType = "gemini" | "claude-code" | "codex";

/**
 * Agent configuration
 */
export interface AgentConfig {
  type: AgentType;
  command?: string; // Override default command
  args?: string[]; // Additional args
  env?: Record<string, string>; // Environment variables
}

/**
 * Default agent commands
 */
const DEFAULT_COMMANDS: Record<AgentType, { command: string; args: string[] }> =
  {
    gemini: {
      command: "gemini",
      args: ["--experimental-acp"],
    },
    "claude-code": {
      command: "npx",
      args: ["@zed-industries/claude-code-acp"],
    },
    codex: {
      command: "npx",
      args: ["@zed-industries/codex-acp"],
    },
  };

/**
 * Session mode info
 */
export interface SessionMode {
  id: string;
  name: string;
  description?: string;
}

/**
 * Session state
 */
export interface Session {
  id: string;
  agentType: AgentType;
  cwd: string;
  createdAt: Date;
  availableModes?: SessionMode[];
  currentModeId?: string;
}

/**
 * Permission request with callback
 */
export interface PendingPermission {
  sessionId: string;
  request: acp.RequestPermissionRequest;
  resolve: (response: acp.RequestPermissionResponse) => void;
}

/**
 * Events emitted by ACPClient
 */
export interface ACPClientEvents {
  "session:update": (
    sessionId: string,
    update: acp.SessionNotification,
  ) => void;
  "permission:request": (permission: PendingPermission) => void;
  "agent:ready": (capabilities: acp.InitializeResponse) => void;
  "agent:error": (error: Error) => void;
  "agent:exit": (code: number | null) => void;
}

/**
 * ACP Client - manages connection to an ACP agent
 */
export class ACPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private sessions: Map<string, Session> = new Map();
  private pendingPermissions: Map<string, PendingPermission> = new Map();
  private agentCapabilities: acp.InitializeResponse | null = null;
  private cwd: string;

  constructor(
    private config: AgentConfig,
    cwd: string = process.cwd(),
  ) {
    super();
    // Expand ~ to home directory
    this.cwd = cwd.startsWith("~")
      ? cwd.replace("~", process.env.HOME ?? "")
      : cwd;
  }

  /**
   * Start the agent process and establish connection
   */
  async start(): Promise<acp.InitializeResponse> {
    const { command, args } =
      DEFAULT_COMMANDS[this.config.type] ?? DEFAULT_COMMANDS.gemini;

    const finalCommand = this.config.command ?? command;
    const finalArgs = [...args, ...(this.config.args ?? [])];

    // Ensure PATH includes common locations
    const homedir = process.env.HOME ?? "";
    const extraPaths = [
      `${homedir}/.local/bin`,
      `${homedir}/.npm-global/bin`,
      "/usr/local/bin",
    ].join(":");
    const enhancedPath = `${extraPaths}:${process.env.PATH ?? ""}`;

    this.process = spawn(finalCommand, finalArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.cwd,
      env: { ...process.env, PATH: enhancedPath, ...this.config.env },
    });

    // Handle stderr (for debugging)
    this.process.stderr?.on("data", (data) => {
      console.error(`[${this.config.type}]`, data.toString());
    });

    // Handle process exit
    this.process.on("exit", (code) => {
      this.emit("agent:exit", code);
    });

    this.process.on("error", (error) => {
      this.emit("agent:error", error);
    });

    // Create streams for ACP communication
    const input = Writable.toWeb(this.process.stdin!) as WritableStream;
    const output = Readable.toWeb(
      this.process.stdout!,
    ) as ReadableStream<Uint8Array>;

    // Create the ACP connection
    const stream = acp.ndJsonStream(input, output);
    this.connection = new acp.ClientSideConnection(
      () => this.createClientHandler(),
      stream,
    );

    // Initialize the connection
    const initResult = await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
      },
    });

    this.agentCapabilities = initResult;
    this.emit("agent:ready", initResult);

    return initResult;
  }

  /**
   * Create a new session
   */
  async createSession(
    cwd: string,
    mcpServers: acp.McpServer[] = [],
  ): Promise<Session> {
    if (!this.connection) {
      throw new Error("Client not started. Call start() first.");
    }

    // Expand ~ to home directory
    const expandedCwd = cwd.startsWith("~")
      ? cwd.replace("~", process.env.HOME ?? "")
      : cwd;

    console.log(`[ACPClient] Creating session with cwd: ${expandedCwd}`);
    const result = await this.connection.newSession({
      cwd: expandedCwd,
      mcpServers,
    });
    console.log(`[ACPClient] Session created: ${result.sessionId}`);
    if (result.modes) {
      console.log(`[ACPClient] Available modes:`, result.modes.availableModes);
      console.log(`[ACPClient] Current mode:`, result.modes.currentModeId);
    }

    const session: Session = {
      id: result.sessionId,
      agentType: this.config.type,
      cwd,
      createdAt: new Date(),
      availableModes: result.modes?.availableModes?.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? undefined,
      })),
      currentModeId: result.modes?.currentModeId,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Send a prompt to a session
   */
  async prompt(
    sessionId: string,
    prompt: acp.ContentBlock[],
  ): Promise<acp.PromptResponse> {
    if (!this.connection) {
      throw new Error("Client not started. Call start() first.");
    }

    return this.connection.prompt({ sessionId, prompt });
  }

  /**
   * Send a text prompt (convenience method)
   */
  async sendMessage(
    sessionId: string,
    text: string,
  ): Promise<acp.PromptResponse> {
    return this.prompt(sessionId, [{ type: "text", text }]);
  }

  /**
   * Set session mode (e.g., "ask", "code", "architect")
   */
  async setMode(sessionId: string, modeId: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Client not started. Call start() first.");
    }

    console.log(`[ACPClient] Setting mode for session ${sessionId}: ${modeId}`);
    await this.connection.setSessionMode({ sessionId, modeId });

    // Update local session state
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentModeId = modeId;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Load an existing session (reconnect)
   * Only works if agent supports loadSession capability
   */
  async loadSession(sessionId: string, cwd?: string): Promise<Session> {
    if (!this.connection) {
      throw new Error("Client not started. Call start() first.");
    }

    if (!this.agentCapabilities?.agentCapabilities?.loadSession) {
      throw new Error("Agent does not support loadSession");
    }

    const expandedCwd = (cwd ?? this.cwd).startsWith("~")
      ? (cwd ?? this.cwd).replace("~", process.env.HOME ?? "")
      : (cwd ?? this.cwd);

    console.log(`[ACPClient] Loading session: ${sessionId} with cwd: ${expandedCwd}`);
    const result = await this.connection.loadSession({ 
      sessionId,
      cwd: expandedCwd,
      mcpServers: [],
    });
    console.log(`[ACPClient] Session loaded: ${result.sessionId}`);

    const session: Session = {
      id: result.sessionId,
      agentType: this.config.type,
      cwd: "", // Will be updated from stored session
      createdAt: new Date(),
      availableModes: result.modes?.availableModes?.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? undefined,
      })),
      currentModeId: result.modes?.currentModeId,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Check if agent supports loadSession
   */
  supportsLoadSession(): boolean {
    return this.agentCapabilities?.agentCapabilities?.loadSession ?? false;
  }

  /**
   * Respond to a permission request
   */
  respondToPermission(permissionId: string, optionId: string): void {
    const pending = this.pendingPermissions.get(permissionId);
    if (!pending) {
      throw new Error(`No pending permission with id: ${permissionId}`);
    }

    pending.resolve({
      outcome: {
        outcome: "selected",
        optionId,
      },
    });

    this.pendingPermissions.delete(permissionId);
  }

  /**
   * Deny a permission request
   */
  denyPermission(permissionId: string): void {
    const pending = this.pendingPermissions.get(permissionId);
    if (!pending) {
      throw new Error(`No pending permission with id: ${permissionId}`);
    }

    pending.resolve({
      outcome: {
        outcome: "cancelled",
      },
    });

    this.pendingPermissions.delete(permissionId);
  }

  /**
   * Get all active sessions
   */
  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get pending permissions
   */
  getPendingPermissions(): PendingPermission[] {
    return Array.from(this.pendingPermissions.values());
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): acp.InitializeResponse | null {
    return this.agentCapabilities;
  }

  /**
   * Stop the agent process
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connection = null;
    this.sessions.clear();
    this.pendingPermissions.clear();
  }

  /**
   * Check if client is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Create the client handler for ACP callbacks
   */
  private createClientHandler(): acp.Client {
    return {
      requestPermission: async (
        params: acp.RequestPermissionRequest,
      ): Promise<acp.RequestPermissionResponse> => {
        return new Promise((resolve) => {
          const permissionId = `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`;

          const pending: PendingPermission = {
            sessionId: params.sessionId,
            request: params,
            resolve,
          };

          this.pendingPermissions.set(permissionId, pending);
          this.emit("permission:request", { ...pending, id: permissionId });
        });
      },

      sessionUpdate: async (params: acp.SessionNotification): Promise<void> => {
        this.emit("session:update", params.sessionId, params);
      },

      readTextFile: async (
        params: acp.ReadTextFileRequest,
      ): Promise<acp.ReadTextFileResponse> => {
        // TODO: Implement file reading through secure sandbox
        console.log("[ACPClient] readTextFile:", params.path);
        const fs = await import("node:fs/promises");
        try {
          const content = await fs.readFile(params.path, "utf-8");
          return { content };
        } catch (_error) {
          throw new Error(`Failed to read file: ${params.path}`);
        }
      },

      writeTextFile: async (
        params: acp.WriteTextFileRequest,
      ): Promise<acp.WriteTextFileResponse> => {
        // TODO: Implement file writing through secure sandbox
        console.log("[ACPClient] writeTextFile:", params.path);
        const fs = await import("node:fs/promises");
        try {
          await fs.writeFile(params.path, params.content, "utf-8");
          return {};
        } catch (_error) {
          throw new Error(`Failed to write file: ${params.path}`);
        }
      },
    };
  }
}

/**
 * Create a new ACP client for the specified agent type
 */
export function createACPClient(
  agentType: AgentType,
  cwd?: string,
  options?: Partial<AgentConfig>,
): ACPClient {
  return new ACPClient(
    {
      type: agentType,
      ...options,
    },
    cwd,
  );
}
