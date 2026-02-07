/**
 * Spawn Agent Dialog
 *
 * Modal dialog for picking an agent type and spawning it in a worktree.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
import { AgentBadge } from "./AgentBadge";

const agentTypes: AgentType[] = ["claude-code", "codex", "gemini"];

interface SpawnAgentDialogProps {
  projectId: string;
  worktreeId: string;
  worktreePath: string;
  worktreeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpawnAgentDialog({
  projectId,
  worktreeId,
  worktreePath,
  worktreeName,
  open,
  onOpenChange,
}: SpawnAgentDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
    // Invalidate both filtered (project page) and unfiltered (sidebar) session queries
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listSessions.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getAssignments.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.worktrees.getAssignments.queryKey({ worktreeId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listClients.queryKey(),
    });
  };

  const handleSpawn = async (agentType: AgentType) => {
    setSpawningType(agentType);
    setError(null);

    try {
      const client = await spawnMutation.mutateAsync({
        agentType,
        cwd: worktreePath,
      });
      const session = await createSessionMutation.mutateAsync({
        clientId: client.id,
      });
      await assignMutation.mutateAsync({
        sessionId: session.id,
        clientId: client.id,
        worktreeId,
        projectId,
      });
      invalidateAll();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to spawn agent");
      invalidateAll();
    } finally {
      setSpawningType(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-5" />
            Spawn Agent
          </DialogTitle>
          <DialogDescription>
            Pick an agent to spawn in{" "}
            <span className="font-medium text-foreground">{worktreeName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {agentTypes.map((type) => {
            const isSpawning = spawningType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSpawn(type)}
                disabled={spawningType !== null}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AgentBadge type={type} />
                <span className="text-xs text-muted-foreground">
                  {isSpawning ? "Starting..." : ""}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
