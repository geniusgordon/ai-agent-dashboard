#!/usr/bin/env npx tsx
/**
 * Test script for ACP Client
 *
 * Usage:
 *   npx tsx scripts/test-acp-client.ts [agent-type]
 *
 * agent-type: gemini | claude-code | codex (default: gemini)
 */

import { type AgentType, createACPClient } from "../src/lib/acp/index.js";

const agentType = (process.argv[2] as AgentType) || "gemini";

console.log(`\n🚀 Testing ACP Client with ${agentType}...\n`);

const client = createACPClient(agentType, process.cwd());

// Set up event listeners
client.on("agent:ready", (capabilities) => {
	console.log("✅ Agent ready!");
	console.log("   Protocol version:", capabilities.protocolVersion);
	console.log(
		"   Auth methods:",
		capabilities.authMethods?.map((m: { name: string }) => m.name).join(", "),
	);
	console.log(
		"   Capabilities:",
		JSON.stringify(capabilities.agentCapabilities, null, 2),
	);
});

client.on("agent:error", (error) => {
	console.error("❌ Agent error:", error.message);
});

client.on("agent:exit", (code) => {
	console.log(`👋 Agent exited with code: ${code}`);
});

client.on("session:update", (_sessionId, notification) => {
	const update = notification.update;

	switch (update.sessionUpdate) {
		case "agent_thought_chunk":
			if (update.content.type === "text") {
				process.stdout.write(`💭 ${update.content.text}`);
			}
			break;
		case "agent_message_chunk":
			if (update.content.type === "text") {
				process.stdout.write(update.content.text);
			}
			break;
		case "tool_call":
			console.log(`\n🔧 Tool: ${update.title} (${update.status})`);
			break;
		case "tool_call_update":
			console.log(`🔧 Tool update: ${update.toolCallId} → ${update.status}`);
			break;
		default:
			console.log(`📨 Update: ${update.sessionUpdate}`);
	}
});

client.on("permission:request", (permission) => {
	console.log("\n🔐 Permission requested!");
	console.log("   Tool:", permission.request.toolCall?.title);
	console.log(
		"   Options:",
		permission.request.options?.map((o: { name: string }) => o.name).join(", "),
	);

	// Auto-approve for testing
	const firstOption = permission.request.options?.[0];
	if (firstOption) {
		console.log(`   → Auto-selecting: ${firstOption.name}`);
		permission.resolve({
			outcome: { outcome: "selected", optionId: firstOption.optionId },
		});
	}
});

async function main() {
	try {
		// Start the client
		console.log("📡 Starting agent...");
		await client.start();

		// Create a session
		console.log("\n📝 Creating session...");
		const session = await client.createSession(process.cwd());
		console.log(`   Session ID: ${session.id}`);

		// Send a test message
		console.log("\n💬 Sending message: 'Say hello in one sentence.'\n");
		console.log("─".repeat(50));

		const result = await client.sendMessage(
			session.id,
			"Say hello in one sentence.",
		);

		console.log(`\n${"─".repeat(50)}`);
		console.log(`\n✅ Completed with stop reason: ${result.stopReason}`);
	} catch (error) {
		console.error("\n❌ Error:", error);
	} finally {
		console.log("\n🛑 Stopping client...");
		client.stop();
	}
}

main();
