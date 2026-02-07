# AI Agent Dashboard

A web dashboard for managing AI coding agents (Gemini CLI, Claude Code, Codex) through the [Agent Client Protocol (ACP)](https://agentclientprotocol.com). Spawn agents, stream logs in real-time, approve file edits and shell commands remotely, and run multiple agents in parallel across git worktrees.

## Features

- **Multi-agent support** — Gemini CLI (ACP mode), Claude Code, Codex
- **Real-time streaming** — Live session logs via Server-Sent Events
- **Remote approvals** — Approve/deny file edits and commands from the browser
- **Project management** — Group sessions around git repos with worktree-per-branch isolation
- **Session persistence** — History survives server restarts

## Quick Start

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Commands

```bash
pnpm dev          # Dev server
pnpm build        # Production build
pnpm test         # Run tests (vitest)
pnpm typecheck    # TypeScript check
pnpm check        # Biome lint + format (auto-fix)
pnpm validate     # typecheck + lint + test (full CI)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | [TanStack Start](https://tanstack.com/start) (SSR React on Nitro) |
| Routing | TanStack Router (file-based) |
| Server API | tRPC + superjson |
| Data fetching | TanStack Query |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Agent protocol | ACP (`@agentclientprotocol/sdk`) |
| Persistence | SQLite (projects) + JSON files (sessions) |

## Architecture

```
Browser ──SSE──> /api/events ──> AgentManager ──> ACPClient ──> Agent Process
Browser ──tRPC─> Nitro Server ─> AgentManager / ProjectManager
```

Agents are spawned as child processes communicating over stdin/stdout. Events flow through `AgentManager` (singleton) which normalizes protocol-specific messages into unified `AgentEvent` objects, then streams them to the browser via SSE.

Projects and worktrees are managed by `ProjectManager` (singleton) backed by SQLite, enabling multiple agents to work on the same repo in parallel via git worktrees.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture reference.

## Docs

| File | Description |
|------|-------------|
| [CLAUDE.md](CLAUDE.md) | Agent-facing project guide (code style, patterns, commands) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Detailed architecture, directory structure, data model |
| `docs/done/YYYY-MM-DD-*.md` | Completed feature specs |
| `docs/learnings/YYYY-MM-DD-*.md` | Research notes and learnings |
| `docs/issues/` | Known issues and bugs |
