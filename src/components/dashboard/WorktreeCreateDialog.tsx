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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [branchPrefix, setBranchPrefix] = useState("feat");
  const [branchName, setBranchName] = useState("");
  const [createNewBranch, setCreateNewBranch] = useState(true);
  const [baseBranch, setBaseBranch] = useState("");

  const branchPrefixes = ["feat", "fix", "hotfix", "release", "chore"] as const;
  const fullBranchName = createNewBranch
    ? `${branchPrefix}/${branchName}`
    : branchName;

  const branchesQuery = useQuery(
    trpc.projects.listBranches.queryOptions({ projectId }, { enabled: open }),
  );

  const branches = (branchesQuery.data ?? []).filter((b) => b !== "HEAD");
  const defaultBranch = branches.includes("main")
    ? "main"
    : (branches[0] ?? "");

  const createMutation = useMutation(
    trpc.worktrees.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.worktrees.list.queryKey({ projectId }),
        });
        setOpen(false);
        setBranchPrefix("feat");
        setBranchName("");
        setBaseBranch("");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createMutation.mutate({
      projectId,
      branchName: fullBranchName,
      createNewBranch,
      baseBranch: createNewBranch
        ? baseBranch || defaultBranch || undefined
        : undefined,
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
