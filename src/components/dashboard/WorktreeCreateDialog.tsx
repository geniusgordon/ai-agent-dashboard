/**
 * Create Worktree Dialog
 *
 * Dialog form for creating a new git worktree in a project.
 * Optionally spawns an agent in the new worktree immediately after creation.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, GitBranch, Play, Plus } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
import { buildInitialMessage } from "@/lib/documents/prompts";
import { AgentBadge } from "./AgentBadge";

interface WorktreeCreateDialogProps {
  projectId: string;
  trigger?: React.ReactNode;
}

const agentTypes: AgentType[] = ["gemini", "claude-code", "codex"];

export function WorktreeCreateDialog({
  projectId,
  trigger,
}: WorktreeCreateDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState("feat");
  const [branchName, setBranchName] = useState("");
  const [createNewBranch, setCreateNewBranch] = useState(true);
  const [baseBranch, setBaseBranch] = useState("");
  const [spawnAgent, setSpawnAgent] = useState(false);
  const [agentType, setAgentType] = useState<AgentType>("claude-code");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);

  const branchPrefixes = ["feat", "fix", "hotfix", "release", "chore"] as const;
  const fullBranchName = createNewBranch
    ? `${branchPrefix}/${branchName}`
    : branchName;

  const branchesQuery = useQuery(
    trpc.projects.listBranches.queryOptions({ projectId }, { enabled: open }),
  );

  const branches = (branchesQuery.data ?? []).filter((b) => b !== "HEAD");
  const defaultBranch =
    ["dev", "staging", "main", "master"].find((b) => branches.includes(b)) ??
    branches[0] ??
    "";

  const createWorktreeMutation = useMutation(
    trpc.worktrees.create.mutationOptions(),
  );
  const spawnClientMutation = useMutation(
    trpc.sessions.getOrSpawnClient.mutationOptions(),
  );
  const createSessionMutation = useMutation(
    trpc.sessions.createSession.mutationOptions(),
  );
  const assignAgentMutation = useMutation(
    trpc.worktrees.assignAgent.mutationOptions(),
  );
  const sendMessageMutation = useMutation(
    trpc.sessions.sendMessage.mutationOptions(),
  );

  const resetForm = () => {
    setBranchPrefix("feat");
    setBranchName("");
    setBaseBranch("");
    setSpawnAgent(false);
    setAgentType("claude-code");
    setError(null);
    setInitialPrompt("");
    setPromptExpanded(false);
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.worktrees.list.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listClients.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.sessions.listSessions.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.getAssignments.queryKey({ projectId }),
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const worktree = await createWorktreeMutation.mutateAsync({
        projectId,
        branchName: fullBranchName,
        createNewBranch,
        baseBranch: createNewBranch
          ? baseBranch || defaultBranch || undefined
          : undefined,
      });

      let sessionId: string | undefined;
      if (spawnAgent) {
        sessionId = await spawnAgentInWorktree(worktree.id, worktree.path);
      }

      invalidateQueries();
      setOpen(false);
      resetForm();

      if (sessionId) {
        navigate({
          to: "/dashboard/sessions/$sessionId",
          params: { sessionId },
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create worktree",
      );
      invalidateQueries();
    } finally {
      setIsSubmitting(false);
    }
  };

  const spawnAgentInWorktree = async (
    worktreeId: string,
    worktreePath: string,
  ): Promise<string> => {
    const client = await spawnClientMutation.mutateAsync({
      agentType,
      cwd: worktreePath,
    });

    const session = await createSessionMutation.mutateAsync({
      clientId: client.id,
    });

    await assignAgentMutation.mutateAsync({
      sessionId: session.id,
      clientId: client.id,
      worktreeId,
      projectId,
    });

    // Build and send initial prompt if provided
    const message = buildInitialMessage([], false, initialPrompt);
    if (message) {
      await sendMessageMutation.mutateAsync({
        sessionId: session.id,
        message,
      });
    }

    return session.id;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-4" />
            New Worktree
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-5" />
              Create Worktree
            </DialogTitle>
            <DialogDescription>
              Create a new git worktree for parallel development
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Branch mode */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreateNewBranch(true)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  createNewBranch
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                New Branch
              </button>
              <button
                type="button"
                onClick={() => setCreateNewBranch(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  !createNewBranch
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                Existing Branch
              </button>
            </div>

            {/* Branch name */}
            <div>
              <label
                htmlFor="branchName"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Branch Name
              </label>
              {createNewBranch ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={branchPrefix} onValueChange={setBranchPrefix}>
                    <SelectTrigger className="w-full sm:w-auto font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {branchPrefixes.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}/
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    id="branchName"
                    type="text"
                    value={branchName}
                    onChange={(e) =>
                      setBranchName(
                        e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      )
                    }
                    placeholder="my-feature"
                    required
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-input text-foreground font-mono text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ) : (
                <Select value={branchName} onValueChange={setBranchName}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Base branch (for new branches only) */}
            {createNewBranch && (
              <div>
                <label
                  htmlFor="baseBranch"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Base Branch
                  <span className="text-muted-foreground font-normal ml-1">
                    (optional, defaults to {defaultBranch || "main"})
                  </span>
                </label>
                <Select value={baseBranch} onValueChange={setBaseBranch}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={`${defaultBranch || "main"} (default)`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Spawn agent toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="spawn-agent"
                  className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer"
                >
                  <Play className="size-4" />
                  Spawn agent
                </label>
                <Switch
                  id="spawn-agent"
                  size="sm"
                  checked={spawnAgent}
                  onCheckedChange={setSpawnAgent}
                />
              </div>

              {spawnAgent && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {agentTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAgentType(type)}
                        className={`px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2 ${
                          agentType === type
                            ? "border-primary bg-primary/10"
                            : "border-border bg-secondary/50 hover:bg-secondary hover:border-border"
                        }`}
                      >
                        <AgentBadge type={type} size="sm" />
                      </button>
                    ))}
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
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !branchName}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="size-4" />
              {isSubmitting
                ? spawnAgent
                  ? "Creating & Spawning..."
                  : "Creating..."
                : spawnAgent
                  ? "Create & Spawn"
                  : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
