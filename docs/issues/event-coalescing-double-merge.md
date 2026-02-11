# Issue: Event Coalescing Double-Merge Causes Duplicated Content

## Summary

Session logs displayed duplicated words/text because consecutive message and thinking events were being merged multiple times across different layers of the event pipeline.

## Observed Behavior

When viewing persisted session logs (e.g. session `89b18f08-dc94-4f62-a178-c7be3a289190`), message content appeared with duplicated words. For example, a message that should read `"hello world"` would instead display as `"hello worldhello world"`.

## Root Cause

The event pipeline has three independent coalescing layers, and `getSessionEvents()` was applying an additional merge on top of data that was already coalesced:

### Event Flow (write path)

```
ACP agent emits token-by-token chunks
  │
  ▼
AgentManager.emitEvent()
  ├─ Merges consecutive message/thinking tokens in-memory (sessionEvents map)
  ├─ Calls store.appendSessionEvent() ──► write buffer coalesces tokens,
  │                                        flushes to JSONL after 500ms or on
  │                                        type change
  └─ Emits raw token via EventEmitter ──► SSE ──► browser
```

### Event Flow (read path — the bug)

```
AgentManager.getSessionEvents()
  ├─ In-memory path: events already merged by emitEvent()
  │   └─ BUG: mergeConsecutiveEvents() re-merged ──► duplicated content
  │
  └─ Disk path: JSONL lines already coalesced by write buffer
      └─ BUG: mergeConsecutiveEvents() re-merged ──► duplicated content
```

### Why duplication happens

When `emitEvent()` receives tokens `"hello"` + `" world"`, it merges them into a single in-memory event with content `"hello world"`. The next token `" foo"` arrives and gets merged to `"hello world foo"`.

When `getSessionEvents()` then calls `mergeConsecutiveEvents()`, it sees two adjacent events (the merged one and whatever follows) that may still be "mergeable" (same type, same sender). If the next event is also a message from the same sender (e.g. after a flush boundary), the content gets concatenated again — producing `"hello world foohello world foo"`.

### Frontend SSE merge (not affected)

The frontend (`useSessionDetail.ts`) also merges consecutive SSE tokens in `handleEvent()`. This is correct and not affected — it operates on individual SSE tokens during live streaming. On reconnect/refetch, the server returns pre-merged events which replace the local state entirely.

## Fix

Changed `getSessionEvents()` to:
- **In-memory events**: Return directly without re-merging (already coalesced by `emitEvent()`)
- **Disk-loaded events**: Still merge, because the 500ms flush timer in `appendSessionEvent()` can split a single logical message across two adjacent JSONL lines when the timer fires mid-stream

## Files Changed

- `src/lib/agents/manager.ts` — `getSessionEvents()` skips merge for in-memory path; `mergeConsecutiveEvents()` retained for disk-only use

## Coalescing Layer Reference

| Layer | Location | When it runs | Purpose |
|-------|----------|-------------|---------|
| In-memory merge | `emitEvent()` in `manager.ts` | Every token arrival | Keeps sessionEvents array compact |
| Write buffer | `appendSessionEvent()` in `store.ts` | 500ms debounce / type change | Reduces JSONL lines on disk |
| Disk read merge | `mergeConsecutiveEvents()` in `manager.ts` | `getSessionEvents()` disk path only | Heals flush-boundary splits |
| SSE client merge | `handleEvent()` in `useSessionDetail.ts` | Every SSE token in browser | Keeps React state compact |
