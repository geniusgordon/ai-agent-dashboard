/**
 * Spawn Agent Dialog
 *
 * Modal dialog for picking an agent type and spawning it in a worktree.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText, Play } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
import { buildInitialMessage } from "@/lib/documents/prompts";
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
  const [initialPrompt, setInitialPrompt] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resumeFromDocs, setResumeFromDocs] = useState(false);
  const navigate = useNavigate();

  const spawnMutation = useMutation(
    trpc.sessions.getOrSpawnClient.mutationOptions(),
  );
  const createSessionMutation = useMutation(
    trpc.sessions.createSession.mutationOptions(),
  );
  const assignMutation = useMutation(
    trpc.worktrees.assignAgent.mutationOptions(),
  );
  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions(),
  );

  const docsQuery = useQuery({
    ...trpc.worktrees.detectDocuments.queryOptions({
      worktreeId: worktreeId,
    }),
    enabled: open,
  });
  const detectedDocs = docsQuery.data ?? [];

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

      // Build and send initial prompt if provided
      const message = buildInitialMessage(
        detectedDocs,
        resumeFromDocs,
        initialPrompt,
      );
      if (message) {
        await sendMessageMutation.mutateAsync({
          sessionId: session.id,
          message,
        });
      }

      invalidateAll();
      onOpenChange(false);

      // Navigate to the new session
      navigate({
        to: "/dashboard/sessions/$sessionId",
        params: { sessionId: session.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to spawn agent");
      invalidateAll();
    } finally {
      setSpawningType(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setInitialPrompt("");
          setPromptExpanded(false);
          setResumeFromDocs(false);
          setError(null);
        }
        onOpenChange(v);
      }}
    >
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

        {/* Initial prompt (collapsible) */}
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setPromptExpanded((prev) => !prev)}
          >
            {promptExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Initial prompt
          </button>

          {promptExpanded && (
            <Textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              placeholder="Optional first message to send after spawning..."
              className="min-h-[80px] text-sm"
            />
          )}
        </div>

        {/* Resume from documents */}
        {detectedDocs.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30">
            <Checkbox
              id="resume-from-docs"
              checked={resumeFromDocs}
              onCheckedChange={(checked) => setResumeFromDocs(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="resume-from-docs"
              className="space-y-1 cursor-pointer"
            >
              <span className="text-sm font-medium">
                Resume from previous documents
              </span>
              <div className="flex flex-wrap gap-1">
                {detectedDocs.map((doc) => (
                  <span
                    key={doc.path}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded"
                  >
                    <FileText className="size-3" />
                    {doc.path}
                  </span>
                ))}
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
