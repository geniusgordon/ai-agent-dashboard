# Research Notes

## Claude Code CLI

### Streaming Output
```bash
claude --print --output-format stream-json --verbose "your prompt"
```

**Event types observed:**
- `{"type":"system","subtype":"init",...}` — session initialization with tools, model, cwd
- `{"type":"system","subtype":"hook_started",...}` — plugin hooks starting
- `{"type":"system","subtype":"hook_response",...}` — plugin hook responses
- `{"type":"assistant","message":...}` — assistant responses (need to verify)
- `{"type":"tool","name":...}` — tool invocations (need to verify)

**Init event contains:**
- `session_id` — UUID for the session
- `cwd` — working directory
- `tools` — available tools array
- `model` — model being used
- `permissionMode` — current permission mode

### Bidirectional Streaming
```bash
claude --print --input-format stream-json --output-format stream-json --verbose
```

This allows sending messages to a running session via stdin.

### Permission Modes
- `default` — ask for each action
- `acceptEdits` — auto-accept file edits, ask for commands
- `bypassPermissions` — skip all permission checks (dangerous)
- `delegate` — (need to research)
- `dontAsk` — (need to research)
- `plan` — read-only planning mode

### Session Management
- `--session-id <uuid>` — use specific session ID
- `--resume [id]` — resume by session ID
- `--continue` — continue most recent session in current directory
- `--fork-session` — create new session ID when resuming

---

## Codex CLI

### Non-Interactive Execution
```bash
codex exec --json "your prompt"
```

Outputs JSONL events to stdout.

### App Server Protocol

Codex has a full JSON-RPC protocol for programmatic control, used by the VSCode extension.

```bash
codex app-server
```

**Key server requests (approval flow):**

1. **Command Execution Approval**
   - Method: `item/commandExecution/requestApproval`
   - Params: `callId`, `command[]`, `cwd`, `parsedCmd[]`
   - Response: approve or reject

2. **File Change Approval**
   - Method: `item/fileChange/requestApproval`
   - Params: file change details
   - Response: approve or reject

3. **User Input Request**
   - Method: `item/tool/requestUserInput`
   - Params: input request details
   - Response: user-provided input

**Schema files generated via:**
```bash
codex app-server generate-json-schema --out /path/to/output
```

Key schema files:
- `ServerRequest.json` — requests from server to client (approvals)
- `ClientRequest.json` — requests from client to server (commands)
- `EventMsg.json` — event messages
- `ExecCommandApprovalParams.json` — command approval details
- `FileChangeRequestApprovalParams.json` — file change approval details

### Execution Modes
- `--sandbox read-only` — read-only access
- `--sandbox workspace-write` — can write to workspace
- `--sandbox danger-full-access` — full system access
- `--full-auto` — auto-approve in sandboxed mode
- `--dangerously-bypass-approvals-and-sandbox` — skip all checks (very dangerous)

---

## Implementation Notes

### Claude Code Adapter Strategy
1. Spawn process with `--print --output-format stream-json --verbose`
2. Parse JSONL from stdout
3. For approvals: Currently Claude Code doesn't have a programmatic approval mechanism in stream-json mode
   - **Option A**: Use `--permission-mode acceptEdits` or `bypassPermissions`
   - **Option B**: Investigate if there's an approval event we can respond to
   - **Option C**: Use tmux/pty and simulate keypresses for approval

### Codex Adapter Strategy
1. Spawn `codex app-server` process
2. Communicate via JSON-RPC over stdio
3. Handle `requestApproval` requests by:
   - Emitting approval request event to dashboard
   - Waiting for user response
   - Sending approval/rejection response back

### Event Normalization
Both adapters should emit normalized `AgentEvent` objects:
```typescript
interface AgentEvent {
  type: 'message' | 'tool-use' | 'tool-result' | 'approval-request' | 'error' | 'complete'
  sessionId: string
  timestamp: Date
  payload: unknown
}
```

This allows the dashboard to handle both agent types with the same UI components.

---

## Gemini CLI

### Basic Non-Interactive Mode
```bash
gemini -p "your prompt"                    # headless mode
gemini -p "prompt" -o stream-json          # streaming JSON output
gemini -p "prompt" --approval-mode default # require approvals
```

### Stream JSON Output Format
```bash
gemini -p "prompt" -o stream-json
```

**Event types:**
- `{"type":"init","session_id":"...","model":"..."}` — session start
- `{"type":"message","content":"...","delta":true}` — streaming response chunks
- `{"type":"message","content":"...","delta":false}` — complete message
- `{"type":"result","stats":{...}}` — session completion with stats

### Approval Modes
- `default` — prompt for approval
- `auto_edit` — auto-approve file edits only
- `yolo` — auto-approve everything
- `plan` — read-only mode

### Session Management
- `--list-sessions` — list available sessions
- `-r latest` or `-r <index>` — resume a session
- `--delete-session <index>` — delete a session

---

## Agent Client Protocol (ACP) — Gemini CLI `--experimental-acp`

### Overview
ACP is a **standardized JSON-RPC 2.0 protocol** for communication between code editors and AI coding agents. Developed by **Zed editor team**, now adopted by Gemini CLI.

- **Spec**: https://agentclientprotocol.com
- **SDK**: `@agentclientprotocol/sdk` (npm)
- **Gemini impl**: `packages/cli/src/zed-integration/zedIntegration.ts`

### Protocol Flow

```
Client                              Agent (Gemini)
   |                                     |
   |--- initialize ---------------------->|
   |<------------------------ result -----|
   |                                     |
   |--- session/new --------------------->|
   |<-------------------- sessionId ------|
   |                                     |
   |--- session/prompt ------------------>|
   |<---------- session/update (stream) --|
   |<---------- session/update (stream) --|
   |<------------------------ result -----|
```

### Key Methods

**Client → Agent:**
- `initialize` — handshake, exchange capabilities
- `session/new` — create new session (returns sessionId)
- `session/load` — resume existing session
- `session/prompt` — send user message
- `session/cancel` — cancel ongoing turn (notification)
- `session/set_mode` — change approval mode

**Agent → Client:**
- `session/update` — streaming updates (notification)
- `session/request_permission` — request approval for actions

### Initialize Request/Response

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": { "read": true, "write": true },
      "terminal": true
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "authMethods": [
      { "id": "oauth-personal", "name": "Log in with Google" },
      { "id": "gemini-api-key", "name": "Use Gemini API key" },
      { "id": "vertex-ai", "name": "Vertex AI" }
    ],
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": { "image": true, "audio": true, "embeddedContext": true },
      "mcpCapabilities": { "http": true, "sse": true }
    }
  }
}
```

### Session Update Types (streaming)

```typescript
type SessionUpdate =
  | { sessionUpdate: "agent_thought_chunk", content: ContentBlock }  // thinking/reasoning
  | { sessionUpdate: "agent_message_chunk", content: ContentBlock }  // actual response
  | { sessionUpdate: "tool_call", toolCallId: string, title: string, status: "pending" | "in_progress" | "completed" | "failed" }
  | { sessionUpdate: "tool_call_update", toolCallId: string, status: string, content?: Content[] }
  | { sessionUpdate: "plan", entries: PlanEntry[] }
```

### Permission Request

```json
// Agent → Client (method call, expects response)
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "session/request_permission",
  "params": {
    "sessionId": "...",
    "permission": {
      "type": "file_write",
      "path": "/path/to/file.txt",
      "content": "..."
    }
  }
}

// Client → Agent
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": { "granted": true }
}
```

### Stop Reasons

```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled"
```

### Testing ACP Mode

```bash
# Start Gemini in ACP mode
gemini --experimental-acp

# Then send JSON-RPC messages via stdin
```

### Why ACP is Ideal for Our Dashboard

1. **Standard protocol** — JSON-RPC 2.0, well-defined spec
2. **Built-in session management** — `session/new`, `session/load`
3. **Structured streaming** — `session/update` with typed events
4. **Permission requests** — `session/request_permission` for remote approval
5. **MCP integration** — can pass MCP servers to sessions
6. **Extensible** — `_meta` fields and `_` prefixed custom methods

### Comparison: stream-json vs ACP

| Feature | stream-json | ACP |
|---------|-------------|-----|
| Protocol | NDJSON (one-way) | JSON-RPC 2.0 (bidirectional) |
| Session mgmt | External (`-r` flag) | Built-in (`session/new`, `session/load`) |
| Streaming | ✅ | ✅ (`session/update`) |
| Approvals | Via `--approval-mode` | `session/request_permission` |
| Thinking | Not exposed | `agent_thought_chunk` |
| Multi-session | One per process | Multiple via sessionId |

**Recommendation**: Use ACP mode (`--experimental-acp`) for GeminiAdapter — it provides the richest programmatic control.

---

## Adapter Strategy Summary

| Agent | Recommended Mode | Approval Mechanism |
|-------|------------------|-------------------|
| Claude Code | `--print --output-format stream-json --verbose` | Need workaround (tmux/pty) |
| Codex | `codex app-server` (JSON-RPC) | `requestApproval` methods |
| Gemini | `gemini --experimental-acp` (JSON-RPC) | `session/request_permission` |

### GeminiAdapter Strategy
1. Spawn `gemini --experimental-acp`
2. Send `initialize` with client capabilities
3. Create sessions with `session/new`
4. Send prompts with `session/prompt`
5. Handle `session/update` notifications for streaming
6. Handle `session/request_permission` for approvals
7. Normalize events to `AgentEvent` interface
