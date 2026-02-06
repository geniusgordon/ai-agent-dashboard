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
