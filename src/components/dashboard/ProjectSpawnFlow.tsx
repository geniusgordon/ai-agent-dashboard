/**
 * Project Spawn Flow
 *
 * Compact agent spawner within project detail: select worktree → select agent type → spawn.
 * Chains three tRPC mutations: getOrSpawnClient → createSession → assignAgent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText, Play } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [initialPrompt, setInitialPrompt] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resumeFromDocs, setResumeFromDocs] = useState(false);
  const navigate = useNavigate();

  const selectedWorktree = worktrees.find((w) => w.id === selectedWorktreeId);

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
      worktreePath: selectedWorktree?.path ?? "",
    }),
    enabled: !!selectedWorktree,
  });
  const detectedDocs = docsQuery.data ?? [];

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
    if (!selectedWorktree) return;

    setSpawningType(agentType);
    setError(null);

    try {
      // 1. Spawn client in worktree directory
      const client = await spawnMutation.mutateAsync({
        agentType,
        cwd: selectedWorktree.path,
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

      // Build and send initial prompt if provided
      const parts: string[] = [];
      if (resumeFromDocs && detectedDocs.length > 0) {
        parts.push(
          "Here are documents from the previous session for context:\n\n" +
            detectedDocs
              .map((d) => `--- ${d.path} ---\n${d.content}`)
              .join("\n\n"),
        );
      }
      if (initialPrompt.trim()) {
        parts.push(initialPrompt.trim());
      }
      if (parts.length > 0) {
        await sendMessageMutation.mutateAsync({
          sessionId: session.id,
          message: parts.join("\n\n---\n\n"),
        });
      }

      invalidateAll();

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
        onValueChange={(v) => {
          setSelectedWorktreeId(v);
          setResumeFromDocs(false);
        }}
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
            id="psf-resume-from-docs"
            checked={resumeFromDocs}
            onCheckedChange={(checked) => setResumeFromDocs(checked === true)}
            className="mt-0.5"
          />
          <label
            htmlFor="psf-resume-from-docs"
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

      {/* Error */}
      {error && (
        <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
