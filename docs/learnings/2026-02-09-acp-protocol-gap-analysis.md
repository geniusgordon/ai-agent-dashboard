# ACP Protocol Gap Analysis

Research comparing our implementation against the ACP specification (https://agentclientprotocol.com/protocol/overview) and the Zed reference adapter (`@zed-industries/claude-code-acp` v0.16.0).

**Our SDK version**: `@agentclientprotocol/sdk ^0.14.1`

---

## Protocol Summary

ACP is a JSON-RPC 2.0 protocol over ND-JSON (newline-delimited JSON) on stdin/stdout. It standardizes communication between code editors (clients) and AI coding agents (agents) — analogous to LSP but for AI agents.

**Trust model**: User in editor talks to a model they trust, with user-controlled permissions.

### Lifecycle

```
Initialization → Authentication (optional) → Session Setup → Prompt Turns → Teardown
```

### Core Methods

| Direction | Method | Type | Required | Description |
|-----------|--------|------|----------|-------------|
| C→A | `initialize` | Request | Yes | Version/capability negotiation |
| C→A | `authenticate` | Request | Yes | Authentication |
| C→A | `session/new` | Request | Yes | Create session |
| C→A | `session/prompt` | Request | Yes | Send user message |
| C→A | `session/cancel` | Notification | Yes | Cancel prompt turn |
| C→A | `session/load` | Request | Optional | Load session with history replay |
| C→A | `session/resume` | Request | Draft | Reconnect without replaying history |
| C→A | `session/list` | Request | Draft | List sessions |
| C→A | `session/delete` | Request | Draft | Delete session |
| C→A | `session/fork` | Request | Draft | Fork session |
| C→A | `session/set_mode` | Request | Optional | Switch operating mode |
| C→A | `session/set_config_option` | Request | Optional | Change config option |
| A→C | `session/request_permission` | Request | Yes | Request tool execution approval |
| A→C | `session/update` | Notification | Yes | Stream updates |
| A→C | `fs/read_text_file` | Request | Optional | Read file content |
| A→C | `fs/write_text_file` | Request | Optional | Write file content |
| A→C | `terminal/create` | Request | Optional | Create terminal process |
| A→C | `terminal/output` | Request | Optional | Get terminal output |
| A→C | `terminal/wait_for_exit` | Request | Optional | Wait for process exit |
| A→C | `terminal/kill` | Request | Optional | Kill terminal process |
| A→C | `terminal/release` | Request | Optional | Release terminal resources |

### Session Update Types

| Update Type | Description |
|-------------|-------------|
| `agent_message_chunk` | Streaming LLM output text |
| `agent_thought_chunk` | Streaming thinking/reasoning text |
| `user_message_chunk` | Replaying user messages (during session load) |
| `tool_call` | New tool call created |
| `tool_call_update` | Progress update on existing tool call |
| `plan` | Agent execution plan with steps |
| `current_mode_update` | Agent-initiated mode change |
| `available_commands_update` | Updated slash commands |
| `config_options_update` | Updated configuration options (model, mode, etc.) |
| `usage_update` | Context window and cost information |
| `session_info_update` | Session title/metadata changes |

### Content Types

Six content block types: text (always), image, audio, embedded resource, resource link. Text uses Markdown by default.

### Permission Options

Each permission request includes options with semantic `kind` values:
- `allow_once` — permit this one action
- `allow_always` — add persistent rule
- `reject_once` — deny this action

### Tool Call Structure

```typescript
{
  toolCallId: string;
  title: string;                        // human-readable
  kind: "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "other";
  status: "pending" | "in_progress" | "completed" | "failed";
  content: ToolCallContent[];           // text, diff {path, oldText, newText}, terminal ref
  locations: { path: string; line?: number }[];
  rawInput?: unknown;
  rawOutput?: unknown;
}
```

### Config Options (newer, more general than modes)

```typescript
{
  id: string;
  name: string;
  category: "mode" | "model" | "thought_level" | "_custom";
  type: "select";
  currentValue: string;
  options: { value: string; name: string }[];
}
```

---

## Zed Reference Adapter Architecture

The `@zed-industries/claude-code-acp` package wraps the Claude Agent SDK to make Claude Code speak ACP.

### Key architectural insight: bidirectional MCP bridge

```
ACP Client (editor/dashboard)
    ↕ stdin/stdout ND-JSON
ClaudeAcpAgent
    ↕ calls query() from Claude Agent SDK
Claude Agent SDK
    ↕ uses MCP tools for file/terminal ops
Internal MCP Server (mcp__acp__Read, mcp__acp__Edit, mcp__acp__Bash, etc.)
    ↕ proxies requests back through ACP
ACP Client (handles actual file I/O and terminal execution)
```

The agent doesn't do file I/O directly — it calls MCP tools that proxy back through ACP to the client. This means the **client controls all I/O**, enabling richer UI (diff previews, terminal panels).

### Notable patterns

1. **Tool use caching**: Maps `tool_use` IDs to full blocks so tool results can reference them later.
2. **Streaming deduplication**: Stream events handled separately from final `assistant` messages — final message filters out text/thinking (already streamed) and only processes tool_use/tool_result.
3. **Console.log hijack**: All `console.log` redirected to `stderr` to prevent corrupting the ND-JSON stream.
4. **Pushable async iterable**: Bridges push-based user input to pull-based `AsyncIterable` expected by `query()`.
5. **Settings integration**: Merges Claude Code settings from 4 sources (user, project, local, enterprise) for permission rule matching with glob patterns.

### Zed adapter capabilities declared

- Session: load, list, fork, resume
- Prompt: image, embedded context
- MCP: HTTP, SSE, ACP transport
- Auth: terminal-based login
- Modes: default, acceptEdits, plan, dontAsk, bypassPermissions

---

## Gap Analysis: Our Implementation vs. Spec

### What we implement correctly

| Feature | Status | Notes |
|---------|--------|-------|
| `initialize` handshake | OK | Via `ACPClient.start()` |
| `session/new` | OK | Via `acpClient.createSession()` |
| `session/prompt` | OK | Via `acpClient.prompt()` |
| `session/load` | OK | Via `acpClient.loadSession()` (checks capability) |
| `session/set_mode` | OK | Via `acpClient.setMode()` |
| `session/request_permission` | OK | Full approval flow with UI |
| `session/update` streaming | OK | Normalized to `AgentEvent` types |
| `fs/read_text_file` | OK | Implemented in client handler |
| `fs/write_text_file` | OK | Implemented in client handler |
| `terminal/*` operations | OK | Full lifecycle: create, output, wait, kill, release |
| Multi-agent support | OK | Gemini, Claude Code, Codex |
| Session persistence | OK | SQLite + JSONL event files |
| SSE real-time events | OK | `/api/events` endpoint with auto-reconnect |
| Permission request UI | OK | Approval cards with options |

### What we're missing

#### High Priority

**1. `session/cancel` — Stop running prompt without killing session**
- Spec: `session/cancel` notification (required method)
- Our code: No `cancel()` method on `ACPClient`. Only option is `killSession()`.
- Impact: Users can't interrupt a runaway agent without destroying the session.
- Fix: Add `ACPClient.cancel(sessionId)` → `connection.cancel({sessionId})`, expose via tRPC mutation, add Stop button to UI.

**2. `usage_update` — Context window and cost tracking**
- Spec: `usage_update` notification with `{used, size, cost}` fields.
- Also: `PromptResponse` includes per-turn token usage (`input_tokens`, `output_tokens`, `thought_tokens`, `cached_read_tokens`, etc.).
- Our code: Neither captured nor displayed.
- Impact: Users have no visibility into context consumption or cost. Can't tell when a session is nearing exhaustion.
- Fix: Capture `usage_update` in `normalizeSessionUpdate()`, store on session, add context meter UI component.

**3. `available_commands_update` — Slash command support**
- Spec: Agent sends available commands with name, description, input hints.
- Our code: Event is received but not captured or displayed.
- Impact: Users can't discover or invoke agent commands like `/web`, `/compact`, etc.
- Fix: Store available commands on session, add command palette or autocomplete in message input.

#### Medium Priority

**4. `session/fork` — Fork a conversation**
- Spec: Creates new session based on existing one (for summaries, PR descriptions, etc.).
- Zed adapter: Implements `unstable_forkSession()`.
- Our code: Not supported.
- Use case: "Generate a PR description from this session" without polluting the conversation.

**5. `config_options_update` / `session/set_config_option` — Model and config switching**
- Spec: Generic config system for model selection, thought level, custom options.
- Our code: Only handle mode switching, not model or thought level.
- Use case: Switch between Sonnet/Opus mid-session, adjust thinking depth.

**6. `session/list` from agent — Import external sessions**
- Spec: Ask agent for sessions it knows about (from CLI usage, other editors).
- Zed adapter: Implements `unstable_listSessions()` reading Claude Code's JSONL files.
- Our code: Only lists sessions we created.
- Use case: See and resume sessions started from terminal CLI.

**7. Rich content blocks in prompts — Images, files, resources**
- Spec: Prompts can include image, audio, embedded resource, resource link blocks.
- Our code: Only sends `{type: "text", text: "..."}` blocks.
- Use case: Paste screenshots, attach files, reference resources.

#### Lower Priority

**8. `session/delete` on agent side**
- Delete agent-side session history, not just our records.

**9. `session/resume` — Lightweight reconnect**
- Reconnect without replaying full history (lighter than `session/load`).

**10. `session_info_update` — Agent-provided session titles**
- Agent can set session title automatically. We could use this instead of requiring manual rename.

**11. `$/cancel_request` — Generic request cancellation**
- Cancel any outstanding request by ID (draft spec).

**12. MCP-over-ACP (`mcp/connect`, `mcp/message`, `mcp/disconnect`)**
- Route MCP servers through ACP connection instead of spawning separate processes.
- Draft spec, high effort.

### Implementation issues to fix

**1. Client capabilities declaration**
- Verify we advertise `fs.readTextFile`, `fs.writeTextFile`, and `terminal` capabilities during `initialize()`. If missing, agents may skip using these features.

**2. Permission option `allow_always` not fully utilized**
- Our approval UI should prominently surface "Allow always" options so users build persistent rules over time instead of approving every single action.

**3. `plan` event UI**
- We normalize plan events but should verify the UI renders them as a structured progress tracker (checkboxes with status), not just raw event text.

**4. Terminal output rendering**
- Terminal events are captured but may not surface as structured terminal blocks in the session detail view.

---

## Recommended Implementation Order

| # | Feature | Impact | Effort | Notes |
|---|---------|--------|--------|-------|
| 1 | Stop/Cancel button | Critical UX | Low | Add `cancel()` to ACPClient, tRPC mutation, UI button |
| 2 | Context window meter | High visibility | Medium | Capture `usage_update`, add progress bar + cost display |
| 3 | Slash command palette | Medium UX | Medium | Store commands on session, autocomplete in input |
| 4 | Session fork | Medium workflow | Medium | Useful for PR descriptions, summaries |
| 5 | Model/config picker | Medium UX | Medium | `set_config_option` for model, thought level |
| 6 | Import external sessions | Medium discovery | Low | `session/list` from agent |
| 7 | Image/file attachments | Medium UX | Medium | Rich content blocks in prompts |
| 8 | Allow-always permissions | Low friction | Low | Better approval option UI |
