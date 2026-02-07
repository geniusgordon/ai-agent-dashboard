/**
 * Dashboard Overview Page
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Monitor, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AgentBadge,
  ClientCard,
  ErrorDisplay,
  SessionCard,
} from "../../components/dashboard";
import { useAgentEvents } from "../../hooks/useAgentEvents";
import { useTRPC } from "../../integrations/trpc/react";
import type { AgentType } from "../../lib/agents/types";

// Preset working directories
const CWD_PRESETS = [
  { label: "Home", path: "~" },
  { label: "Projects", path: "~/Projects" },
  { label: "Playground", path: "~/Playground" },
  { label: "Works", path: "~/Works" },
  { label: "Current", path: "." },
];

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedCwd, setSelectedCwd] = useState("~");
  const [spawningType, setSpawningType] = useState<AgentType | null>(null);
  const [showCwdDropdown, setShowCwdDropdown] = useState(false);
  const cwdDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cwdDropdownRef.current &&
        !cwdDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCwdDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Queries
  const clientsQuery = useQuery(trpc.sessions.listClients.queryOptions());
  const sessionsQuery = useQuery(trpc.sessions.listSessions.queryOptions());

  const clients = clientsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  // Subscribe to real-time events for status updates
  useAgentEvents({
    onEvent: (event) => {
      if (event.type === "complete" || event.type === "error") {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listClients.queryKey(),
        });
      }
    },
    onApproval: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
    },
  });

  // Mutations
  const spawnClientMutation = useMutation(
    trpc.sessions.spawnClient.mutationOptions({
      onSuccess: () => {
        setSpawningType(null);
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listClients.queryKey(),
        });
      },
      onError: () => {
        setSpawningType(null);
      },
    }),
  );

  const killClientMutation = useMutation(
    trpc.sessions.killClient.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listClients.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const cleanupMutation = useMutation(
    trpc.sessions.cleanupStaleSessions.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listClients.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
        if (data.cleaned > 0) {
          alert(`Cleaned up ${data.cleaned} stale session(s)`);
        }
      },
    }),
  );

  const createSessionMutation = useMutation(
    trpc.sessions.createSession.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sessions.listSessions.queryKey(),
        });
      },
    }),
  );

  const handleSpawnClient = (agentType: AgentType) => {
    setSpawningType(agentType);
    spawnClientMutation.mutate({
      agentType,
      cwd: selectedCwd,
    });
  };

  const handleStopClient = (clientId: string) => {
    if (confirm("Kill this client and all its sessions?")) {
      killClientMutation.mutate({ clientId });
    }
  };

  const handleCreateSession = (clientId: string) => {
    createSessionMutation.mutate({ clientId });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI coding agents
          </p>
        </div>
      </div>

      {/* Quick Spawn */}
      <div className="p-6 rounded-xl border border-border bg-card/30">
        <h2 className="text-lg font-semibold mb-4">Spawn Agent</h2>

        {/* CWD Input with Presets */}
        <div className="mb-4">
          <label
            htmlFor="cwd"
            className="block text-sm text-muted-foreground mb-2"
          >
            Working Directory
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1" ref={cwdDropdownRef}>
              <input
                id="cwd"
                type="text"
                value={selectedCwd}
                onChange={(e) => setSelectedCwd(e.target.value)}
                className="
                  w-full px-4 py-2 pr-10 rounded-lg
                  bg-background border border-input
                  text-foreground font-mono text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/50
                "
                placeholder="Enter path or select preset..."
              />
              <button
                type="button"
                onClick={() => setShowCwdDropdown(!showCwdDropdown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronDown className={`size-4 transition-transform ${showCwdDropdown ? "rotate-180" : ""}`} />
              </button>
              {showCwdDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1">
                  {CWD_PRESETS.map((preset) => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => {
                        setSelectedCwd(preset.path);
                        setShowCwdDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors cursor-pointer ${
                        selectedCwd === preset.path ? "bg-accent/50" : ""
                      }`}
                    >
                      <div className="font-medium text-sm">{preset.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {preset.path}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {(["gemini", "claude-code", "codex"] as AgentType[]).map((type) => {
            const isSpawning = spawningType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSpawnClient(type)}
                disabled={spawningType !== null}
                className="
                  px-4 py-2.5 rounded-lg border border-border bg-secondary/50
                  hover:bg-secondary hover:border-border
                  transition-all cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-2
                "
              >
                <AgentBadge type={type} size="sm" />
                <span className="text-sm text-muted-foreground">
                  {isSpawning ? "Starting..." : "Start"}
                </span>
              </button>
            );
          })}
        </div>

        {spawnClientMutation.isError && (
          <div className="mt-4">
            <ErrorDisplay
              error={spawnClientMutation.error}
              title="Failed to spawn agent"
              onRetry={() => spawnClientMutation.reset()}
            />
          </div>
        )}
      </div>

      {/* Query Errors */}
      {(clientsQuery.isError || sessionsQuery.isError) && (
        <ErrorDisplay
          error={clientsQuery.error || sessionsQuery.error}
          title="Failed to load data"
          onRetry={() => {
            clientsQuery.refetch();
            sessionsQuery.refetch();
          }}
        />
      )}

      {/* Clients Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Active Clients
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({clients.length})
            </span>
            {clientsQuery.isLoading && (
              <span className="ml-2 text-sm text-muted-foreground">
                Loading...
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Trash2 className="size-3.5" />
            {cleanupMutation.isPending ? "Cleaning..." : "Cleanup"}
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="p-12 rounded-xl border border-dashed border-border text-center">
            <Monitor className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No active clients</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Spawn an agent above to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                sessionCount={
                  sessions.filter((s) => s.clientId === client.id).length
                }
                onCreateSession={() => handleCreateSession(client.id)}
                onStop={() => handleStopClient(client.id)}
                isCreatingSession={
                  createSessionMutation.isPending &&
                  createSessionMutation.variables?.clientId === client.id
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Recent Sessions
          <span className="ml-2 text-sm text-muted-foreground font-normal">
            ({sessions.length})
          </span>
        </h2>

        {sessions.length === 0 ? (
          <div className="p-12 rounded-xl border border-dashed border-border text-center">
            <Monitor className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Create a session from an active client
            </p>
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
