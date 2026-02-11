# Issue: Event Coalescing Double-Merge Causes Duplicated Content

## Summary

Session logs displayed duplicated words/text because consecutive message and thinking events were being merged multiple times across different layers of the event pipeline.

## Observed Behavior

When viewing persisted session logs (e.g. session `89b18f08-dc94-4f62-a178-c7be3a289190`), message content appeared with duplicated words. For example, a message that should read `"Looking at this"` would instead display as `"LookingLooking at this at this"` — every token doubled.

## Root Causes

Two bugs were found and fixed in sequence:

### Bug 1: `getSessionEvents()` re-merged already-coalesced events (fixed in `3a9314e`)

`getSessionEvents()` unconditionally called `mergeConsecutiveEvents()` on in-memory events that were already coalesced by `emitEvent()`, concatenating content that was already merged and producing duplicated text.

**Fix**: Skip re-merge for the in-memory path; keep merge only for disk-loaded events (where the 500ms flush timer can split a message across JSONL lines).

### Bug 2: Shared payload reference between in-memory array and store write buffer

Even after Bug 1 was fixed, word-level duplication persisted **on disk**. The root cause was a shared JS object reference:

1. Token `"Looking"` arrives. `emitEvent()` pushes event to in-memory array. `store.appendSessionEvent()` calls `toStoredEvent(event)` which copies fields but **reuses `event.payload` by reference**. The store's pending write buffer now holds a `StoredEvent` whose `.payload` is the **same object** as `events[last].payload` in memory.

2. Token `" at this"` arrives. `emitEvent()` merges in-memory: mutates `lastPayload.content = "Looking" + " at this"`. Because the store's buffered payload is the same object reference, it is also mutated to `"Looking at this"`.

3. `store.appendSessionEvent()` merges the new raw token into pending: `"Looking at this" + " at this"` = `"Looking at this at this"` — **doubled**.

**Fix**: Clone the payload in `toStoredEvent()` with `JSON.parse(JSON.stringify(event.payload))` so the store owns an independent copy, breaking the shared reference.

### Event Flow (write path)

```
ACP agent emits token-by-token chunks
  │
  ▼
AgentManager.emitEvent()
  ├─ Merges consecutive message/thinking tokens in-memory (sessionEvents map)
  │   └─ Mutates last.payload.content IN-PLACE
  ├─ Calls store.appendSessionEvent() ──► toStoredEvent() clones payload,
  │                                        write buffer coalesces tokens,
  │                                        flushes to JSONL after 500ms or on
  │                                        type change
  └─ Emits raw token via EventEmitter ──► SSE ──► browser
```

### Event Flow (read path)

```
AgentManager.getSessionEvents()
  ├─ In-memory path: events already merged by emitEvent()
  │   └─ Returns shallow copy directly (no re-merge)
  │
  └─ Disk path: JSONL lines already coalesced by write buffer
      └─ mergeConsecutiveEvents() heals flush-boundary splits only
```

### Frontend SSE merge (not affected)

The frontend (`useSessionDetail.ts`) also merges consecutive SSE tokens in `handleEvent()`. This is correct and not affected — it operates on individual SSE tokens during live streaming. On reconnect/refetch, the server returns pre-merged events which replace the local state entirely.

## Files Changed

- `src/lib/agents/manager.ts` — `getSessionEvents()` skips merge for in-memory path; `mergeConsecutiveEvents()` retained for disk-only use (Bug 1)
- `src/lib/agents/store.ts` — `toStoredEvent()` deep-clones payload to break shared reference with in-memory array (Bug 2)

## Coalescing Layer Reference

| Layer | Location | When it runs | Purpose |
|-------|----------|-------------|---------|
| In-memory merge | `emitEvent()` in `manager.ts` | Every token arrival | Keeps sessionEvents array compact |
| Write buffer | `appendSessionEvent()` in `store.ts` | 500ms debounce / type change | Reduces JSONL lines on disk |
| Disk read merge | `mergeConsecutiveEvents()` in `manager.ts` | `getSessionEvents()` disk path only | Heals flush-boundary splits |
| SSE client merge | `handleEvent()` in `useSessionDetail.ts` | Every SSE token in browser | Keeps React state compact |
