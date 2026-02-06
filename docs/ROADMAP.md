# AI Agent Dashboard — Roadmap

## Phase 1: Foundation (Week 1)

### Goals
- Define core interfaces
- Implement basic session management
- Get Claude Code streaming working

### Tasks
- [ ] Define `AgentAdapter` interface (`src/lib/agents/types.ts`)
- [ ] Implement `SessionManager` (in-memory state)
- [ ] Implement `ClaudeCodeAdapter` (stream-json parsing)
- [ ] Basic tRPC routes:
  - [ ] `sessions.list`
  - [ ] `sessions.create`
  - [ ] `sessions.get`
  - [ ] `sessions.kill`

### Deliverable
A working backend that can spawn Claude Code sessions and capture their output.

---

## Phase 2: Live Streaming (Week 1-2)

### Goals
- Real-time event streaming to frontend
- Live log viewer component

### Tasks
- [ ] WebSocket or SSE event streaming endpoint
- [ ] `EventBus` service for pub/sub
- [ ] `LiveLog` component (real-time log viewer with auto-scroll)
- [ ] Session detail page with live output
- [ ] Basic session list UI

### Deliverable
Dashboard where you can see live output from running agent sessions.

---

## Phase 3: Approval Flow (Week 2)

### Goals
- Remote approval for file edits and commands
- Approval queue UI

### Tasks
- [ ] `ApprovalQueue` service
- [ ] Parse approval requests from Claude Code stream
- [ ] Approval tRPC routes:
  - [ ] `approvals.list`
  - [ ] `approvals.approve`
  - [ ] `approvals.reject`
- [ ] `ApprovalDialog` component with diff viewer
- [ ] Pending approvals page
- [ ] (Optional) Push notification integration

### Deliverable
Ability to approve/reject file edits and commands from the web UI.

---

## Phase 4: Codex Support (Week 2-3)

### Goals
- Add Codex as a second agent type
- Unified approval handling

### Tasks
- [ ] Implement `CodexAdapter` using app-server protocol
- [ ] Handle JSON-RPC approval requests
- [ ] Map Codex events to unified `AgentEvent` format
- [ ] Agent type selector in "new session" UI
- [ ] Test both adapters side-by-side

### Deliverable
Dashboard supports both Claude Code and Codex with the same UI.

---

## Phase 5: Polish (Week 3+)

### Goals
- Production-ready features
- Mobile support

### Tasks
- [ ] Session persistence (SQLite / Turso / file-based)
- [ ] Authentication with better-auth
- [ ] Mobile-friendly responsive UI
- [ ] Session history / replay
- [ ] Cost tracking (if APIs expose it)
- [ ] Dark mode (probably already have via Tailwind)

### Deliverable
A polished, deployable dashboard.

---

## Future Ideas

- [ ] Support more agents (Aider, Continue, etc.)
- [ ] Webhook notifications (Telegram, Discord, Slack)
- [ ] Session templates / presets
- [ ] Collaborative features (multiple users watching same session)
- [ ] Integration with OpenClaw for remote agent orchestration
