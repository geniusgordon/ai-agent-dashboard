/**
 * Gemini CLI Adapter
 *
 * Interfaces with Gemini CLI using stream-json mode.
 *
 * Spawn: gemini -p "prompt" --output-format stream-json --approval-mode <mode>
 * Events are emitted as JSONL on stdout.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { AgentSession, AgentType, SpawnOptions } from "../types";
import { BaseAdapter } from "./base";

interface GeminiProcess {
	process: ChildProcess;
	session: AgentSession;
}

export class GeminiAdapter extends BaseAdapter {
	readonly type: AgentType = "gemini";

	private processes: Map<string, GeminiProcess> = new Map();

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	async spawn(options: SpawnOptions): Promise<AgentSession> {
		const sessionId = this.generateId();

		// Build command args
		const args = ["-p", options.prompt, "--output-format", "stream-json"];

		// Map permission mode to approval mode
		const approvalMode = this.mapApprovalMode(options.permissionMode);
		if (approvalMode) {
			args.push("--approval-mode", approvalMode);
		}

		// Add model if specified
		if (options.model) {
			args.push("-m", options.model);
		}

		console.log(`[GeminiAdapter] Spawning: gemini ${args.join(" ")}`);

		// Spawn the process
		const proc = spawn("gemini", args, {
			cwd: options.cwd,
			env: { ...process.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Create session object
		const session: AgentSession = {
			id: sessionId,
			type: "gemini",
			status: "starting",
			cwd: options.cwd,
			prompt: options.prompt,
			model: options.model,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		this.sessions.set(sessionId, session);
		this.processes.set(sessionId, { process: proc, session });

		// Set up stdout parsing (JSONL)
		if (proc.stdout) {
			const rl = createInterface({ input: proc.stdout });

			rl.on("line", (line) => {
				this.handleLine(sessionId, line);
			});
		}

		// Handle stderr (for debugging/warnings)
		proc.stderr?.on("data", (data) => {
			const text = data.toString();
			// Filter out common warnings
			if (!text.includes("[WARN] Skipping unreadable directory")) {
				console.error(`[GeminiAdapter][${sessionId}] stderr:`, text);
			}
		});

		// Handle process exit
		proc.on("close", (code) => {
			console.log(
				`[GeminiAdapter][${sessionId}] Process exited with code ${code}`,
			);

			const finalStatus = code === 0 ? "completed" : "error";
			this.updateSession(sessionId, {
				status: finalStatus,
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
			console.error(`[GeminiAdapter][${sessionId}] Process error:`, err);

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

		// Update status to running
		this.updateSession(sessionId, { status: "running" });

		return session;
	}

	async kill(sessionId: string): Promise<void> {
		const gp = this.processes.get(sessionId);
		if (!gp) {
			console.warn(`[GeminiAdapter] No process found for session ${sessionId}`);
			return;
		}

		console.log(`[GeminiAdapter] Killing session ${sessionId}`);
		gp.process.kill("SIGTERM");

		this.updateSession(sessionId, { status: "killed" });
		this.processes.delete(sessionId);
	}

	async sendMessage(sessionId: string, _message: string): Promise<void> {
		const gp = this.processes.get(sessionId);
		if (!gp) {
			throw new Error(`No process found for session ${sessionId}`);
		}

		// Gemini CLI in -p mode doesn't support stdin input after start
		// Would need to use interactive mode or start a new session
		console.warn(
			"[GeminiAdapter] sendMessage not supported in headless mode. " +
				"Consider starting a new session with the new prompt.",
		);
	}

	// ---------------------------------------------------------------------------
	// Approvals
	// ---------------------------------------------------------------------------

	async approve(approvalId: string): Promise<void> {
		const approval = this.approvals.get(approvalId);
		if (!approval) {
			throw new Error(`Approval ${approvalId} not found`);
		}

		// Gemini CLI in headless mode doesn't support interactive approvals
		// Use --approval-mode=yolo or auto_edit for auto-approval
		console.warn(
			"[GeminiAdapter] Approval not supported in headless mode. " +
				"Use --approval-mode=yolo for auto-approval.",
		);

		approval.status = "approved";
		approval.resolvedAt = new Date();
		this.approvals.set(approvalId, approval);
	}

	async reject(approvalId: string, _reason?: string): Promise<void> {
		const approval = this.approvals.get(approvalId);
		if (!approval) {
			throw new Error(`Approval ${approvalId} not found`);
		}

		console.warn("[GeminiAdapter] Rejection not supported in headless mode.");

		approval.status = "rejected";
		approval.resolvedAt = new Date();
		this.approvals.set(approvalId, approval);
	}

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	async dispose(): Promise<void> {
		console.log("[GeminiAdapter] Disposing all sessions...");

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
	// Private: Helpers
	// ---------------------------------------------------------------------------

	private mapApprovalMode(
		permissionMode?: string,
	): "default" | "auto_edit" | "yolo" | "plan" | undefined {
		switch (permissionMode) {
			case "default":
				return "default";
			case "acceptEdits":
				return "auto_edit";
			case "bypassPermissions":
				return "yolo";
			case "plan":
				return "plan";
			default:
				return undefined;
		}
	}

	// ---------------------------------------------------------------------------
	// Private: Event Parsing
	// ---------------------------------------------------------------------------

	private handleLine(sessionId: string, line: string): void {
		if (!line.trim()) return;

		// Skip non-JSON lines (warnings, etc.)
		if (!line.startsWith("{")) {
			return;
		}

		try {
			const data = JSON.parse(line);
			this.handleParsedEvent(sessionId, data);
		} catch (_err) {
			console.warn(`[GeminiAdapter][${sessionId}] Non-JSON line:`, line);
		}
	}

	private handleParsedEvent(
		sessionId: string,
		data: Record<string, unknown>,
	): void {
		const timestamp = data.timestamp
			? new Date(data.timestamp as string)
			: new Date();
		const eventType = data.type as string;

		switch (eventType) {
			case "init":
				this.handleInitEvent(sessionId, data, timestamp);
				break;

			case "message":
				this.handleMessageEvent(sessionId, data, timestamp);
				break;

			case "tool_use":
				this.handleToolUseEvent(sessionId, data, timestamp);
				break;

			case "tool_result":
				this.handleToolResultEvent(sessionId, data, timestamp);
				break;

			case "result":
				this.handleResultEvent(sessionId, data, timestamp);
				break;

			default:
				// Emit unknown types as raw
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: data,
				});
		}
	}

	private handleInitEvent(
		sessionId: string,
		data: Record<string, unknown>,
		timestamp: Date,
	): void {
		const nativeSessionId = data.session_id as string;
		const model = data.model as string;

		this.updateSession(sessionId, {
			nativeSessionId,
			model,
		});

		this.emitEvent({
			type: "init",
			sessionId,
			timestamp,
			payload: {
				nativeSessionId,
				model,
			},
		});
	}

	private handleMessageEvent(
		sessionId: string,
		data: Record<string, unknown>,
		timestamp: Date,
	): void {
		const role = data.role as "user" | "assistant";
		const content = data.content as string;

		this.emitEvent({
			type: "message",
			sessionId,
			timestamp,
			payload: {
				role,
				content,
				delta: data.delta === true,
			},
		});
	}

	private handleToolUseEvent(
		sessionId: string,
		data: Record<string, unknown>,
		timestamp: Date,
	): void {
		const toolName = data.tool_name as string;
		const toolId = data.tool_id as string;
		const parameters = data.parameters as Record<string, unknown>;

		this.emitEvent({
			type: "tool-use",
			sessionId,
			timestamp,
			payload: {
				toolName,
				toolId,
				input: parameters,
			},
		});

		// If in default approval mode, we might need to create an approval request
		// But in headless mode, Gemini CLI handles this internally
	}

	private handleToolResultEvent(
		sessionId: string,
		data: Record<string, unknown>,
		timestamp: Date,
	): void {
		const toolId = data.tool_id as string;
		const status = data.status as string;
		const output = data.output;

		this.emitEvent({
			type: "tool-result",
			sessionId,
			timestamp,
			payload: {
				toolId,
				output,
				isError: status !== "success",
			},
		});
	}

	private handleResultEvent(
		sessionId: string,
		data: Record<string, unknown>,
		timestamp: Date,
	): void {
		const status = data.status as string;
		const stats = data.stats as Record<string, unknown>;

		this.updateSession(sessionId, {
			status: status === "success" ? "completed" : "error",
		});

		this.emitEvent({
			type: "complete",
			sessionId,
			timestamp,
			payload: {
				status,
				stats,
			},
		});
	}
}
