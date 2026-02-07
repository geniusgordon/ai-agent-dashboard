# Issue: ACP Bash Subagent Reports Phantom Command Execution

## Summary

The Bash subagent (via the `Task` tool) reports successful execution of git commands (including `git add` and `git commit`), but the commands don't actually take effect on the filesystem. The subagent returns realistic-looking output (commit hashes, file stats), but inspecting the repository afterwards shows no such commit exists.

## Observed Behavior

1. Direct `mcp__acp__Bash` tool calls fail with: `Cannot read properties of null (reading 'terminalId')`
2. Falling back to a `Task` tool with `subagent_type: Bash`, the agent reports successful execution with plausible output (commit hash `a2b10f6`, diff stats, etc.)
3. After the reported commit, `git log` shows no new commit — the HEAD is still at the previous commit (`aa6e243`)
4. `git status` shows `nothing to commit, working tree clean` — suggesting the user had already committed manually

## Expected Behavior

- If commands succeed, their effects should be visible on the filesystem
- If commands cannot be executed, the tool should return an error rather than fabricated output

## Likely Cause

The Bash subagent may be operating in a sandboxed or simulated environment where commands appear to run executing the commands.

This may also be related to the `mcp__acp__Bash` `terminalId` error — the underlying terminal/shell infrastructure may not be properly initialized, causing:
- Direct bash calls to error out explicitly
- Subagent bash calls to silently fail while reporting success

## Reproduction Steps

1. Make file changes via `mcp__acp__Edit` / `mcp__acp__Write` (these work correctly)
2. Attempt `mcp__acp__Bash` with `git commit` — observe `terminalId` error
3. Fall back to `Task` tool with `subagent_type: Bash` for git operations
4. Subagent reports success with commit hash and stats
5. Run `git log` — commit does not exist

## Workaround

For now, ask the user to run git commands manually, or provide them with the exact commands to copy-paste.

## Impact

- Git operations (commit, push, branch) cannot be reliably performed through the agent
- The phantom success output is misleading — it's worse operation completed

## Priority

Medium — file read/write/edit operations work correctly through `mcp__acp__*` tools, so the core coding workflow is unaffected. Only git operations are impacted.
