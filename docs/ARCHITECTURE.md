# Architecture

## Overview

A web dashboard for managing AI coding agents (Gemini CLI, Claude Code, Codex) through the Agent Client Protocol (ACP). Supports multiple concurrent sessions, real-time log streaming, remote approval for file edits and shell commands, project/worktree management for parallel agent workflows, and a unified interface across agent types.

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Web Dashboard                         │
│  TanStack Start (SSR) + React Query + tRPC                   │
│                                                              │
│  useAgentEvents (SSE) ──── useTRPC (queries/mutations)       │
└──────────────┬──────────────────────┬────────────────────────┘
               │ SSE stream           │ tRPC (HTTP)
┌──────────────▼──────────────────────▼────────────────────────┐
│                      Nitro Server                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │ AgentManager │  │ ProjectMgr   │  │ tRPC Routers         ││
│  │ (singleton)  │  │ (singleton)  │  │ sessions, approvals, ││
│  │ EventEmitter │  │ SQLite DB    │  │ projects, worktrees  ││
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘│
│         │                 │                                  │
│  ┌──────▼───────┐  ┌──────▼───────┐                          │
│  │  ACPClient   │  │ Git Ops      │                          │
│  │ (per agent)  │  │ (execFile)   │                          │
│  │ stdin/stdout │  └──────────────┘                          │
│  └──────┬───────┘                                            │
└─────────┼────────────────────────────────────────────────────┘
          │ ND-JSON / JSON-RPC over stdio
┌─────────▼────────────────────────────────────────────────────┐
│  Agent Processes                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Gemini CLI │  │ Claude Code│  │   Codex    │  + future    │
│  │ (ACP mode) │  │            │  │            │  agents      │
│  └────────────┘  └────────────┘  └────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (SSR React on Nitro) |
| Routing | TanStack Router (file-based) |
| Server API | tRPC with superjson |
| Data fetching | TanStack Query via `@trpc/tanstack-react-query` |
| Styling | Tailwind CSS v4, shadcn/ui (new-york style, zinc) |
| Agent protocol | ACP (`@agentclientprotocol/sdk`) over stdio |
| Project persistence | SQLite via better-sqlite3 |
| Session persistence | JSON files in `.agent-store/sessions/` |
| Linting/Formatting | Biome |

## Directory Structure

```
src/
├── routes/                          # TanStack Router (file-based)
│   ├── __root.tsx                   # Root layout: QueryClient + tRPC context
│   ├── index.tsx                    # Redirects to /dashboard
│   ├── api.events.ts                # SSE endpoint for real-time events
│   ├── api.trpc.$.tsx               # tRPC catch-all API route
│   └── dashboard/
│       ├── route.tsx                # Dashboard layout (Sidebar + Outlet)
│       ├── index.tsx                # Overview: spawn agents, manage sessions
│       ├── approvals.tsx            # Pending approval requests
│       ├── sessions/
│       │   └── $sessionId.tsx       # Session detail with live log
│       └── projects/
│           ├── index.tsx            # Project list
│           ├── new.tsx              # Create project form
│           └── $projectId.tsx       # Project detail with worktrees
│
├── server/routers/                  # tRPC sub-routers
│   ├── sessions.ts                  # Client/session CRUD, messages, kill
│   ├── approvals.ts                 # List/approve/deny permissions
│   ├── projects.ts                  # Project CRUD, import, branches
│   └── worktrees.ts                 # Worktree CRUD, sync, agent assignments
│
├── lib/
│   ├── acp/                         # Low-level ACP protocol
│   │   ├── client.ts                # ACPClient: spawn agent, manage sessions
│   │   └── manager.ts              # ACPManager: multi-client (unused by app)
│   │
│   ├── agents/                      # App-level agent abstraction
│   │   ├── types.ts                 # AgentSession, AgentClient, AgentEvent, etc.
│   │   ├── manager.ts              # AgentManager singleton (event normalization)
│   │   ├── store.ts                # JSON file persistence (.agent-store/)
│   │   ├── event-utils.ts          # Event helper functions
│   │   └── recent-dirs.ts          # Recent working directories
│   │
│   └── projects/                    # Project & worktree management
│       ├── types.ts                 # Project, Worktree, Assignment types
│       ├── schema.ts               # SQLite schema + migrations
│       ├── db.ts                   # Database connection
│       ├── project-manager.ts      # ProjectManager singleton
│       ├── git-operations.ts       # Safe git wrappers (execFile)
│       └── *.test.ts              # Unit tests (32 tests)
│
├── integrations/trpc/              # tRPC wiring
│   ├── init.ts                     # tRPC setup with superjson
│   ├── router.ts                   # Combines sub-routers
│   └── react.ts                    # useTRPC() hook
│
├── hooks/                          # React hooks
│   ├── useAgentEvents.ts           # SSE connection + auto-reconnect
│   ├── useTheme.ts                 # Dark/light mode (localStorage)
│   └── useBranchInfo.ts            # Git branch info for sessions
│
└── components/
    ├── ui/                         # shadcn/ui primitives
    └── dashboard/                  # App components
        ├── DashboardLayout.tsx
        ├── Sidebar.tsx
        ├── ClientCard.tsx          # Agent client with branch badge
        ├── SessionCard.tsx         # Session summary with branch
        ├── SessionHeader.tsx
        ├── SessionLog.tsx          # Real-time log viewer
        ├── LogEntry.tsx
        ├── MessageInput.tsx
        ├── ApprovalBanner.tsx
        ├── AgentBadge.tsx
        ├── StatusBadge.tsx
        ├── BranchBadge.tsx
        ├── ErrorDisplay.tsx
        ├── ReconnectBanner.tsx
        ├── ProjectCard.tsx
        ├── ProjectSpawnFlow.tsx
        ├── WorktreeCard.tsx
        ├── WorktreeCreateDialog.tsx
        └── WorktreeAgentMap.tsx
```

## Core Abstractions

### ACP Client Layer (`src/lib/acp/`)

The low-level protocol layer. `ACPClient` spawns an agent process as a child process and communicates over stdin/stdout using ND-JSON streams via `@agentclientprotocol/sdk`.

- One `ACPClient` instance per agent process
- Handles session creation, prompt sending, and permission callbacks
- `ACPManager` exists for managing multiple clients but the app uses `AgentManager` instead

### Agent Manager (`src/lib/agents/`)

The app-level abstraction that tRPC routers actually use. `AgentManager` is a singleton (via `getAgentManager()`) that wraps ACP and provides:

- **Event normalization** — ACP events → unified `AgentEvent` objects
- **Session lifecycle** — spawn, kill, cleanup, message sending
- **EventEmitter** — pub/sub for the SSE endpoint to consume
- **Persistence** — JSON files in `.agent-store/sessions/` for history across restarts

### Project Manager (`src/lib/projects/`)

Manages projects (git repositories) and worktrees for parallel agent workflows. `ProjectManager` is a singleton (via `getProjectManager()`) backed by SQLite at `.agent-store/projects.db`.

- **Project CRUD** — create, list, get (by id/slug), update, delete
- **Worktree lifecycle** — create/delete worktrees, sync with git, status checks
- **Agent assignments** — bind agent sessions to worktrees, auto-cleanup on kill/delete
- **Auto-import** — `importFromDirectory(path)` detects repo root and syncs worktrees
- **Safe git operations** — all git commands use `execFile` (not `exec`) with 15s timeout for shell injection prevention

### Data Model

**SQLite tables** (`.agent-store/projects.db`):

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `projects` | Git repositories | id, name, slug, repo_path, settings (JSON) |
| `worktrees` | Git worktrees per project | id, project_id (FK), path, branch, is_main_worktree |
| `agent_worktree_assignments` | Agent ↔ worktree bindings | session_id, client_id, worktree_id, project_id |

Foreign keys cascade on delete: removing a project cleans up its worktrees and assignments.

## Event Flow

```
Agent process (Gemini/Claude/Codex)
  ↓ stdout (ND-JSON)
ACPClient (parses events, handles permissions)
  ↓ normalized events
AgentManager (EventEmitter)
  ↓ emits AgentEvent / ApprovalRequest
SSE endpoint (/api/events)
  ↓ Server-Sent Events
useAgentEvents hook (auto-reconnect)
  ↓ delivers to React components
Dashboard UI (SessionLog, ApprovalBanner, etc.)
```

## Key Types

```typescript
// src/lib/agents/types.ts

interface AgentSession {
  id: string
  clientId: string
  status: "idle" | "running" | "waiting_approval" | "error" | "completed"
  createdAt: Date
  events: AgentEvent[]
}

interface AgentClient {
  id: string
  type: "gemini" | "claude-code" | "codex" | string
  status: "idle" | "running" | "error" | "killed"
  cwd: string
  model?: string
  createdAt: Date
  sessions: Map<string, AgentSession>
}

interface AgentEvent {
  type: "message" | "tool-use" | "tool-result" | "approval-request" | "error" | "complete"
  sessionId: string
  timestamp: Date
  payload: unknown
}

interface ApprovalRequest {
  id: string
  sessionId: string
  clientId: string
  type: "command" | "file-edit" | "file-create" | "file-delete"
  description: string
  details: { command?: string[]; filePath?: string; diff?: string }
  createdAt: Date
}
```

## Persistence

| What | Where | Format |
|------|-------|--------|
| Active sessions/clients | In-memory (`AgentManager`) | Runtime objects |
| Session history | `.agent-store/sessions/*.json` | JSON files |
| Projects, worktrees, assignments | `.agent-store/projects.db` | SQLite |
| Theme preference | `localStorage` | String |
| Recent directories | In-memory (`recent-dirs.ts`) | Runtime list |

## Agent Control Protocols

See [agent protocol research](./learnings/2026-02-08-agent-protocols.md) for detailed protocol documentation per agent type.

| Agent | Protocol | Approval Mechanism |
|-------|----------|-------------------|
| Gemini CLI | ACP (`--experimental-acp`) — JSON-RPC 2.0 | `session/request_permission` |
| Claude Code | `--output-format stream-json` — ND-JSON | Limited (permission modes) |
| Codex | `codex app-server` — JSON-RPC | `requestApproval` methods |
