# AI Agent Dashboard

A dashboard for managing AI coding agents (Gemini CLI, Claude Code, Codex) through the Agent Client Protocol (ACP). Built with TanStack Start (SSR React framework) + tRPC + Tailwind CSS v4.

## Development

```bash
pnpm install
pnpm dev              # Start dev server on port 3000
```

## Production

### Setup (one-time)

Install PM2 globally:

```bash
pnpm add -g pm2
```

### Start Production Server

```bash
pnpm build            # Build for production
pnpm start            # Start PM2 process manager
```

The server will:
- Run on port 3000 (configure in `ecosystem.config.cjs`)
- Auto-restart on crashes
- Be accessible via Tailscale from other devices
- Automatically rebuild and restart when you merge to main (via git hook)

### Production Commands

```bash
pnpm start            # Start/restart production server
pnpm stop             # Stop production server
pm2 logs agent-dashboard    # View logs
pm2 monit             # Monitor processes
pm2 restart agent-dashboard # Manual restart
```

### Auto-Rebuild on Merge

A git `post-merge` hook automatically rebuilds and restarts the server when you merge to main:

1. Develop in a worktree: `git worktree add ../feature-name feature-name`
2. Make changes, commit
3. Merge to main: `git checkout main && git merge feature-name`
4. **The hook automatically runs**: `pnpm build` + `pm2 restart agent-dashboard`

No manual rebuild needed!

## Testing

```bash
pnpm test             # Run tests
pnpm test:watch       # Watch mode
pnpm typecheck        # Type check
pnpm check            # Lint + format
pnpm validate         # Full CI pipeline
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Project Structure

```
src/
├── routes/              # File-based routing (TanStack Router)
├── components/
│   ├── ui/             # shadcn/ui components
│   └── dashboard/      # Dashboard-specific components
├── server/
│   └── routers/        # tRPC routers
├── lib/
│   ├── acp/            # ACP protocol layer
│   ├── agents/         # Agent manager (high-level)
│   └── projects/       # Project & worktree manager
├── hooks/              # React hooks
└── integrations/
    └── trpc/           # tRPC setup

.agent-store/           # Persistent data (SQLite + JSON)
└── sessions/           # Agent session history
```

## Tech Stack

- **Framework**: TanStack Start (SSR React)
- **API**: tRPC
- **Database**: SQLite (better-sqlite3)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (new-york style)
- **Git**: simple-git + native git operations
- **Process Manager**: PM2 (production)
- **ACP**: @agentclientprotocol/sdk

## Configuration

- `CLAUDE.md` - Project instructions for Claude Code
- `ecosystem.config.cjs` - PM2 production config
- `vite.config.ts` - Vite/TanStack Start config
- `.git/hooks/post-merge` - Auto-rebuild hook
