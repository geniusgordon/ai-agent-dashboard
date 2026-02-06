/**
 * Dashboard Overview Page
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	AgentBadge,
	ClientCard,
	ErrorDisplay,
	SessionCard,
} from "../../components/dashboard";
import { useAgentEvents } from "../../hooks/useAgentEvents";
import { useTRPC } from "../../integrations/trpc/react";
import type { AgentType } from "../../lib/agents/types";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardOverview,
});

function DashboardOverview() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [selectedCwd, setSelectedCwd] = useState(process.cwd?.() ?? "/tmp");
	const [spawningType, setSpawningType] = useState<AgentType | null>(null);

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
					<p className="text-slate-400 mt-1">Manage your AI coding agents</p>
				</div>
			</div>

			{/* Quick Spawn */}
			<div className="p-6 rounded-xl border border-slate-700/50 bg-slate-800/30">
				<h2 className="text-lg font-semibold mb-4">Spawn Agent</h2>

				{/* CWD Input */}
				<div className="mb-4">
					<label htmlFor="cwd" className="block text-sm text-slate-400 mb-2">
						Working Directory
					</label>
					<input
						id="cwd"
						type="text"
						value={selectedCwd}
						onChange={(e) => setSelectedCwd(e.target.value)}
						className="
              w-full px-4 py-2 rounded-lg
              bg-slate-900 border border-slate-700
              text-slate-100 font-mono text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500/50
            "
					/>
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
                  px-4 py-2.5 rounded-lg border border-slate-600/50 bg-slate-700/50
                  hover:bg-slate-700 hover:border-slate-500/50
                  transition-all cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-2
                "
							>
								<AgentBadge type={type} size="sm" />
								<span className="text-sm text-slate-300">
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
				<h2 className="text-lg font-semibold mb-4">
					Active Clients
					<span className="ml-2 text-sm text-slate-500 font-normal">
						({clients.length})
					</span>
					{clientsQuery.isLoading && (
						<span className="ml-2 text-sm text-slate-500">Loading...</span>
					)}
				</h2>

				{clients.length === 0 ? (
					<div
						className="
            p-8 rounded-xl border border-dashed border-slate-700
            text-center text-slate-500
          "
					>
						<p>No active clients</p>
						<p className="text-sm mt-1">Spawn an agent above to get started</p>
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
					<span className="ml-2 text-sm text-slate-500 font-normal">
						({sessions.length})
					</span>
				</h2>

				{sessions.length === 0 ? (
					<div
						className="
            p-8 rounded-xl border border-dashed border-slate-700
            text-center text-slate-500
          "
					>
						<p>No sessions yet</p>
						<p className="text-sm mt-1">
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
