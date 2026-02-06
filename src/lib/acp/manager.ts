/**
 * ACP Client Manager
 *
 * Manages multiple ACP clients and their sessions
 */

import { EventEmitter } from "node:events";
import type * as acp from "@agentclientprotocol/sdk";
import {
	ACPClient,
	type AgentConfig,
	type AgentType,
	type PendingPermission,
	type Session,
} from "./client.js";

/**
 * Managed client info
 */
export interface ManagedClient {
	id: string;
	client: ACPClient;
	agentType: AgentType;
	status: "starting" | "ready" | "error" | "stopped";
	capabilities: acp.InitializeResponse | null;
	error?: Error;
}

/**
 * Session with client reference
 */
export interface ManagedSession extends Session {
	clientId: string;
}

/**
 * Permission with client reference
 */
export interface ManagedPermission extends PendingPermission {
	clientId: string;
	id: string;
}

/**
 * Events emitted by ACPManager
 */
export interface ACPManagerEvents {
	"client:added": (client: ManagedClient) => void;
	"client:ready": (
		clientId: string,
		capabilities: acp.InitializeResponse,
	) => void;
	"client:error": (clientId: string, error: Error) => void;
	"client:removed": (clientId: string) => void;
	"session:created": (session: ManagedSession) => void;
	"session:update": (
		clientId: string,
		sessionId: string,
		update: acp.SessionNotification,
	) => void;
	"permission:request": (permission: ManagedPermission) => void;
}

/**
 * ACP Manager - manages multiple ACP clients
 */
export class ACPManager extends EventEmitter {
	private clients: Map<string, ManagedClient> = new Map();
	private sessionToClient: Map<string, string> = new Map();
	private permissionToClient: Map<string, string> = new Map();

	/**
	 * Add and start a new ACP client
	 */
	async addClient(
		agentType: AgentType,
		cwd: string,
		options?: Partial<AgentConfig>,
	): Promise<ManagedClient> {
		const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;

		const client = new ACPClient({ type: agentType, ...options }, cwd);

		const managed: ManagedClient = {
			id: clientId,
			client,
			agentType,
			status: "starting",
			capabilities: null,
		};

		this.clients.set(clientId, managed);

		// Set up event forwarding
		client.on("agent:ready", (capabilities) => {
			managed.status = "ready";
			managed.capabilities = capabilities;
			this.emit("client:ready", clientId, capabilities);
		});

		client.on("agent:error", (error) => {
			managed.status = "error";
			managed.error = error;
			this.emit("client:error", clientId, error);
		});

		client.on("agent:exit", () => {
			managed.status = "stopped";
		});

		client.on("session:update", (sessionId, update) => {
			this.emit("session:update", clientId, sessionId, update);
		});

		client.on("permission:request", (permission) => {
			const permId = `perm_${clientId}_${Date.now()}`;
			this.permissionToClient.set(permId, clientId);
			this.emit("permission:request", {
				...permission,
				clientId,
				id: permId,
			});
		});

		this.emit("client:added", managed);

		// Start the client
		try {
			await client.start();
		} catch (error) {
			managed.status = "error";
			managed.error = error as Error;
			this.emit("client:error", clientId, error as Error);
		}

		return managed;
	}

	/**
	 * Remove a client
	 */
	removeClient(clientId: string): void {
		const managed = this.clients.get(clientId);
		if (!managed) return;

		managed.client.stop();
		this.clients.delete(clientId);

		// Clean up session mappings
		for (const [sessionId, cId] of this.sessionToClient.entries()) {
			if (cId === clientId) {
				this.sessionToClient.delete(sessionId);
			}
		}

		this.emit("client:removed", clientId);
	}

	/**
	 * Get a client by ID
	 */
	getClient(clientId: string): ManagedClient | undefined {
		return this.clients.get(clientId);
	}

	/**
	 * Get all clients
	 */
	getClients(): ManagedClient[] {
		return Array.from(this.clients.values());
	}

	/**
	 * Create a session on a client
	 */
	async createSession(
		clientId: string,
		cwd: string,
		mcpServers: acp.McpServer[] = [],
	): Promise<ManagedSession> {
		const managed = this.clients.get(clientId);
		if (!managed) {
			throw new Error(`Client not found: ${clientId}`);
		}

		const session = await managed.client.createSession(cwd, mcpServers);
		this.sessionToClient.set(session.id, clientId);

		const managedSession: ManagedSession = {
			...session,
			clientId,
		};

		this.emit("session:created", managedSession);
		return managedSession;
	}

	/**
	 * Send a message to a session
	 */
	async sendMessage(
		sessionId: string,
		text: string,
	): Promise<acp.PromptResponse> {
		const clientId = this.sessionToClient.get(sessionId);
		if (!clientId) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		const managed = this.clients.get(clientId);
		if (!managed) {
			throw new Error(`Client not found: ${clientId}`);
		}

		return managed.client.sendMessage(sessionId, text);
	}

	/**
	 * Get all sessions across all clients
	 */
	getSessions(): ManagedSession[] {
		const sessions: ManagedSession[] = [];

		for (const [clientId, managed] of this.clients.entries()) {
			for (const session of managed.client.getSessions()) {
				sessions.push({ ...session, clientId });
			}
		}

		return sessions;
	}

	/**
	 * Get all pending permissions across all clients
	 */
	getPendingPermissions(): ManagedPermission[] {
		const permissions: ManagedPermission[] = [];

		for (const [clientId, managed] of this.clients.entries()) {
			for (const permission of managed.client.getPendingPermissions()) {
				const id = `perm_${clientId}_${permission.request.toolCall?.toolCallId ?? Date.now()}`;
				permissions.push({ ...permission, clientId, id });
			}
		}

		return permissions;
	}

	/**
	 * Respond to a permission request
	 */
	respondToPermission(permissionId: string, optionId: string): void {
		// Find which client this permission belongs to
		for (const managed of this.clients.values()) {
			try {
				managed.client.respondToPermission(permissionId, optionId);
				return;
			} catch {
				// Not this client, continue
			}
		}

		throw new Error(`Permission not found: ${permissionId}`);
	}

	/**
	 * Deny a permission request
	 */
	denyPermission(permissionId: string): void {
		for (const managed of this.clients.values()) {
			try {
				managed.client.denyPermission(permissionId);
				return;
			} catch {
				// Not this client, continue
			}
		}

		throw new Error(`Permission not found: ${permissionId}`);
	}

	/**
	 * Stop all clients
	 */
	stopAll(): void {
		for (const managed of this.clients.values()) {
			managed.client.stop();
		}
		this.clients.clear();
		this.sessionToClient.clear();
		this.permissionToClient.clear();
	}
}

// Singleton instance
let managerInstance: ACPManager | null = null;

/**
 * Get the global ACPManager instance
 */
export function getACPManager(): ACPManager {
	if (!managerInstance) {
		managerInstance = new ACPManager();
	}
	return managerInstance;
}
