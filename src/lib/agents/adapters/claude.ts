/**
 * Claude Code Adapter
 *
 * Interfaces with Claude Code CLI using stream-json mode.
 *
 * Spawn: claude --print --output-format stream-json --verbose [prompt]
 * Events are emitted as JSONL on stdout.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { AgentSession, AgentType, SpawnOptions } from "../types";
import { BaseAdapter } from "./base";

interface ClaudeProcess {
	process: ChildProcess;
	session: AgentSession;
}

export class ClaudeCodeAdapter extends BaseAdapter {
	readonly type: AgentType = "claude-code";

	private processes: Map<string, ClaudeProcess> = new Map();

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	async spawn(options: SpawnOptions): Promise<AgentSession> {
		const sessionId = this.generateId();

		// Build command args
		const args = ["--print", "--output-format", "stream-json", "--verbose"];

		// Add permission mode if specified
		if (options.permissionMode) {
			args.push("--permission-mode", options.permissionMode);
		}

		// Add model if specified
		if (options.model) {
			args.push("--model", options.model);
		}

		// Add the prompt
		args.push(options.prompt);

		console.log(`[ClaudeAdapter] Spawning: claude ${args.join(" ")}`);

		// Spawn the process
		const proc = spawn("claude", args, {
			cwd: options.cwd,
			env: { ...process.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Create session object
		const session: AgentSession = {
			id: sessionId,
			type: "claude-code",
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

		// Handle stderr (for debugging)
		proc.stderr?.on("data", (data) => {
			const text = data.toString();
			console.error(`[ClaudeAdapter][${sessionId}] stderr:`, text);

			// Emit as raw event for debugging
			this.emitEvent({
				type: "raw",
				sessionId,
				timestamp: new Date(),
				payload: { stream: "stderr", data: text },
			});
		});

		// Handle process exit
		proc.on("close", (code) => {
			console.log(
				`[ClaudeAdapter][${sessionId}] Process exited with code ${code}`,
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

			// Cleanup
			this.processes.delete(sessionId);
		});

		proc.on("error", (err) => {
			console.error(`[ClaudeAdapter][${sessionId}] Process error:`, err);

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
		const cp = this.processes.get(sessionId);
		if (!cp) {
			console.warn(`[ClaudeAdapter] No process found for session ${sessionId}`);
			return;
		}

		console.log(`[ClaudeAdapter] Killing session ${sessionId}`);
		cp.process.kill("SIGTERM");

		this.updateSession(sessionId, { status: "killed" });
		this.processes.delete(sessionId);
	}

	async sendMessage(sessionId: string, message: string): Promise<void> {
		const cp = this.processes.get(sessionId);
		if (!cp) {
			throw new Error(`No process found for session ${sessionId}`);
		}

		// For bidirectional streaming, we need --input-format stream-json
		// For now, just write to stdin as plain text
		// TODO: Implement proper stream-json input format
		cp.process.stdin?.write(`${message}\n`);
	}

	// ---------------------------------------------------------------------------
	// Approvals (limited support in stream-json mode)
	// ---------------------------------------------------------------------------

	async approve(approvalId: string): Promise<void> {
		const approval = this.approvals.get(approvalId);
		if (!approval) {
			throw new Error(`Approval ${approvalId} not found`);
		}

		// Claude Code in --print mode doesn't support interactive approvals
		// This is a limitation we need to work around
		console.warn(
			"[ClaudeAdapter] Approval not fully supported in stream-json mode. " +
				"Consider using --permission-mode=acceptEdits or bypassPermissions.",
		);

		approval.status = "approved";
		approval.resolvedAt = new Date();
		this.approvals.set(approvalId, approval);

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

		console.warn(
			"[ClaudeAdapter] Rejection not fully supported in stream-json mode.",
		);

		approval.status = "rejected";
		approval.resolvedAt = new Date();
		this.approvals.set(approvalId, approval);

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
		console.log("[ClaudeAdapter] Disposing all sessions...");

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
	// Private: Event Parsing
	// ---------------------------------------------------------------------------

	private handleLine(sessionId: string, line: string): void {
		if (!line.trim()) return;

		try {
			const data = JSON.parse(line);
			this.handleParsedEvent(sessionId, data);
		} catch (_err) {
			// Not valid JSON, emit as raw
			console.warn(`[ClaudeAdapter][${sessionId}] Non-JSON line:`, line);
			this.emitEvent({
				type: "raw",
				sessionId,
				timestamp: new Date(),
				payload: { line },
			});
		}
	}

	private handleParsedEvent(
		sessionId: string,
		data: Record<string, unknown>,
	): void {
		const timestamp = new Date();

		// Handle different event types from Claude Code
		const eventType = data.type as string;
		const subtype = data.subtype as string | undefined;

		switch (eventType) {
			case "system":
				this.handleSystemEvent(sessionId, subtype, data, timestamp);
				break;

			case "assistant":
				this.emitEvent({
					type: "message",
					sessionId,
					timestamp,
					payload: {
						role: "assistant",
						content: data.message || data.content || "",
						raw: data,
					},
				});
				break;

			case "user":
				this.emitEvent({
					type: "message",
					sessionId,
					timestamp,
					payload: {
						role: "user",
						content: data.message || data.content || "",
						raw: data,
					},
				});
				break;

			case "tool_use":
				this.emitEvent({
					type: "tool-use",
					sessionId,
					timestamp,
					payload: {
						toolName: data.name || data.tool_name,
						toolId: data.id || data.tool_id,
						input: data.input,
						raw: data,
					},
				});
				break;

			case "tool_result":
				this.emitEvent({
					type: "tool-result",
					sessionId,
					timestamp,
					payload: {
						toolId: data.tool_use_id || data.id,
						output: data.content || data.output,
						isError: data.is_error,
						raw: data,
					},
				});
				break;

			default:
				// Emit as raw for unknown types
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: data,
				});
		}
	}

	private handleSystemEvent(
		sessionId: string,
		subtype: string | undefined,
		data: Record<string, unknown>,
		timestamp: Date,
	): void {
		switch (subtype) {
			case "init": {
				// Session initialization event
				const nativeSessionId = data.session_id as string;
				this.updateSession(sessionId, {
					nativeSessionId,
					model: data.model as string,
				});

				this.emitEvent({
					type: "init",
					sessionId,
					timestamp,
					payload: {
						nativeSessionId,
						cwd: data.cwd,
						model: data.model,
						tools: data.tools,
						permissionMode: data.permissionMode,
					},
				});
				break;
			}

			case "hook_started":
			case "hook_response":
				// Plugin hooks - emit as raw for now
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: { subtype, ...data },
				});
				break;

			default:
				this.emitEvent({
					type: "raw",
					sessionId,
					timestamp,
					payload: data,
				});
		}
	}
}
