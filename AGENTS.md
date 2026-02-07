# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A dashboard for managing AI coding agents (Gemini CLI, Claude Code, Codex) through the Agent Client Protocol (ACP). Built with TanStack Start (SSR React framework) + tRPC + Tailwind CSS v4.

## Commands

```bash
pnpm dev              # Start dev server on port 3000
pnpm build            # Production build
pnpm test             # Run tests (vitest)
pnpm test -- src/path/to/file.test.ts  # Run a single test file
pnpm typecheck        # TypeScript check (tsc --noEmit)
pnpm check            # Biome lint + format (auto-fix)
pnpm check:ci         # Biome lint + format (check only, CI)
pnpm validate         # typecheck + check:ci + test (full CI pipeline)
```

## Code Style

- **Formatter/Linter**: Biome (not ESLint/Prettier). Run `pnpm check` to auto-fix.
- **Indent**: 2 spaces, double quotes for JS/TS strings.
- **Imports**: Use `@/` path alias for `src/` (e.g., `import { foo } from "@/lib/foo"`).
- **React Compiler**: Enabled via `babel-plugin-react-compiler` — avoid manual `useMemo`/`useCallback` for render optimization; the compiler handles it.
- Biome ignores `src/routeTree.gen.ts` and `src/styles.css` (auto-generated files).

## Architecture

### Full-Stack SSR with TanStack Start

This is a **TanStack Start** app (not plain Vite/React). It uses **Nitro** as the server runtime and supports SSR. The Vite config includes `tanstackStart()` and `nitro()` plugins.

### Routing (File-Based)

Routes live in `src/routes/` and follow TanStack Router's file-based convention. The route tree is auto-generated into `src/routeTree.gen.ts` — never edit this file.

- `__root.tsx` — Root layout, provides QueryClient + tRPC context
- `dashboard/route.tsx` — Dashboard layout with nav (wraps child routes via `<Outlet />`)
- `dashboard/index.tsx` — Overview: spawn clients, manage sessions
- `dashboard/sessions/index.tsx` — Session list
- `dashboard/sessions/$sessionId.tsx` — Session detail with live streaming logs
- `dashboard/approvals.tsx` — Pending approval requests
- `api.events.ts` — SSE endpoint for real-time events (server handler)
- `api.trpc.$.tsx` — tRPC catch-all API route

### Server Layer (tRPC)

- **Init**: `src/integrations/trpc/init.ts` — tRPC setup with superjson transformer
- **Router**: `src/integrations/trpc/router.ts` — Combines sub-routers
- **Client hook**: `src/integrations/trpc/react.ts` — `useTRPC()` hook via `@trpc/tanstack-react-query`
- **Sub-routers** in `src/server/routers/`:
  - `sessions.ts` — Client/session CRUD, message sending, kill/cleanup (also auto-unassigns agents from worktrees)
  - `approvals.ts` — List/approve/deny permission requests
  - `projects.ts` — Project CRUD, import from directory, list branches
  - `worktrees.ts` — Worktree CRUD, sync, status, agent assignments

### ACP Client Layer (`src/lib/acp/`)

Low-level ACP protocol implementation. `ACPClient` spawns agent processes (Gemini/Claude Code/Codex) as child processes, communicates over stdin/stdout using ND-JSON streams via `@agentclientprotocol/sdk`.

- `client.ts` — `ACPClient` class: spawns agent, manages sessions, handles permission callbacks
- `manager.ts` — `ACPManager`: manages multiple `ACPClient` instances (has its own singleton but not used by the app)

### Agent Manager (`src/lib/agents/`)

Higher-level abstraction over ACP used by the tRPC routers. **This is the layer the app actually uses.**

- `types.ts` — Core domain types (`AgentSession`, `AgentClient`, `AgentEvent`, `ApprovalRequest`, `IAgentManager`)
- `manager.ts` — `AgentManager` singleton (via `getAgentManager()`): normalizes ACP events, manages session lifecycle, emits events via EventEmitter
- `store.ts` — JSON file persistence to `.agent-store/sessions/` directory

### Project Manager (`src/lib/projects/`)

Manages projects (git repos) and worktrees for parallel agent workflows. `ProjectManager` singleton (via `getProjectManager()`) backed by SQLite at `.agent-store/projects.db`.

- `types.ts` — Project, Worktree, AgentWorktreeAssignment types
- `schema.ts` — SQLite schema with versioned migrations
- `db.ts` — Database connection
- `project-manager.ts` — CRUD, worktree lifecycle, agent assignments, auto-import
- `git-operations.ts` — Safe git wrappers using `execFile` (not `exec`)

SQLite tables: `projects`, `worktrees`, `agent_worktree_assignments` (FK cascades on delete).

### Real-Time Events

SSE endpoint at `/api/events` (defined in `src/routes/api.events.ts`) streams `AgentEvent` and `ApprovalRequest` objects. The `useAgentEvents` hook in `src/hooks/useAgentEvents.ts` connects to this endpoint and auto-reconnects.

### UI Components

- `src/components/ui/` — shadcn/ui components (new-york style, zinc base color). Add new ones with: `pnpm dlx shadcn@latest add <component>`
- `src/components/dashboard/` — Dashboard-specific components (`DashboardLayout`, `SessionCard`, `ClientCard`, `AgentBadge`, `StatusBadge`, `ErrorDisplay`, `ProjectCard`, `WorktreeCard`, `WorktreeCreateDialog`, `WorktreeAgentMap`, `ProjectSpawnFlow`, `BranchBadge`)
- Theme: dark/light mode via `useTheme` hook (`src/hooks/useTheme.ts`), persisted to localStorage

### Environment Variables

Managed via T3 Env in `src/env.ts`. Server vars are unprefixed, client vars require `VITE_` prefix.

## Docs

- `docs/ARCHITECTURE.md` — Detailed architecture (system diagram, directory structure, data model, event flow)
- `docs/done/YYYY-MM-DD-<title>.md` — Completed feature specs
- `docs/learnings/YYYY-MM-DD-<title>.md` — Research notes and learnings
- `docs/issues/` — Known issues and bugs

## Key Patterns

- **Singleton managers**: `getAgentManager()` and `getProjectManager()` return server-side singletons — all tRPC routes share these instances.
- **Two ACP abstraction levels**: `src/lib/acp/` is the raw protocol layer; `src/lib/agents/` is the app-level abstraction. tRPC routers only import from `src/lib/agents/`.
- **Event flow**: ACP agent → `ACPClient` events → `AgentManager` normalizes → emits on EventEmitter → SSE endpoint streams to browser → `useAgentEvents` hook delivers to React components.
- **Session persistence**: Sessions are stored both in-memory (for active use) and on disk as JSON files in `.agent-store/` (for history across restarts).
- **Project persistence**: Projects, worktrees, and agent assignments stored in SQLite at `.agent-store/projects.db` with FK cascades.
- **Worktree workflow**: Projects group agent sessions around a git repo. Each worktree gets its own branch, agents are assigned to worktrees, and assignments auto-cleanup on session kill/delete.
