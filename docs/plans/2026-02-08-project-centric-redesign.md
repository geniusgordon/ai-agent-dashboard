# Project-Centric UI Redesign

## Summary

Redesign the sidebar, overview, and session list to make projects the first-class organizing principle. Currently these components were built before project management existed and treat sessions/clients as primary objects. After this redesign, everything is scoped to a project context.

Key design decision: **fully project-centric, no dual workflow.** No special-cased projects — if users want a "scratchpad" for quick tasks, they create it as a normal project.

## Design

### Home Page (`/dashboard`)

The root landing page. Behavior depends on whether projects exist:

**Empty state (no projects):**
- Welcome message / onboarding
- "Import a git repository" button — triggers directory picker + auto-import
- "Create a new project" button — links to project creation
- Brief explanation of the project-centric workflow

**With projects:**
- Project cards grid (existing `ProjectCard` component, enhanced)
- Summary stats bar: total projects, active agents, pending approvals
- "+ New Project" action
- Each card shows: name, branch count, active agent count, last activity

### Sidebar

**Project Switcher (top):**
- Dropdown showing current project name + icon
- Popover with searchable project list, "+ New Project" action
- Below name: repo path (muted), worktree count summary
- Only visible when inside a project context (i.e., on `/dashboard/p/...` routes)

**Contextual Navigation (middle):**
When inside a project — scoped nav:
- **Overview** — project home (worktrees, spawn, activity)
- **Sessions** — sessions within this project
- **Approvals** — pending approvals for this project's agents

When on the home page (`/dashboard`) — global nav:
- **Home** — the all-projects view
- **New Project** — create/import

**Active Agents (bottom):**
When inside a project — running agents grouped by worktree:
```
feature-auth/
  ● Claude Code — running
  ● Gemini — idle
main/
  ● Codex — waiting approval
```
Each entry links to its session.

When on home page — shows agents across all projects (flat list, limited).

**Footer:**
- Theme toggle (unchanged)
- "Home" link when inside a project (quick way back to all-projects view)

### Project Overview (`/dashboard/p/$projectId`)

The project home page when a project is selected:

**Project Header:**
- Project name, repo path, description
- Edit/settings button

**Worktree Grid:**
- Card per worktree showing: branch name, active agent count, worktree status (clean/dirty)
- "+" card to create new worktree
- Each card expandable or clickable to show agents and spawn new ones

**Spawn Agent (inline per worktree):**
- Pick worktree → pick agent type → spawn
- Replaces the current top-level spawn section with directory input

**Recent Activity:**
- Timeline of recent events across this project's sessions
- Compact: "Claude Code completed on feature-auth — 5m ago"

### Session List (Project-Scoped, `/dashboard/p/$projectId/sessions`)

**Grouping:**
- Sessions grouped by worktree (collapsible sections)
- Each group header shows worktree branch name + agent count
- Within each group: session cards sorted by recency

**Filters:**
- Status filter (All / Running / Completed) — same as now but project-scoped
- Search within project sessions

**Empty State:**
- "No sessions in this project. Spawn an agent from the Overview."

### Approvals (Project-Scoped, `/dashboard/p/$projectId/approvals`)

Same as current approvals page but filtered to the selected project's agents.

## Architecture Changes

### State: Selected Project

- Project ID lives in the URL via route params (`$projectId`)
- Sidebar reads from route params to determine context (project vs. home)
- No localStorage needed — URL is the source of truth

### Route Changes

| Current | New | Purpose |
|---------|-----|---------|
| `/dashboard` | `/dashboard` | Home — all projects grid / onboarding |
| `/dashboard/projects` | removed | Merged into `/dashboard` |
| `/dashboard/projects/new` | `/dashboard/projects/new` | Keep (or make it a dialog) |
| `/dashboard/projects/$projectId` | `/dashboard/p/$projectId` | Project home (overview) |
| — | `/dashboard/p/$projectId/sessions` | Project sessions |
| — | `/dashboard/p/$projectId/sessions/$sessionId` | Session detail |
| — | `/dashboard/p/$projectId/approvals` | Project approvals |
| `/dashboard/sessions` | removed | Replaced by project-scoped sessions |
| `/dashboard/sessions/$sessionId` | removed | Moved under project scope |
| `/dashboard/approvals` | removed | Replaced by project-scoped approvals |

### Server Changes

- **Session queries**: Add `projectId` filter to `listSessions` tRPC endpoint
- **Approval queries**: Add `projectId` filter to approvals endpoint
- **Auto-import on spawn**: When spawning in a directory, auto-import as project if not already one

### Component Changes

| Component | Change |
|-----------|--------|
| `Sidebar` | Full rewrite — project switcher, contextual nav, worktree-grouped agents |
| `DashboardLayout` | Minor — pass project context down |
| Overview page (`/dashboard`) | Full rewrite — home page with project grid / onboarding |
| New: project overview | Project home with worktree grid |
| Session list page | Rewrite — project-scoped with worktree grouping |
| `SessionCard` | Minor tweaks — remove redundant project info when in project context |
| `ClientCard` | Refactor into spawn flow within worktree cards |
| New: `ProjectSwitcher` | Dropdown + popover component |
| New: `WorktreeSection` | Collapsible worktree group for session list |

## Implementation Plan

### Phase 1: Foundation (server + routing) — DONE

1. ~~**Server query filters** — Add `projectId` parameter to `listSessions` and approval queries in tRPC routers~~
2. ~~**Route structure** — Create new route files for `/dashboard/p/$projectId` (layout), `/dashboard/p/$projectId/index`, `/dashboard/p/$projectId/sessions/index`, `/dashboard/p/$projectId/sessions/$sessionId`, `/dashboard/p/$projectId/approvals`~~
3. ~~**Project context** — Create a `useCurrentProject` hook that reads project ID from route params and provides project data to child components~~

Commit: `cdd034b` — `feat: add project-scoped routes and server filters (Phase 1)`

### Phase 2: Sidebar Rewrite — DONE

4. ~~**ProjectSwitcher component** — Dropdown with popover, project list, search~~
5. ~~**Contextual navigation** — Dual-mode nav: global (home) vs. project-scoped~~
6. ~~**Active agents by worktree** — Replace "Active Sessions" section with worktree-grouped agent list~~
7. ~~**Footer "Home" link** — When inside a project, quick nav back to home~~

Commit: `486496c` — `feat: rewrite sidebar with project switcher and dual-mode nav (Phase 2)`

### Phase 3: Home Page — DONE

8. ~~**Home page rewrite** — Project cards grid with stats when projects exist~~
9. ~~**Empty/onboarding state** — Welcome flow when no projects exist, import + create actions~~

Commit: `d9280d6` — `feat: rewrite home page as project grid with onboarding (Phase 3)`

### Phase 4: Project Overview Page — DONE

10. ~~**Project home page** — Header, worktree grid, recent activity~~
11. ~~**Worktree cards** — Branch name, status, agent count, spawn button~~
12. ~~**Inline spawn flow** — Pick worktree → pick agent type → spawn (replaces current top-level spawner)~~

Commit: `252d6ce` — `feat: build project overview with worktree grid and inline spawn (Phase 4)`

### Phase 5: Session List & Approvals — DONE

13. ~~**Project-scoped session list** — Sessions grouped by worktree with collapsible sections~~
14. ~~**Project-scoped approvals** — Filtered approval list~~
15. ~~**Session detail** — Move under project route, keep existing functionality~~ (done in Phase 1)

Commit: `0a029cf` — `feat: project-scoped session list and approvals pages (Phase 5)`

### Phase 6: Cleanup

16. **Remove old routes** — Delete `/dashboard/sessions`, `/dashboard/approvals`, `/dashboard/projects` routes
17. **Update all internal links** — Sidebar, cards, breadcrumbs all point to new routes
18. **Mobile responsiveness** — Test and fix sidebar/overview on mobile
