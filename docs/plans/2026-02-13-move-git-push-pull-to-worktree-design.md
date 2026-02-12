# Move Git Push to Worktree Page + Add Git Pull

## Summary

Move git push from session quick actions bar to the worktree detail page and add git pull. Push/pull are worktree-level operations, not session-level.

## Changes

### 1. New git operation — `pullFromRemote()`

In `src/lib/projects/git-operations.ts`, add `pullFromRemote(worktreePath, branchName?)` mirroring `pushToRemote()`. Runs `git pull origin <branch>`. Returns `{ success: boolean; error?: string }`.

### 2. New tRPC endpoints in `worktrees.ts` router

- `worktrees.pushToOrigin` — input: `{ id: string }`, looks up worktree path + branch, calls `pushToRemote()`
- `worktrees.pullFromOrigin` — input: `{ id: string }`, looks up worktree path + branch, calls `pullFromRemote()`

### 3. Remove session-level push

- Delete `sessions.pushToOrigin` endpoint
- Remove `onPushToOrigin` / `isPushing` from `QuickActionsBar` props and UI
- Remove push mutation and callback from `useSessionDetail.ts`
- Remove push wiring from `SessionDetailView.tsx`

### 4. Worktree detail page UI

Add Push and Pull buttons to the worktree detail page (`$worktreeId.tsx`) near the git status area. Each gets a confirmation dialog. On success: invalidate worktree status/commits queries, show toast. On error: show error toast.

## What stays the same

- `pushToRemote()` in `git-operations.ts` — unchanged, called from worktrees router instead
- Commit, Merge, PR, Review, Doc actions remain on session quick actions bar
