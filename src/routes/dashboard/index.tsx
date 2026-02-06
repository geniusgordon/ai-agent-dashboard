/**
 * Dashboard Overview Page
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClientCard, SessionCard, AgentBadge } from "../../components/dashboard";
import type { AgentType, AgentClient, AgentSession } from "../../lib/agents/types";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  // TODO: Replace with tRPC queries
  const [clients] = useState<AgentClient[]>([]);
  const [sessions] = useState<AgentSession[]>([]);
  const [isSpawning, setIsSpawning] = useState(false);

  const handleSpawnClient = async (agentType: AgentType) => {
    setIsSpawning(true);
    // TODO: Call tRPC mutation
    console.log("Spawning client:", agentType);
    setTimeout(() => setIsSpawning(false), 1000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Manage your AI coding agents
          </p>
        </div>
      </div>

      {/* Quick Spawn */}
      <div className="p-6 rounded-xl border border-slate-700/50 bg-slate-800/30">
        <h2 className="text-lg font-semibold mb-4">Spawn Agent</h2>
        <div className="flex flex-wrap gap-3">
          {(["gemini", "claude-code", "codex"] as AgentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSpawnClient(type)}
              disabled={isSpawning}
              className="
                px-4 py-2.5 rounded-lg border border-slate-600/50 bg-slate-700/50
                hover:bg-slate-700 hover:border-slate-500/50
                transition-all cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2
              "
            >
              <AgentBadge type={type} size="sm" />
              <span className="text-sm text-slate-300">Start</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clients Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Active Clients
          <span className="ml-2 text-sm text-slate-500 font-normal">
            ({clients.length})
          </span>
        </h2>

        {clients.length === 0 ? (
          <div className="
            p-8 rounded-xl border border-dashed border-slate-700
            text-center text-slate-500
          ">
            <p>No active clients</p>
            <p className="text-sm mt-1">Spawn an agent above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                sessionCount={sessions.filter((s) => s.clientId === client.id).length}
                onCreateSession={() => console.log("Create session for", client.id)}
                onStop={() => console.log("Stop client", client.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Recent Sessions
          <span className="ml-2 text-sm text-slate-500 font-normal">
            ({sessions.length})
          </span>
        </h2>

        {sessions.length === 0 ? (
          <div className="
            p-8 rounded-xl border border-dashed border-slate-700
            text-center text-slate-500
          ">
            <p>No sessions yet</p>
            <p className="text-sm mt-1">Create a session from an active client</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.slice(0, 6).map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
