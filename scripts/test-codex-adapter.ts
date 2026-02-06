#!/usr/bin/env npx tsx
/**
 * Test script for CodexAdapter
 *
 * Run: npx tsx scripts/test-codex-adapter.ts
 */

import { CodexAdapter } from "../src/lib/agents/adapters/codex";

async function main() {
	console.log("🧪 Testing CodexAdapter...\n");

	const adapter = new CodexAdapter();

	// Subscribe to all events
	adapter.onAllEvents((event) => {
		const payload =
			typeof event.payload === "object"
				? JSON.stringify(event.payload, null, 2).slice(0, 500)
				: event.payload;
		console.log(`📨 [${event.type}]`, payload);

		// If we get an approval request, auto-approve it for testing
		if (event.type === "approval-request") {
			const approval = event.payload as { id: string };
			console.log(`\n🔐 Auto-approving request ${approval.id}...`);
			adapter.approve(approval.id).catch(console.error);
		}
	});

	try {
		// Spawn a simple session
		console.log("🚀 Spawning Codex session...\n");

		const session = await adapter.spawn({
			type: "codex",
			cwd: process.cwd(),
			prompt: "What is 2 + 2? Reply with just the number, nothing else.",
		});

		console.log("✅ Session created:", session.id);
		console.log("   Status:", session.status);
		console.log("   CWD:", session.cwd);
		console.log("");

		// Wait for completion (with timeout)
		const timeout = 60_000; // 60 seconds for Codex
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
					if (currentSession.error) {
						console.log(`   Error: ${currentSession.error}`);
					}
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
