#!/usr/bin/env npx tsx
/**
 * Test script for ClaudeCodeAdapter
 *
 * Run: npx tsx scripts/test-claude-adapter.ts
 */

import { ClaudeCodeAdapter } from "../src/lib/agents/adapters/claude";

async function main() {
	console.log("🧪 Testing ClaudeCodeAdapter...\n");

	const adapter = new ClaudeCodeAdapter();

	// Subscribe to all events
	adapter.onAllEvents((event) => {
		const payload =
			typeof event.payload === "object"
				? JSON.stringify(event.payload, null, 2).slice(0, 500)
				: event.payload;
		console.log(`📨 [${event.type}]`, payload);
	});

	try {
		// Spawn a simple session
		console.log("🚀 Spawning session...\n");

		const session = await adapter.spawn({
			type: "claude-code",
			cwd: process.cwd(),
			prompt: "What is 2 + 2? Reply in one word.",
			permissionMode: "bypassPermissions", // Skip approvals for testing
		});

		console.log("✅ Session created:", session.id);
		console.log("   Status:", session.status);
		console.log("   CWD:", session.cwd);
		console.log("");

		// Wait for completion (with timeout)
		const timeout = 30_000;
		const startTime = Date.now();

		await new Promise<void>((resolve, reject) => {
			const checkInterval = setInterval(() => {
				const currentSession = adapter.getSession(session.id);

				if (!currentSession) {
					clearInterval(checkInterval);
					resolve();
					return;
				}

				if (
					currentSession.status === "completed" ||
					currentSession.status === "error" ||
					currentSession.status === "killed"
				) {
					clearInterval(checkInterval);
					console.log(
						`\n🏁 Session ended with status: ${currentSession.status}`,
					);
					resolve();
					return;
				}

				if (Date.now() - startTime > timeout) {
					clearInterval(checkInterval);
					reject(new Error("Timeout waiting for session to complete"));
				}
			}, 500);
		});
	} catch (err) {
		console.error("❌ Error:", err);
	} finally {
		// Cleanup
		console.log("\n🧹 Cleaning up...");
		await adapter.dispose();
		console.log("✅ Done!");
	}
}

main().catch(console.error);
