# Project-Centric UI Redesign

## Summary

Redesigned the sidebar, overview, and session list to make projects the first-class organizing principle. Previously these components treated sessions/clients as primary objects. After this redesign, everything is scoped to a project context.

Key design decision: **fully project-centric, no dual workflow.** No special-cased projects — if users want a "scratchpad" for quick tasks, they create it as a normal project.

## What Changed

### Routes

| Old | New | Notes |
|-----|-----|-------|
| `/dashboard` | `/dashboard` | Rewritten as project grid + onboarding |
| `/dashboard/projects` | removed | Merged into `/dashboard` |
| `/dashboard/projects/new` | `/dashboard/projects/new` | Unified add-project flow (single form) |
| `/dashboard/projects/$projectId` | `/dashboard/p/$projectId` | Project overview with worktree grid |
| — | `/dashboard/p/$projectId/sessions` | Project-scoped session list |
| — | `/dashboard/p/$projectId/sessions/$sessionId` | Project-scoped session detail |
| — | `/dashboard/p/$projectId/approvals` | Project-scoped approvals |
| `/dashboard/sessions` | removed | Replaced by project-scoped sessions |
| `/dashboard/sessions/$sessionId` | kept as fallback | Used by global sidebar active-agent links |
| `/dashboard/approvals` | removed | Replaced by project-scoped approvals |

### Components

| Component | Change |
|-----------|--------|
| `Sidebar` | Full rewrite — `ProjectSwitcher` dropdown, dual-mode nav (global vs project-scoped), worktree-grouped active agents |
| `DashboardLayout` | Minor — pass project context down |
| Home page (`/dashboard`) | Full rewrite — project cards grid with stats bar, or onboarding when no projects |
| Project overview (`/dashboard/p/$projectId`) | New — worktree grid, inline spawn per worktree, recent activity timeline |
| Session list | Rewrite — project-scoped with worktree grouping, collapsible sections |
| Approvals | Rewrite — project-scoped with live SSE updates |
| `SessionCard` | Added optional `projectId` prop for project-scoped links |
| `SessionHeader` | Added `backTo` prop for context-aware back navigation |
| `ProjectCard` | Updated link to `/dashboard/p/$projectId` |
| `projects/new.tsx` | Unified create/import into single "Add Project" flow using `importFromDirectory` |

### Server

- `listSessions` tRPC endpoint: added optional `projectId` filter
- `approvals.list` tRPC endpoint: added optional `projectId` filter
- `importFromDirectory`: extended to accept optional `{ name, description }` overrides

## Implementation Phases

### Phase 1: Foundation (server + routing)
- Server query filters for `projectId`
- Route structure for `/dashboard/p/$projectId` tree
- `useCurrentProject` hook reading from route params

Commit: `cdd034b`

### Phase 2: Sidebar Rewrite
- `ProjectSwitcher` component with searchable popover
- Dual-mode contextual navigation
- Active agents grouped by worktree
- Footer "Home" link in project context

Commit: `486496c`

### Phase 3: Home Page
- Project cards grid with stats bar (projects, active agents, pending approvals)
- Onboarding view when no projects exist
- Merged create/import into single add-project flow

Commits: `d9280d6`, `fa712db`

### Phase 4: Project Overview
- Project header with name/path/description
- Worktree card grid with create dialog
- Inline spawn flow (pick worktree → pick agent type → spawn)
- Recent activity timeline from project-scoped sessions

Commit: `252d6ce`

### Phase 5: Session List & Approvals
- Project-scoped session list with worktree grouping (collapsible sections)
- Status filter + search within project sessions
- Project-scoped approvals page with approve/deny

Commit: `0a029cf`

### Phase 6: Cleanup
- Removed old routes: `/dashboard/sessions/index`, `/dashboard/approvals`, `/dashboard/projects/index`, `/dashboard/projects/$projectId`
- Updated all internal links to new route structure
- Kept `/dashboard/sessions/$sessionId` as fallback for global sidebar links

Commit: `3cdd367`

## Stats

- 26 files changed, +2050 / -1194 lines
- Merged to `main` via fast-forward
