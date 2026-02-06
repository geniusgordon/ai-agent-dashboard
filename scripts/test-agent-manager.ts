#!/usr/bin/env npx tsx
/**
 * Test script for Agent Manager (ACP-based)
 *
 * Usage:
 *   npx tsx scripts/test-agent-manager.ts [agent-type]
 *
 * agent-type: gemini | claude-code | codex (default: gemini)
 */

import { type AgentType, getAgentManager } from "../src/lib/agents/index.js";

const agentType = (process.argv[2] as AgentType) || "gemini";

console.log(`\n🚀 Testing Agent Manager with ${agentType}...\n`);

const manager = getAgentManager();

// Set up event listeners
manager.onEvent((event) => {
  switch (event.type) {
    case "thinking":
      process.stdout.write(
        `💭 ${(event.payload as { content: string }).content}`,
      );
      break;
    case "message":
      process.stdout.write((event.payload as { content: string }).content);
      break;
    case "tool-call":
      console.log(`\n🔧 Tool: ${(event.payload as { title: string }).title}`);
      break;
    case "tool-update":
      console.log(`🔧 Update: ${(event.payload as { status: string }).status}`);
      break;
    case "complete":
      console.log(
        `\n✅ Complete: ${(event.payload as { stopReason: string }).stopReason}`,
      );
      break;
    default:
      console.log(`📨 ${event.type}:`, event.payload);
  }
});

manager.onApproval((approval) => {
  console.log("\n🔐 Approval requested!");
  console.log("   Tool:", approval.toolCall.title);
  console.log("   Options:", approval.options.map((o) => o.name).join(", "));

  // Auto-approve for testing
  const firstOption = approval.options[0];
  if (firstOption) {
    console.log(`   → Auto-selecting: ${firstOption.name}`);
    manager.approveRequest(approval.id, firstOption.optionId);
  }
});

async function main() {
  try {
    // Spawn client
    console.log("📡 Spawning client...");
    const client = await manager.spawnClient({
      agentType,
      cwd: process.cwd(),
    });
    console.log(`   Client ID: ${client.id}`);
    console.log(`   Status: ${client.status}`);

    // Create session
    console.log("\n📝 Creating session...");
    const session = await manager.createSession({ clientId: client.id });
    console.log(`   Session ID: ${session.id}`);

    // Send message
    console.log("\n💬 Sending message: 'Say hello in one sentence.'\n");
    console.log("─".repeat(50));

    await manager.sendMessage(session.id, "Say hello in one sentence.");

    console.log("─".repeat(50));

    // List sessions
    console.log("\n📋 Sessions:", manager.listSessions().length);
    console.log("📋 Clients:", manager.listClients().length);
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    console.log("\n🛑 Disposing manager...");
    await manager.dispose();
  }
}

main();
