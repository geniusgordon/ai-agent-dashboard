/**
 * Codex Adapter
 *
 * Interfaces with Codex CLI using the app-server JSON-RPC protocol.
 *
 * Spawn: codex app-server
 * Communication: JSON-RPC over stdio
 */

import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type {
	AgentSession,
	AgentType,
	ApprovalRequest,
	ApprovalType,
	SpawnOptions,
} from "../types";
import { BaseAdapter } from "./base";

// =============================================================================
// JSON-RPC Types
// =============================================================================

interface JsonRpcRequest {
	jsonrpc?: "2.0";
	id: string | number;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc?: "2.0";
	id: string | number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
	jsonrpc?: "2.0";
	method: string;
	params?: unknown;
}

// Server request types (approval requests)
interface CommandApprovalParams {
	callId: string;
	command: string[];
	cwd: string;
	conversationId: string;
	reason?: string;
}

interface FileChangeApprovalParams {
	callId: string;
	conversationId: string;
	// Add more fields as needed
}

// =============================================================================
// Codex Adapter
// =============================================================================

interface CodexProcess {
	process: ChildProcess;
	session: AgentSession;
	pendingRequests: Map<
		string | number,
		{
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
		}
	>;
	requestId: number;
	threadId?: string;
}

export class CodexAdapter extends BaseAdapter {
	readonly type: AgentType = "codex";

	private processes: Map<string, CodexProcess> = new Map();

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	async spawn(options: SpawnOptions): Promise<AgentSession> {
		const sessionId = this.generateId();

		console.log(`[CodexAdapter] Spawning app-server for session ${sessionId}`);

		// Spawn codex app-server
		const proc = spawn("codex", ["app-server"], {
			cwd: options.cwd,
			env: { ...process.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Create session object
		const session: AgentSession = {
			id: sessionId,
			type: "codex",
			status: "starting",
			cwd: options.cwd,
			prompt: options.prompt,
			model: options.model,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const codexProcess: CodexProcess = {
			process: proc,
			session,
			pendingRequests: new Map(),
			requestId: 0,
		};

		this.sessions.set(sessionId, session);
		this.processes.set(sessionId, codexProcess);

		// Set up stdout parsing (JSON-RPC messages, one per line)
		if (proc.stdout) {
			const rl = createInterface({ input: proc.stdout });
			rl.on("line", (line) => {
				this.handleLine(sessionId, line);
			});
		}

		// Handle stderr
		proc.stderr?.on("data", (data) => {
			const text = data.toString();
			console.error(`[CodexAdapter][${sessionId}] stderr:`, text);
		});

		// Handle process exit
		proc.on("close", (code) => {
			console.log(
				`[CodexAdapter][${sessionId}] Process exited with code ${code}`,
			);

			this.updateSession(sessionId, {
				status: code === 0 ? "completed" : "error",
				error: code !== 0 ? `Process exited with code ${code}` : undefined,
			});

			this.emitEvent({
				type: "complete",
				sessionId,
				timestamp: new Date(),
				payload: { exitCode: code },
			});

			this.processes.delete(sessionId);
		});

		proc.on("error", (err) => {
			console.error(`[CodexAdapter][${sessionId}] Process error:`, err);

			this.updateSession(sessionId, {
				status: "error",
				error: err.message,
			});

			this.emitEvent({
				type: "error",
				sessionId,
				timestamp: new Date(),
				payload: { message: err.message },
			});
		});

		// Initialize the connection
		try {
			await this.initialize(sessionId);
			this.updateSession(sessionId, { status: "running" });

			// Start a thread with the initial prompt
			await this.startThread(sessionId, options.prompt);
		} catch (err) {
			const error = err instanceof Error ? err.message : "Unknown error";
			this.updateSession(sessionId, { status: "error", error });
			throw err;
		}

		return session;
	}

	async kill(sessionId: string): Promise<void> {
		const cp = this.processes.get(sessionId);
		if (!cp) {
			console.warn(`[CodexAdapter] No process found for session ${sessionId}`);
			return;
		}

		console.log(`[CodexAdapter] Killing session ${sessionId}`);
		cp.process.kill("SIGTERM");

		this.updateSession(sessionId, { status: "killed" });
		this.processes.delete(sessionId);
	}

	async sendMessage(sessionId: string, message: string): Promise<void> {
		const cp = this.processes.get(sessionId);
		if (!cp) {
			throw new Error(`No process found for session ${sessionId}`);
		}

		if (!cp.threadId) {
			throw new Error(`No active thread for session ${sessionId}`);
		}

		// Start a new turn with the message
		await this.sendRequest(sessionId, "turn/start", {
			threadId: cp.threadId,
			prompt: message,
		});
	}

	// ---------------------------------------------------------------------------
	// Approvals
	// ---------------------------------------------------------------------------

	async approve(approvalId: string): Promise<void> {
		const approval = this.approvals.get(approvalId);
		if (!approval) {
			throw new Error(`Approval ${approvalId} not found`);
		}

		const cp = this.processes.get(approval.sessionId);
		if (!cp) {
			throw new Error(`No process found for session ${approval.sessionId}`);
		}

		// Send approval response
		// The approvalId is the JSON-RPC request id
		this.sendResponse(approval.sessionId, approvalId, {
			decision: "approve",
		});

		approval.status = "approved";
		approval.resolvedAt = new Date();
		this.approvals.set(approvalId, approval);

		this.updateSession(approval.sessionId, { status: "running" });

		this.emitEvent({
			type: "approval-response",
			sessionId: approval.sessionId,
			timestamp: new Date(),
			payload: { approvalId, action: "approved" },
		});
	}

	async reject(approvalId: string, reason?: string): Promise<void> {
		const approval = this.approvals.get(approvalId);
		if (!approval) {
			throw new Error(`Approval ${approvalId} not found`);
		}

		const cp = this.processes.get(approval.sessionId);
		if (!cp) {
			throw new Error(`No process found for session ${approval.sessionId}`);
		}

		// Send rejection response
		this.sendResponse(approval.sessionId, approvalId, {
			decision: "reject",
			reason,
		});

		approval.status = "rejected";
		approval.resolvedAt = new Date();
		this.approvals.set(approvalId, approval);

		this.updateSession(approval.sessionId, { status: "running" });

		this.emitEvent({
			type: "approval-response",
			sessionId: approval.sessionId,
			timestamp: new Date(),
			payload: { approvalId, action: "rejected", reason },
		});
	}

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	async dispose(): Promise<void> {
		console.log("[CodexAdapter] Disposing all sessions...");

		const killPromises = Array.from(this.processes.keys()).map((id) =>
			this.kill(id),
		);
		await Promise.all(killPromises);

		this.sessions.clear();
		this.approvals.clear();
		this.sessionHandlers.clear();
		this.globalHandlers.clear();
	}

	// ---------------------------------------------------------------------------
	// Private: JSON-RPC Communication
	// ---------------------------------------------------------------------------

	private async initialize(sessionId: string): Promise<void> {
		await this.sendRequest(sessionId, "initialize", {
			clientInfo: {
				name: "ai-agent-dashboard",
				version: "0.1.0",
			},
		});
	}

	private async startThread(sessionId: string, prompt: string): Promise<void> {
		const result = (await this.sendRequest(sessionId, "thread/start", {
			prompt,
		})) as { threadId: string };

		const cp = this.processes.get(sessionId);
		if (cp && result?.threadId) {
			cp.threadId = result.threadId;
		}
	}

	private sendRequest(
		sessionId: string,
		method: string,
		params?: unknown,
	): Promise<unknown> {
		const cp = this.processes.get(sessionId);
		if (!cp) {
			return Promise.reject(
				new Error(`No process found for session ${sessionId}`),
			);
		}

		const id = ++cp.requestId;
		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		};

		return new Promise((resolve, reject) => {
			cp.pendingRequests.set(id, { resolve, reject });

			const line = `${JSON.stringify(request)}\n`;
			cp.process.stdin?.write(line);

			// Timeout after 30 seconds
			setTimeout(() => {
				if (cp.pendingRequests.has(id)) {
					cp.pendingRequests.delete(id);
					reject(new Error(`Request ${method} timed out`));
				}
			}, 30000);
		});
	}

	private sendResponse(
		sessionId: string,
		requestId: string | number,
		result: unknown,
	): void {
		const cp = this.processes.get(sessionId);
		if (!cp) {
			console.error(`[CodexAdapter] No process found for session ${sessionId}`);
			return;
		}

		const response: JsonRpcResponse = {
			jsonrpc: "2.0",
			id: requestId,
			result,
		};

		const line = `${JSON.stringify(response)}\n`;
		cp.process.stdin?.write(line);
	}

	// ---------------------------------------------------------------------------
	// Private: Message Handling
	// ---------------------------------------------------------------------------

	private handleLine(sessionId: string, line: string): void {
		if (!line.trim()) return;

		try {
			const message = JSON.parse(line);
			this.handleMessage(sessionId, message);
		} catch (_err) {
			console.warn(`[CodexAdapter][${sessionId}] Non-JSON line:`, line);
		}
	}

	private handleMessage(sessionId: string, message: unknown): void {
		const msg = message as Record<string, unknown>;

		// Check if it's a response to our request
		if ("id" in msg && ("result" in msg || "error" in msg)) {
			this.handleResponse(sessionId, msg as JsonRpcResponse);
			return;
		}

		// Check if it's a request from the server (approval)
		if ("id" in msg && "method" in msg) {
			this.handleServerRequest(sessionId, msg as JsonRpcRequest);
			return;
		}

		// Otherwise it's a notification
		if ("method" in msg) {
			this.handleNotification(sessionId, msg as JsonRpcNotification);
			return;
		}

		// Unknown message format
		this.emitEvent({
			type: "raw",
			sessionId,
			timestamp: new Date(),
			payload: message,
		});
	}

	private handleResponse(sessionId: string, response: JsonRpcResponse): void {
		const cp = this.processes.get(sessionId);
		if (!cp) return;

		const pending = cp.pendingRequests.get(response.id);
		if (!pending) {
			console.warn(`[CodexAdapter] No pending request for id ${response.id}`);
			return;
		}

		cp.pendingRequests.delete(response.id);

		if (response.error) {
			pending.reject(new Error(response.error.message));
		} else {
			pending.resolve(response.result);
		}
	}

	private handleServerRequest(
		sessionId: string,
		request: JsonRpcRequest,
	): void {
		const timestamp = new Date();

		switch (request.method) {
			case "item/commandExecution/requestApproval": {
				const params = request.params as CommandApprovalParams;
				this.handleCommandApproval(sessionId, request.id, params, timestamp);
				break;
			}

			case "item/fileChange/requestApproval": {
				const params = request.params as FileChangeApprovalParams;
				this.handleFileChangeApproval(sessionId, request.id, params, timestamp);
				break;
			}

			case "item/tool/requestUserInput": {
				// TODO: Handle user input requests
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: { method: request.method, params: request.params },
				});
				break;
			}

			default:
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: request,
				});
		}
	}

	private handleCommandApproval(
		sessionId: string,
		requestId: string | number,
		params: CommandApprovalParams,
		timestamp: Date,
	): void {
		const approvalId = String(requestId);

		const approval: ApprovalRequest = {
			id: approvalId,
			sessionId,
			type: "command" as ApprovalType,
			status: "pending",
			description: `Execute command: ${params.command.join(" ")}`,
			createdAt: timestamp,
			details: {
				command: params.command,
				cwd: params.cwd,
				raw: params,
			},
		};

		this.approvals.set(approvalId, approval);
		this.updateSession(sessionId, { status: "waiting-approval" });

		this.emitEvent({
			type: "approval-request",
			sessionId,
			timestamp,
			payload: approval,
		});
	}

	private handleFileChangeApproval(
		sessionId: string,
		requestId: string | number,
		params: FileChangeApprovalParams,
		timestamp: Date,
	): void {
		const approvalId = String(requestId);

		const approval: ApprovalRequest = {
			id: approvalId,
			sessionId,
			type: "file-edit" as ApprovalType,
			status: "pending",
			description: "File change requested",
			createdAt: timestamp,
			details: {
				raw: params,
			},
		};

		this.approvals.set(approvalId, approval);
		this.updateSession(sessionId, { status: "waiting-approval" });

		this.emitEvent({
			type: "approval-request",
			sessionId,
			timestamp,
			payload: approval,
		});
	}

	private handleNotification(
		sessionId: string,
		notification: JsonRpcNotification,
	): void {
		const timestamp = new Date();

		switch (notification.method) {
			case "thread/started": {
				const params = notification.params as { threadId: string };
				const cp = this.processes.get(sessionId);
				if (cp) {
					cp.threadId = params.threadId;
				}
				this.emitEvent({
					type: "init",
					sessionId,
					timestamp,
					payload: { threadId: params.threadId },
				});
				break;
			}

			case "turn/started":
				this.emitEvent({
					type: "thinking",
					sessionId,
					timestamp,
					payload: notification.params,
				});
				break;

			case "turn/completed":
				this.emitEvent({
					type: "complete",
					sessionId,
					timestamp,
					payload: notification.params,
				});
				break;

			case "error": {
				const params = notification.params as { message: string };
				this.emitEvent({
					type: "error",
					sessionId,
					timestamp,
					payload: { message: params.message },
				});
				break;
			}

			default:
				// Emit other notifications as raw events
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: notification,
				});
		}
	}
}
