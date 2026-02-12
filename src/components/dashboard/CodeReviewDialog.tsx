/**
 * Code Review Dialog
 *
 * Two-step dialog for starting a batch code review:
 * 1. Select branches (multi-select checkboxes) + base branch
 * 2. Pick agent type and confirm
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, GitBranch, GitMerge, Search } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/integrations/trpc/react";
import type { AgentType } from "@/lib/agents/types";
import { AgentBadge } from "./AgentBadge";

const agentTypes: AgentType[] = ["claude-code", "codex", "gemini"];

interface CodeReviewDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CodeReviewDialog({
  projectId,
  open,
  onOpenChange,
}: CodeReviewDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set(),
  );
  const [baseBranch, setBaseBranch] = useState("");
  const [agentType, setAgentType] = useState<AgentType>("claude-code");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const branchesQuery = useQuery(
    trpc.projects.listBranchesWithStatus.queryOptions(
      { projectId },
      { enabled: open },
    ),
  );

  const startBatchMutation = useMutation(
    trpc.codeReviews.startBatch.mutationOptions(),
  );

  const branches = branchesQuery.data ?? [];
  const defaultBranch =
    branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? "main";
  const effectiveBase = baseBranch || defaultBranch;

  // Non-default branches available for review
  const reviewableBranches = branches.filter((b) => b.name !== effectiveBase);

  const filteredBranches = filter
    ? reviewableBranches.filter((b) =>
        b.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : reviewableBranches;

  const toggleBranch = (name: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedBranches.size === filteredBranches.length) {
      setSelectedBranches(new Set());
    } else {
      setSelectedBranches(new Set(filteredBranches.map((b) => b.name)));
    }
  };

  const resetDialog = () => {
    setStep(1);
    setSelectedBranches(new Set());
    setBaseBranch("");
    setAgentType("claude-code");
    setFilter("");
    setError(null);
  };

  const handleStart = async () => {
    setError(null);
    try {
      await startBatchMutation.mutateAsync({
        projectId,
        baseBranch: effectiveBase,
        branchNames: Array.from(selectedBranches),
        agentType,
      });

      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey({ projectId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.sessions.listSessions.queryKey(),
      });
      onOpenChange(false);
      resetDialog();

      navigate({
        to: "/dashboard/p/$projectId",
        params: { projectId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start review");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetDialog();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-5" />
            Code Review
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Select branches to review"
              : "Pick an agent and start"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 py-2">
            {/* Base branch selector */}
            <div>
              <span className="block text-sm font-medium text-foreground mb-1.5">
                Base Branch
              </span>
              <Select
                value={effectiveBase}
                onValueChange={(val) => {
                  setBaseBranch(val);
                  // Deselect the new base if it was selected
                  setSelectedBranches((prev) => {
                    const next = new Set(prev);
                    next.delete(val);
                    return next;
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                      {b.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter */}
            {reviewableBranches.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter branches..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-input text-foreground text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            )}

            {/* Branch list */}
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
              {filteredBranches.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {selectedBranches.size === filteredBranches.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              )}

              {branchesQuery.isLoading && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  Loading branches...
                </p>
              )}

              {!branchesQuery.isLoading && filteredBranches.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  {filter ? "No matching branches" : "No branches to review"}
                </p>
              )}

              {filteredBranches.map((branch) => {
                const isSelected = selectedBranches.has(branch.name);
                return (
                  <button
                    key={branch.name}
                    type="button"
                    onClick={() => toggleBranch(branch.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer min-w-0 ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-card/50 border border-transparent"
                    }`}
                  >
                    <div
                      className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && (
                        <Check
                          className="size-3 text-primary-foreground"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono truncate">
                      {branch.name}
                    </span>
                    {branch.hasWorktree && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-action-success/10 text-action-success-muted ml-auto shrink-0">
                        worktree
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedBranches.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedBranches.size} branch
                {selectedBranches.size !== 1 ? "es" : ""} selected
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground mb-2">
                Reviewing against{" "}
                <span className="font-mono text-foreground">
                  {effectiveBase}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedBranches).map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-git/10 text-git-muted font-mono max-w-full"
                  >
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate">{name}</span>
                  </span>
                ))}
              </div>
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
        )}

        <DialogFooter>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={selectedBranches.size === 0}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={startBatchMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
              >
                <GitMerge className="size-4" />
                {startBatchMutation.isPending
                  ? "Starting..."
                  : `Review ${selectedBranches.size} branch${selectedBranches.size !== 1 ? "es" : ""}`}
              </button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
