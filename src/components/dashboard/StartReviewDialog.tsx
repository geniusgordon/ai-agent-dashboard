/**
 * Start Review Dialog
 *
 * Simplified single-branch code review dialog for use from SessionDetailView.
 * Skips branch selection since the branch is already known — user just picks
 * an agent type and confirms.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch, GitMerge } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
import { AgentBadge } from "./AgentBadge";

const agentTypes: AgentType[] = ["claude-code", "codex", "gemini"];

interface StartReviewDialogProps {
  projectId: string;
  branch: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartReviewDialog({
  projectId,
  branch,
  open,
  onOpenChange,
}: StartReviewDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [agentType, setAgentType] = useState<AgentType>("claude-code");
  const [error, setError] = useState<string | null>(null);

  const branchesQuery = useQuery(
    trpc.projects.listBranchesWithStatus.queryOptions(
      { projectId },
      { enabled: open },
    ),
  );

  const defaultBranch =
    branchesQuery.data?.find((b) => b.isDefault)?.name ?? "main";

  const startBatchMutation = useMutation(
    trpc.codeReviews.startBatch.mutationOptions(),
  );

  const reset = () => {
    setAgentType("claude-code");
    setError(null);
  };

  const handleStart = async () => {
    setError(null);
    try {
      await startBatchMutation.mutateAsync({
        projectId,
        baseBranch: defaultBranch,
        branchNames: [branch],
        agentType,
      });

      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.codeReviews.list.queryKey({ projectId }),
      });

      onOpenChange(false);
      reset();

      // Navigate to the project page where the review panel shows
      navigate({
        to: "/dashboard/p/$projectId",
        params: { projectId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start review");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-5" />
            Code Review
          </DialogTitle>
          <DialogDescription>
            Review this branch with an AI agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Branch summary */}
          <div className="p-3 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground mb-1.5">
              Reviewing against{" "}
              <span className="font-mono text-foreground">{defaultBranch}</span>
            </p>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 font-mono">
              <GitBranch className="size-3" />
              {branch}
            </span>
          </div>

          {/* Agent type */}
          <div>
            <span className="block text-sm font-medium text-foreground mb-2">
              Agent Type
            </span>
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
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleStart}
            disabled={startBatchMutation.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
          >
            <GitMerge className="size-4" />
            {startBatchMutation.isPending ? "Starting..." : "Start Review"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
