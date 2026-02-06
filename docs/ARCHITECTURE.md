# AI Agent Dashboard — Architecture

## Overview

A web dashboard to manage AI coding agents (Claude Code, Codex, etc.) remotely, with support for:
- Multiple concurrent sessions
- Real-time log streaming
- Remote approval for file edits and shell commands
- Unified interface across different agent types

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Dashboard                          │
│  (TanStack Start + React Query + tRPC)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket + tRPC
┌────────────────────────▼────────────────────────────────────┐
│                    Backend Service                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ SessionMgr  │  │ EventBus    │  │ ApprovalQueue       │  │
│  │ (多 session)│  │ (SSE/WS)    │  │ (pending approvals) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Agent Adapter Layer                       │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  ClaudeAdapter   │    │   CodexAdapter   │   + future   │
│  │  (stream-json)   │    │  (app-server)    │   adapters   │
│  └──────────────────┘    └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Agent Control Mechanisms

### Claude Code
- **Streaming**: `--print --output-format stream-json --verbose`
- **Bidirectional**: `--input-format stream-json` for sending messages mid-session
- **Permission modes**: `--permission-mode` (acceptEdits/delegate/plan/dontAsk/bypassPermissions)
- **Session management**: `--resume` / `--continue` / `--session-id`

### Codex
- **Streaming**: `codex exec --json` (JSONL output)
- **App Server**: `codex app-server` provides full JSON-RPC protocol
- **Approval protocol**:
  - `item/commandExecution/requestApproval` — shell command approval
  - `item/fileChange/requestApproval` — file edit approval
  - `item/tool/requestUserInput` — user input request
- **Session management**: `codex resume`

## Unified Interface Design

```typescript
// src/lib/agents/types.ts

interface AgentSession {
  id: string
  type: 'claude-code' | 'codex' | string
  status: 'idle' | 'running' | 'waiting-approval' | 'error'
  cwd: string
  createdAt: Date
  model?: string
}

interface AgentEvent {
  type: 'message' | 'tool-use' | 'tool-result' | 'approval-request' | 'error' | 'complete'
  sessionId: string
  timestamp: Date
  payload: unknown
}

interface ApprovalRequest {
  id: string
  sessionId: string
  type: 'command' | 'file-edit' | 'file-create' | 'file-delete'
  description: string
  details: {
    command?: string[]
    filePath?: string
    diff?: string
  }
  createdAt: Date
}

interface AgentAdapter {
  // Lifecycle
  spawn(options: SpawnOptions): Promise<AgentSession>
  kill(sessionId: string): Promise<void>
  
  // Communication
  sendMessage(sessionId: string, message: string): Promise<void>
  
  // Approvals
  approve(approvalId: string): Promise<void>
  reject(approvalId: string, reason?: string): Promise<void>
  
  // Events (Observable pattern)
  onEvent(sessionId: string, handler: (event: AgentEvent) => void): () => void
}
```

## Project Structure

```
ai-agent-dashboard/
├── src/
│   ├── routes/                    # TanStack Router pages
│   │   ├── index.tsx              # Dashboard overview
│   │   ├── sessions/
│   │   │   ├── index.tsx          # Session list
│   │   │   ├── $sessionId.tsx     # Session detail + live log
│   │   │   └── new.tsx            # Create new session
│   │   └── approvals/
│   │       └── index.tsx          # Pending approvals queue
│   │
│   ├── lib/
│   │   ├── agents/                # Core adapter layer
│   │   │   ├── types.ts           # Shared interfaces
│   │   │   ├── manager.ts         # SessionManager
│   │   │   ├── adapters/
│   │   │   │   ├── base.ts        # BaseAdapter abstract class
│   │   │   │   ├── claude.ts      # ClaudeCodeAdapter
│   │   │   │   └── codex.ts       # CodexAdapter
│   │   │   └── index.ts
│   │   │
│   │   └── events/                # Event streaming
│   │       ├── bus.ts             # EventBus (pub/sub)
│   │       └── websocket.ts       # WS handler
│   │
│   ├── server/                    # Backend (Nitro)
│   │   ├── api/
│   │   │   ├── sessions.ts        # tRPC router for sessions
│   │   │   ├── approvals.ts       # tRPC router for approvals
│   │   │   └── events.ts          # SSE/WS endpoint
│   │   └── trpc.ts
│   │
│   └── components/
│       ├── SessionCard.tsx
│       ├── LiveLog.tsx            # Real-time log viewer
│       ├── ApprovalDialog.tsx     # Approve/reject UI
│       └── DiffViewer.tsx         # Show file diffs
│
└── package.json
```

## Tech Stack

- **Frontend**: TanStack Start, React 19, TanStack Router, TanStack Query
- **Backend**: Nitro (via TanStack Start), tRPC
- **Styling**: Tailwind CSS v4, Radix UI
- **Auth**: better-auth
- **Process Management**: node-pty or native child_process with stream handling
