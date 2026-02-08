/**
 * Project Spawn Flow
 *
 * Compact agent spawner within project detail: select worktree → select agent type → spawn.
 * Chains three tRPC mutations: spawnClient → createSession → assignAgent.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
import type { Worktree } from "@/lib/projects/types";
import { AgentBadge } from "./AgentBadge";

interface ProjectSpawnFlowProps {
  projectId: string;
  worktrees: Worktree[];
}

const agentTypes: AgentType[] = ["gemini", "claude-code", "codex"];

export function ProjectSpawnFlow({
  projectId,
  worktrees,
}: ProjectSpawnFlowProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedWorktreeId, setSelectedWorktreeId] = useState("");
  const [spawningType, setSpawningType] = useState<AgentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spawnMutation = useMutation(
    trpc.sessions.spawnClient.mutationOptions(),
  );
  const createSessionMutation = useMutation(
    trpc.sessions.createSession.mutationOptions(),
  );
  const assignMutation = useMutation(
    trpc.worktrees.assignAgent.mutationOptions(),
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listClients.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listSessions.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getAssignments.queryKey({ projectId }),
    });
    if (selectedWorktreeId) {
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getAssignments.queryKey({
          worktreeId: selectedWorktreeId,
        }),
      });
    }
  };

  const handleSpawn = async (agentType: AgentType) => {
    const worktree = worktrees.find((w) => w.id === selectedWorktreeId);
    if (!worktree) return;

    setSpawningType(agentType);
    setError(null);

    try {
      // 1. Spawn client in worktree directory
      const client = await spawnMutation.mutateAsync({
        agentType,
        cwd: worktree.path,
      });

      // 2. Create session on the new client
      const session = await createSessionMutation.mutateAsync({
        clientId: client.id,
      });

      // 3. Assign session to worktree
      await assignMutation.mutateAsync({
        sessionId: session.id,
        clientId: client.id,
        worktreeId: selectedWorktreeId,
        projectId,
      });

      invalidateAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to spawn agent");
      invalidateAll();
    } finally {
      setSpawningType(null);
    }
  };

  if (worktrees.length === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-border bg-card/30 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Play className="size-4" />
        Spawn Agent in Worktree
      </h3>

      {/* Worktree selector */}
      <Select
        value={selectedWorktreeId || undefined}
        onValueChange={setSelectedWorktreeId}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a worktree..." />
        </SelectTrigger>
        <SelectContent>
          {worktrees.map((wt) => (
            <SelectItem key={wt.id} value={wt.id}>
              {wt.name} ({wt.branch})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Agent type buttons */}
      <div className="flex flex-wrap gap-2">
        {agentTypes.map((type) => {
          const isSpawning = spawningType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleSpawn(type)}
              disabled={!selectedWorktreeId || spawningType !== null}
              className="px-3 py-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary hover:border-border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <AgentBadge type={type} size="sm" />
              <span className="text-xs text-muted-foreground">
                {isSpawning ? "Starting..." : "Start"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
