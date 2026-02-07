/**
 * Branch List
 *
 * Collapsible section showing all branches in a project with status
 * indicators and the ability to delete orphaned branches.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitFork,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { BranchBadge } from "@/components/dashboard/BranchBadge";
import { useTRPC } from "@/integrations/trpc/react";

interface BranchListProps {
  projectId: string;
}

export function BranchList({ projectId }: BranchListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const branchesQuery = useQuery(
    trpc.projects.listBranchesWithStatus.queryOptions(
      { projectId },
      { enabled: expanded },
    ),
  );

  const branches = branchesQuery.data ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-lg font-semibold cursor-pointer group w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <GitBranch className="size-5 text-muted-foreground" />
        Branches
        {expanded && branches.length > 0 && (
          <span className="text-sm text-muted-foreground font-normal">
            ({branches.length})
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1">
          {branchesQuery.isLoading && (
            <p className="text-sm text-muted-foreground px-2 py-3">
              Loading branches...
            </p>
          )}

          {branchesQuery.isError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                {branchesQuery.error?.message ?? "Failed to load branches"}
              </p>
            </div>
          )}

          {!branchesQuery.isLoading && branches.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-3">
              No branches found
            </p>
          )}

          {branches.map((branch) => (
            <BranchRow
              key={branch.name}
              branch={branch}
              projectId={projectId}
              queryClient={queryClient}
              trpc={trpc}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Branch Row
// =============================================================================

function BranchRow({
  branch,
  projectId,
  queryClient,
  trpc,
}: {
  branch: {
    name: string;
    isDefault: boolean;
    hasWorktree: boolean;
    worktreeId?: string;
  };
  projectId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  trpc: ReturnType<typeof useTRPC>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showForce, setShowForce] = useState(false);

  const invalidateBranches = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.projects.listBranchesWithStatus.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.projects.listBranches.queryKey({ projectId }),
    });
  };

  const deleteMutation = useMutation(
    trpc.projects.deleteBranch.mutationOptions({
      onSuccess: () => {
        setError(null);
        setShowForce(false);
        invalidateBranches();
      },
      onError: (err) => {
        const msg = err.message ?? "Failed to delete branch";
        setError(msg);
        // If the error mentions "not fully merged", offer force delete
        if (msg.toLowerCase().includes("not fully merged")) {
          setShowForce(true);
        }
      },
    }),
  );

  const canDelete = !branch.isDefault && !branch.hasWorktree;

  return (
    <div className="px-3 py-2 rounded-lg hover:bg-card/50 transition-colors">
      <div className="flex items-center gap-3">
        <BranchBadge branch={branch.name} size="sm" />

        {branch.isDefault && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            default
          </span>
        )}

        {branch.hasWorktree && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium inline-flex items-center gap-1">
            <GitFork className="size-3" />
            worktree
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {showForce && (
            <button
              type="button"
              onClick={() =>
                deleteMutation.mutate({
                  projectId,
                  branchName: branch.name,
                  force: true,
                })
              }
              disabled={deleteMutation.isPending}
              className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              Force delete
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowForce(false);
                deleteMutation.mutate({
                  projectId,
                  branchName: branch.name,
                });
              }}
              disabled={deleteMutation.isPending}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
              title={`Delete branch ${branch.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive mt-1.5 pl-1">{error}</p>}
    </div>
  );
}
