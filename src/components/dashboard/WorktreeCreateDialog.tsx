/**
 * Create Worktree Dialog
 *
 * Dialog form for creating a new git worktree in a project.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Plus } from "lucide-react";
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
import { useTRPC } from "@/integrations/trpc/react";

interface WorktreeCreateDialogProps {
  projectId: string;
  trigger?: React.ReactNode;
}

export function WorktreeCreateDialog({
  projectId,
  trigger,
}: WorktreeCreateDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [createNewBranch, setCreateNewBranch] = useState(true);
  const [baseBranch, setBaseBranch] = useState("");

  const branchesQuery = useQuery(
    trpc.projects.listBranches.queryOptions({ projectId }, { enabled: open }),
  );

  const branches = (branchesQuery.data ?? []).filter((b) => b !== "HEAD");
  const defaultBranch = branches.includes("main") ? "main" : branches[0] ?? "";

  const createMutation = useMutation(
    trpc.worktrees.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.list.queryKey({ projectId }),
        });
        setOpen(false);
        setBranchName("");
        setBaseBranch("");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      projectId,
      branchName,
      createNewBranch,
      baseBranch: createNewBranch ? baseBranch || defaultBranch || undefined : undefined,
    });
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
                <input
                  id="branchName"
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="feature/my-feature"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <select
                  id="branchName"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Select a branch...</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
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
                <select
                  id="baseBranch"
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{defaultBranch || "main"} (default)</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error */}
            {createMutation.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">
                  {createMutation.error?.message ?? "Failed to create worktree"}
                </p>
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
              disabled={createMutation.isPending || !branchName}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="size-4" />
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
