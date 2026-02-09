/**
 * Add Project Page
 *
 * Single flow: enter a directory path → auto-detect git repo → optionally
 * override name/description → add project. Uses importFromDirectory which
 * resolves the repo root, deduplicates, and syncs worktrees automatically.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FolderGit2 } from "lucide-react";
import { useState } from "react";
import { ErrorDisplay, PageContainer } from "@/components/dashboard";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/projects/new")({
  component: AddProjectPage,
});

function AddProjectPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [dirPath, setDirPath] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const importMutation = useMutation(
    trpc.projects.importFromDirectory.mutationOptions({
      onSuccess: (project) => {
        queryClient.invalidateQueries({
          queryKey: trpc.projects.list.queryKey(),
        });
        navigate({
          to: "/dashboard/p/$projectId",
          params: { projectId: project.id },
        });
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    importMutation.mutate({
      dirPath,
      name: name || undefined,
      description: description || undefined,
    });
  };

  return (
    <PageContainer maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Project</h1>
            <p className="text-muted-foreground mt-1">
              Point to a git repository to add it as a project
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="p-6 rounded-xl border border-border bg-card/30 space-y-4">
            {/* Directory Path */}
            <div>
              <label
                htmlFor="dirPath"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Repository Path
              </label>
              <input
                id="dirPath"
                type="text"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                placeholder="/path/to/your/repo"
                required
                className="w-full px-4 py-2 rounded-lg bg-background border border-input text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Any path inside a git repository — the repo root is detected
                automatically
              </p>
            </div>

            {/* Name (optional override) */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Project Name
                <span className="text-muted-foreground font-normal ml-1">
                  (optional)
                </span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Defaults to directory name"
                className="w-full px-4 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Description
                <span className="text-muted-foreground font-normal ml-1">
                  (optional)
                </span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this project..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>

          {/* Error */}
          {importMutation.isError && (
            <ErrorDisplay
              error={importMutation.error}
              title="Failed to add project"
              onRetry={() => importMutation.reset()}
            />
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={importMutation.isPending || !dirPath}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 cursor-pointer"
          >
            <FolderGit2 className="size-4" />
            {importMutation.isPending ? "Adding..." : "Add Project"}
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
