# Project & Git Worktree Management

## Summary

Projects are first-class entities that group agent sessions around a git repository. Combined with git worktree management, this enables the core multi-agent workflow: multiple agents working on the same codebase in parallel, each on its own branch via a dedicated worktree.

Target directory structure:

```
my-project/
  .git/              # bare repo (or regular .git)
  main/              # worktree on main branch
  feature-auth/      # worktree on feature-auth branch
  fix-bug-123/       # worktree on fix-bug-123 branch
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     ProjectManager                            │
│  (singleton, src/lib/projects/project-manager.ts)             │
│                                                               │
│  Project CRUD ──── Worktree Lifecycle ──── Agent Assignments  │
└──────────┬──────────────┬──────────────────┬─────────────────┘
           │              │                  │
     ┌─────▼─────┐  ┌────▼──────┐   ┌──────▼───────┐
     │  SQLite   │  │    git    │   │ AgentManager │
     │ (better-  │  │ (execFile │   │  (existing   │
     │  sqlite3) │  │  wrappers)│   │  singleton)  │
     └───────────┘  └───────────┘   └──────────────┘
```

**Key design decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence | SQLite (better-sqlite3) | Relational data with FK cascades; colocated with existing `.agent-store/` |
| Coupling | Loose — ProjectManager and AgentManager are independent | tRPC layer orchestrates; no circular deps |
| Git commands | `execFile` (not `exec`) | Shell injection prevention; all inputs validated |
| Backward compat | Fully preserved | Existing CWD-based spawn flow works unchanged |

## Data Model

**SQLite schema** (`src/lib/projects/schema.ts`) — stored at `.agent-store/projects.db`:

- **`projects`** — id, name, slug, repo_path, description, settings (JSON), timestamps
- **`worktrees`** — id, project_id (FK), name, path, branch, is_main_worktree, timestamps
- **`agent_worktree_assignments`** — id, session_id, client_id, worktree_id, project_id, created_at
- **`schema_version`** — versioned migrations

Foreign keys cascade on delete: deleting a project removes its worktrees and assignments.

## Server Layer

### ProjectManager (`src/lib/projects/project-manager.ts`)

Singleton accessed via `getProjectManager()`. Provides:

- **Project CRUD**: create, get, getBySlug, list, update, delete
- **Worktree lifecycle**: create, list, delete, getStatus, syncWorktrees
- **Agent assignments**: assign, unassign, query by session/worktree/project
- **Auto-detection**: `importFromDirectory(path)` finds repo root, creates project, syncs worktrees

### Git Operations (`src/lib/projects/git-operations.ts`)

Safe wrappers using `child_process.execFile` with 15s timeout:

- `isGitRepo` / `isBareRepo` / `getRepoRoot`
- `getCurrentBranch` / `getBranchInfo` / `listBranches`
- `listWorktrees` — parses `git worktree list --porcelain`
- `createWorktree` / `removeWorktree`
- `hasUncommittedChanges`
- `validateBranchName` — rejects invalid git ref names

### tRPC Routers

- **`src/server/routers/projects.ts`** — create, list, get, update, delete, importFromDirectory, listBranches, getAssignments
- **`src/server/routers/worktrees.ts`** — list, get, create, delete, getStatus, sync, getAssignments, assignAgent, unassignAgent
- **`src/server/routers/sessions.ts`** — added `getBranchInfo` endpoint; kill/delete now auto-unassign agents

## UI Components

### Pages

| Route | File | Purpose |
|-------|------|---------|
| `/dashboard/projects` | `src/routes/dashboard/projects/index.tsx` | Project list with grid layout |
| `/dashboard/projects/new` | `src/routes/dashboard/projects/new.tsx` | Create project form |
| `/dashboard/projects/$projectId` | `src/routes/dashboard/projects/$projectId.tsx` | Project detail with worktrees |

### Components (`src/components/dashboard/`)

| Component | Purpose |
|-----------|---------|
| `ProjectCard` | Project summary card (worktree count, agent count, link to detail) |
| `WorktreeCard` | Worktree with branch badge, assigned agents, spawn/delete buttons |
| `WorktreeCreateDialog` | Dialog for creating worktrees (new/existing branch, base branch picker) |
| `WorktreeAgentMap` | Grid visualization of all worktrees with their assigned agents |
| `ProjectSpawnFlow` | Compact spawner: pick worktree, pick agent type, auto-assigns |
| `BranchBadge` | Git branch name display (works outside projects too) |

### Integration Points

- **Dashboard overview** (`/dashboard/`) shows a "Projects" quick-access section
- **Sidebar** has a "Projects" nav item
- **ClientCard** shows current git branch + "Add to Projects" button for git repos
- **SessionCard** shows current git branch
- **Session kill/delete** auto-cleans up worktree assignments

## Tests

32 unit tests across two files:

- **`src/lib/projects/git-operations.test.ts`** (19 tests) — branch name validation (13 cases), worktree porcelain parsing with mocked `execFile` (3 cases covering multiple worktrees, bare repos, detached HEAD)
- **`src/lib/projects/project-manager.test.ts`** (13 tests) — in-memory SQLite for fast isolation; covers CRUD, slug uniqueness, agent assignment/unassignment, and directory import

## Files

### New files (21)

```
src/lib/projects/types.ts
src/lib/projects/schema.ts
src/lib/projects/db.ts
src/lib/projects/git-operations.ts
src/lib/projects/project-manager.ts
src/lib/projects/index.ts
src/lib/projects/git-operations.test.ts
src/lib/projects/project-manager.test.ts
src/server/routers/projects.ts
src/server/routers/worktrees.ts
src/hooks/useBranchInfo.ts
src/components/dashboard/BranchBadge.tsx
src/components/dashboard/ProjectCard.tsx
src/components/dashboard/ProjectSpawnFlow.tsx
src/components/dashboard/WorktreeCard.tsx
src/components/dashboard/WorktreeCreateDialog.tsx
src/components/dashboard/WorktreeAgentMap.tsx
src/components/ui/dialog.tsx
src/routes/dashboard/projects/index.tsx
src/routes/dashboard/projects/new.tsx
src/routes/dashboard/projects/$projectId.tsx
```

### Modified files (20)

```
package.json                                    # added better-sqlite3
src/integrations/trpc/router.ts                 # registered new routers
src/server/routers/index.ts                     # exported new routers
src/server/routers/sessions.ts                  # getBranchInfo + assignment cleanup
src/hooks/index.ts                              # exported useBranchInfo
src/components/dashboard/index.ts               # exported new components
src/components/dashboard/Sidebar.tsx            # Projects nav item
src/components/dashboard/ClientCard.tsx         # BranchBadge + import button
src/components/dashboard/SessionCard.tsx        # BranchBadge
src/routes/dashboard/index.tsx                  # Projects quick-access section
+ 10 other files with minor fixes
```
