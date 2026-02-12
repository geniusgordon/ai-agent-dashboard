# Move Git Push/Pull to Worktree Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move git push from session quick actions to the worktree detail page, add git pull, and remove session-level push.

**Architecture:** Add `pullFromRemote()` git operation, create `worktrees.pushToOrigin` and `worktrees.pullFromOrigin` tRPC endpoints that operate on worktree IDs, add Push/Pull buttons to the worktree detail page, and remove all session-level push code.

**Tech Stack:** TanStack Start, tRPC, simple-git, React, Tailwind CSS, lucide-react

---

### Task 1: Add `pullFromRemote()` git operation

**Files:**
- Modify: `src/lib/projects/git-operations.ts` (after `pushToRemote` at ~line 860)
- Modify: `src/lib/projects/index.ts` (add export)

**Step 1: Add `pullFromRemote` function**

In `src/lib/projects/git-operations.ts`, add after the `pushToRemote` function:

```typescript
export async function pullFromRemote(
  worktreePath: string,
  branchName?: string,
): Promise<{ success: boolean; error?: string }> {
  if (branchName) validateBranchName(branchName);

  const sg = getGit(worktreePath);
  try {
    const args: string[] = ["origin"];
    if (branchName) args.push(branchName);
    await sg.pull(args);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
```

**Step 2: Export from barrel**

In `src/lib/projects/index.ts`, add `pullFromRemote` to the re-exports from `./git-operations.js` (next to `pushToRemote`).

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/projects/git-operations.ts src/lib/projects/index.ts
git commit -m "feat: add pullFromRemote git operation"
```

---

### Task 2: Add worktree push/pull tRPC endpoints

**Files:**
- Modify: `src/server/routers/worktrees.ts`

**Step 1: Add imports**

In `src/server/routers/worktrees.ts`, add `pushToRemote` and `pullFromRemote` to the imports from `../../lib/projects/index.js`. Also add `expandPath` from `../../lib/utils/expand-path.js`.

Current import:
```typescript
import {
  getCommitsSinceBranch,
  getDefaultBranch,
  getProjectManager,
  getRecentCommits,
} from "../../lib/projects/index.js";
```

Update to:
```typescript
import {
  getCommitsSinceBranch,
  getDefaultBranch,
  getProjectManager,
  getRecentCommits,
  pullFromRemote,
  pushToRemote,
} from "../../lib/projects/index.js";
```

Also add to the existing `expand-path` import:
```typescript
import { collapsePath, expandPath } from "../../lib/utils/expand-path.js";
```

**Step 2: Add endpoints**

Add these two endpoints to the `worktreesRouter` (after the `detectDocuments` endpoint, before the closing `});`):

```typescript
  pushToOrigin: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      const worktree = manager.getWorktree(input.id);
      if (!worktree) throw new Error(`Worktree not found: ${input.id}`);

      const result = await pushToRemote(
        expandPath(worktree.path),
        worktree.branch,
        true,
      );

      if (!result.success) {
        throw new Error(result.error ?? "Push failed");
      }

      return { success: true };
    }),

  pullFromOrigin: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const manager = getProjectManager();
      const worktree = manager.getWorktree(input.id);
      if (!worktree) throw new Error(`Worktree not found: ${input.id}`);

      const result = await pullFromRemote(
        expandPath(worktree.path),
        worktree.branch,
      );

      if (!result.success) {
        throw new Error(result.error ?? "Pull failed");
      }

      return { success: true };
    }),
```

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/routers/worktrees.ts
git commit -m "feat: add worktree push/pull tRPC endpoints"
```

---

### Task 3: Remove session-level push

**Files:**
- Modify: `src/server/routers/sessions.ts` (~lines 832-849: delete `pushToOrigin` endpoint, remove `pushToRemote` import)
- Modify: `src/hooks/useSessionDetail.ts` (remove `pushToOriginMutation`, `pushToOrigin` callback, `isPushing` return, and references in `reset` effect)
- Modify: `src/components/dashboard/SessionDetailView.tsx` (remove `isPushing`, `pushToOrigin` destructuring from `useSessionDetail`, remove `onPushToOrigin`/`isPushing` from `QuickActionsBar` actions prop)
- Modify: `src/components/dashboard/QuickActionsBar.tsx` (remove `onPushToOrigin`/`isPushing` from `QuickActions` interface, remove Push button JSX, remove push confirmation dialog, remove `Upload` icon import, remove `pushConfirmOpen` state)

**Step 1: Remove `sessions.pushToOrigin` endpoint**

In `src/server/routers/sessions.ts`:
- Delete the `pushToOrigin` endpoint (the block starting with `pushToOrigin: publicProcedure` through its closing `}),`)
- Remove `pushToRemote` from the imports from `../../lib/projects/index.js`

**Step 2: Remove push from `useSessionDetail.ts`**

In `src/hooks/useSessionDetail.ts`:
- Delete the `pushToOriginMutation` definition (the `useMutation(trpc.sessions.pushToOrigin.mutationOptions(...))` block)
- Delete the `pushToOrigin` callback (`const pushToOrigin = () => ...`)
- Remove `isPushing: pushToOriginMutation.isPending,` from the return object
- Remove `pushToOrigin,` from the return object
- Remove `pushToOriginMutation.reset();` from the session-switch reset effect
- Remove `pushToOriginMutation,` from the reset effect dependency array

**Step 3: Remove push from `SessionDetailView.tsx`**

In `src/components/dashboard/SessionDetailView.tsx`:
- Remove `isPushing` and `pushToOrigin` from the `useSessionDetail` destructuring
- Remove `onPushToOrigin: pushToOrigin,` and `isPushing,` from the `QuickActionsBar` actions prop

**Step 4: Remove push from `QuickActionsBar.tsx`**

In `src/components/dashboard/QuickActionsBar.tsx`:
- Remove `onPushToOrigin?: () => void;` and `isPushing?: boolean;` from the `QuickActions` interface
- Remove `Upload` from the lucide-react import
- Remove the `[pushConfirmOpen, setPushConfirmOpen]` state
- Remove the Push button JSX block (`{/* Push */} {actions.onPushToOrigin && (...)}`)
- Remove the push `ConfirmDialog` JSX block

**Step 5: Verify types and lint**

Run: `pnpm typecheck && pnpm check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/server/routers/sessions.ts src/hooks/useSessionDetail.ts src/components/dashboard/SessionDetailView.tsx src/components/dashboard/QuickActionsBar.tsx
git commit -m "refactor: remove session-level git push"
```

---

### Task 4: Add Push/Pull buttons to worktree detail page

**Files:**
- Modify: `src/routes/dashboard/p/$projectId/worktrees/$worktreeId.tsx`

**Step 1: Add imports and mutations**

Add to the lucide-react import: `Download`, `Upload`, `Loader2`.

Add `toast` import:
```typescript
import { toast } from "sonner";
```

Add `ConfirmDialog` to the dashboard imports:
```typescript
import { ConfirmDialog } from "@/components/dashboard";
```

**Step 2: Add mutations and state to `WorktreeDetailPage`**

Inside the `WorktreeDetailPage` component, after the existing `sessionDelete` mutation, add:

```typescript
// ---- Git push/pull ----
const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
const [pullConfirmOpen, setPullConfirmOpen] = useState(false);

const pushMutation = useMutation(
  trpc.worktrees.pushToOrigin.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getStatus.queryKey({ id: worktreeId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getRecentCommits.queryKey({ id: worktreeId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getBranchCommits.queryKey({ id: worktreeId }),
      });
      toast.success("Pushed to origin");
    },
    onError: (error) => {
      toast.error("Push failed", { description: error.message });
    },
  }),
);

const pullMutation = useMutation(
  trpc.worktrees.pullFromOrigin.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getStatus.queryKey({ id: worktreeId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getRecentCommits.queryKey({ id: worktreeId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.worktrees.getBranchCommits.queryKey({ id: worktreeId }),
      });
      toast.success("Pulled from origin");
    },
    onError: (error) => {
      toast.error("Pull failed", { description: error.message });
    },
  }),
);
```

**Step 3: Add Push/Pull buttons to the header actions area**

In the `{/* Actions */}` div (which currently has Spawn Agent and Delete buttons), add Push and Pull buttons before the Spawn Agent button:

```tsx
{/* Actions */}
<div className="flex items-center gap-2 shrink-0">
  <button
    type="button"
    disabled={pullMutation.isPending}
    onClick={() => setPullConfirmOpen(true)}
    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {pullMutation.isPending ? (
      <Loader2 className="size-3.5 animate-spin" />
    ) : (
      <Download className="size-3.5" />
    )}
    Pull
  </button>

  <button
    type="button"
    disabled={pushMutation.isPending}
    onClick={() => setPushConfirmOpen(true)}
    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {pushMutation.isPending ? (
      <Loader2 className="size-3.5 animate-spin" />
    ) : (
      <Upload className="size-3.5" />
    )}
    Push
  </button>

  <button
    type="button"
    onClick={() => setShowSpawnDialog(true)}
    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-action-success/20 text-action-success-hover border border-action-success/30 hover:bg-action-success/30 transition-colors cursor-pointer inline-flex items-center gap-1.5"
  >
    <Play className="size-3.5" />
    Spawn Agent
  </button>

  {!worktree.isMainWorktree && (
    <button
      type="button"
      onClick={() => setShowDeleteDialog(true)}
      className="px-3 py-1.5 rounded-lg text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer"
    >
      Delete
    </button>
  )}
</div>
```

**Step 4: Add confirmation dialogs**

Add the two `ConfirmDialog` instances after the existing `SessionDeleteDialog`, before the closing `</div>` of the page:

```tsx
{/* Push confirm */}
<ConfirmDialog
  open={pushConfirmOpen}
  onOpenChange={setPushConfirmOpen}
  title="Push to Origin"
  description={`Push ${worktree.branch} to origin?`}
  confirmLabel="Push"
  onConfirm={() => {
    setPushConfirmOpen(false);
    pushMutation.mutate({ id: worktreeId });
  }}
/>

{/* Pull confirm */}
<ConfirmDialog
  open={pullConfirmOpen}
  onOpenChange={setPullConfirmOpen}
  title="Pull from Origin"
  description={`Pull latest changes from origin into ${worktree.branch}?`}
  confirmLabel="Pull"
  onConfirm={() => {
    setPullConfirmOpen(false);
    pullMutation.mutate({ id: worktreeId });
  }}
/>
```

**Step 5: Verify types, lint, and build**

Run: `pnpm typecheck && pnpm check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/dashboard/p/\$projectId/worktrees/\$worktreeId.tsx
git commit -m "feat: add push/pull buttons to worktree detail page"
```

---

### Task 5: Final validation

**Step 1: Run full validation**

Run: `pnpm validate`
Expected: PASS (typecheck + lint + tests)

**Step 2: Commit plan doc cleanup**

Remove the design doc since it's been implemented:
```bash
git rm docs/plans/2026-02-13-move-git-push-pull-to-worktree-design.md
git rm docs/plans/2026-02-13-move-git-push-pull-to-worktree.md
git commit -m "chore: remove completed plan docs"
```
