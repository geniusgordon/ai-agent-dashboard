/**
 * Create Project Page
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FolderGit2, Import } from "lucide-react";
import { useState } from "react";
import { ErrorDisplay } from "@/components/dashboard/ErrorDisplay";
import { useTRPC } from "@/integrations/trpc/react";

export const Route = createFileRoute("/dashboard/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (project) => {
        queryClient.invalidateQueries({
          queryKey: trpc.projects.list.queryKey(),
        });
        navigate({
          to: "/dashboard/projects/$projectId",
          params: { projectId: project.id },
        });
      },
    }),
  );

  const importMutation = useMutation(
    trpc.projects.importFromDirectory.mutationOptions({
      onSuccess: (project) => {
        queryClient.invalidateQueries({
          queryKey: trpc.projects.list.queryKey(),
        });
        navigate({
          to: "/dashboard/projects/$projectId",
          params: { projectId: project.id },
        });
      },
    }),
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      repoPath,
      description: description || undefined,
    });
  };

  const handleImport = () => {
    if (!repoPath) return;
    importMutation.mutate({ dirPath: repoPath });
  };

  const isPending = createMutation.isPending || importMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard/projects"
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
          <p className="text-muted-foreground mt-1">
            Add a git repository as a project
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleCreate} className="space-y-5">
        <div className="p-6 rounded-xl border border-border bg-card/30 space-y-4">
          {/* Repo Path */}
          <div>
            <label
              htmlFor="repoPath"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Repository Path
            </label>
            <input
              id="repoPath"
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/path/to/your/repo"
              required
              className="w-full px-4 py-2 rounded-lg bg-background border border-input text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Absolute path to a git repository (bare or regular)
            </p>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Project Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              required
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
        {(createMutation.isError || importMutation.isError) && (
          <ErrorDisplay
            error={createMutation.error || importMutation.error}
            title="Failed to create project"
            onRetry={() => {
              createMutation.reset();
              importMutation.reset();
            }}
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !name || !repoPath}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 cursor-pointer"
          >
            <FolderGit2 className="size-4" />
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={isPending || !repoPath}
            className="px-5 py-2.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 cursor-pointer"
          >
            <Import className="size-4" />
            {importMutation.isPending ? "Importing..." : "Import from Path"}
          </button>
        </div>
      </form>
    </div>
  );
}
