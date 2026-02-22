# PWA Caching with Force Update Flow

**Date:** 2026-02-23  
**Status:** Implemented

## Overview

Implement production-ready PWA caching for the AI Agent Dashboard with a user-controlled force update flow. Use `vite-plugin-pwa` to automate asset precaching while maintaining full control over the update notification UX.

## Goals

1. Cache app shell and static assets for faster repeat visits and basic offline support
2. Detect when new versions are available
3. Show a subtle, non-blocking toast notification when updates are ready
4. Allow users to trigger immediate reload to get the latest version
5. Automatically clean up old caches when new versions activate

## Non-Goals

- Full offline functionality (API responses, dynamic content remain network-only)
- Background sync or push notifications
- Offline fallback pages
- Progressive enhancement for no-JS scenarios

## Architecture

### Build-time Layer

**Tool:** `vite-plugin-pwa`

- Integrates into Vite build pipeline
- Generates production service worker (`sw.js`) with Workbox
- Precaches all versioned static assets (JS, CSS, fonts, images)
- Cache names include content hashes (e.g., `workbox-precache-v2-abc123`)
- When assets change, cache name changes → old caches auto-deleted on activation

### Runtime Layer

**Service Worker Lifecycle:**

1. Browser loads app → registers `/sw.js`
2. SW intercepts fetch requests → serves cached assets (cache-first)
3. When new SW detected → fires `waiting` event
4. App shows toast notification: "Update Available"
5. User clicks "Update" → sends `SKIP_WAITING` message to SW
6. SW activates → cleans up old caches
7. App reloads → new version served from fresh cache

**React Integration:**

- `useServiceWorkerUpdate()` hook listens for SW lifecycle events
- Returns `{ updateAvailable: boolean, updateApp: () => void }`
- `<UpdateNotification />` component consumes hook, shows toast via `sonner`

### Key Components

1. **Vite config** (`vite.config.ts`) — plugin configuration
2. **Update hook** (`src/hooks/useServiceWorkerUpdate.ts`) — SW registration & event handling
3. **Update UI** (`src/components/UpdateNotification.tsx`) — toast notification
4. **Root layout** (`src/routes/__root.tsx`) — remove inline SW registration, add `<UpdateNotification />`

## Implementation Details

### 1. Dependencies

Add to `package.json`:

```json
{
  "devDependencies": {
    "vite-plugin-pwa": "^0.21.x"
  },
  "dependencies": {
    "workbox-window": "^7.3.x"
  }
}
```

### 2. Vite Plugin Configuration

**File:** `vite.config.ts`

```typescript
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  // ... existing plugins
  VitePWA({
    registerType: 'prompt', // Don't auto-update, wait for user action
    includeAssets: [
      'favicon.svg',
      'apple-touch-icon.png',
      'logo192.png',
      'logo512.png'
    ],
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true, // Activate immediately when installed
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            }
          }
        }
      ]
    }
  })
]
```

**Key decisions:**

- `registerType: 'prompt'` — plugin exposes callback, doesn't auto-reload
- `skipWaiting: true` + `clientsClaim: true` — new SW activates immediately after install
- Precache all static assets matching glob patterns
- Optional runtime caching for external resources (Google Fonts)

The plugin replaces `public/sw.js` during build. Delete or move the current minimal `sw.js` out of `public/`.

### 3. Service Worker Update Hook

**File:** `src/hooks/useServiceWorkerUpdate.ts`

**Responsibilities:**

- Register service worker using `workbox-window`'s `Workbox` class
- Listen for `waiting` event (new SW installed, waiting to activate)
- Provide `updateAvailable` boolean state
- Provide `updateApp()` function that triggers reload

**Flow:**

1. On mount → register `/sw.js` via `Workbox` instance
2. `waiting` event fires → set `updateAvailable = true`
3. User calls `updateApp()`:
   - Send `{ type: 'SKIP_WAITING' }` message to waiting SW
   - Listen for `controlling` event (new SW activated)
   - Call `window.location.reload()`

**Implementation pattern:**

```typescript
import { Workbox } from 'workbox-window'
import { useCallback, useEffect, useState } from 'react'

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [wb, setWb] = useState<Workbox | null>(null)

  const updateApp = useCallback(() => {
    if (wb) {
      wb.addEventListener('controlling', () => {
        window.location.reload()
      })
      wb.messageSkipWaiting()
    }
  }, [wb])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const workbox = new Workbox('/sw.js')
      
      workbox.addEventListener('waiting', () => {
        setUpdateAvailable(true)
      })
      
      workbox.register()
      setWb(workbox)
    }
  }, [])

  return { updateAvailable, updateApp }
}
```

**Key decisions:**

- Hook called once at app root level (not in every component)
- Uses React 19 compiler-friendly patterns
- No automatic reload — waits for user action

### 4. Update Notification UI

**File:** `src/components/UpdateNotification.tsx`

**Responsibilities:**

- Consume `useServiceWorkerUpdate()` hook
- Show toast when `updateAvailable` becomes true
- Provide "Update" action that calls `updateApp()`

**Implementation:**

```typescript
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate'

export function UpdateNotification() {
  const { updateAvailable, updateApp } = useServiceWorkerUpdate()

  useEffect(() => {
    if (updateAvailable) {
      toast('Update Available', {
        description: 'A new version is available',
        action: {
          label: 'Update',
          onClick: updateApp
        },
        duration: Infinity // Don't auto-dismiss
      })
    }
  }, [updateAvailable, updateApp])

  return null // No rendered UI, just side effects
}
```

**Integration:**

- Add `<UpdateNotification />` to `__root.tsx` inside `<Provider>` (after `<Outlet />`)
- Remove inline SW registration script from `__root.tsx` (plugin handles it via virtual module)

**Toast behavior:**

- Uses existing `sonner` toast library
- Persistent toast (doesn't auto-dismiss)
- Single action button: "Update"
- Clicking "Update" → immediate reload

### 5. Cache Strategy

**What gets cached:**

- All build output assets (JS, CSS bundles) — automatically precached
- Static assets in `public/` matching glob patterns:
  - `favicon.svg`, `apple-touch-icon.png`, `logo192.png`, `logo512.png`
  - Fonts, images
- External fonts from Google Fonts (if used) — runtime cache with 1-year expiration

**What doesn't get cached:**

- HTML documents (always network-first to ensure fresh routing)
- API responses from tRPC endpoints (`/api/trpc/*`)
- SSE streams (`/api/events`)
- Any dynamic server-rendered content

**Cache versioning:**

- Plugin generates cache names with content hashes (e.g., `workbox-precache-v2-abc123`)
- When you rebuild with changed assets, hash changes
- Old caches deleted automatically on SW activation via `cleanupOutdatedCaches: true`

**Cache-first strategy:**

- Precached assets: check cache first, never hit network (assets versioned via filename hashes)
- Runtime-cached resources (fonts): check cache first, fall back to network if miss

**Network behavior:**

- Cache miss + network fails → app shows error
- No offline fallback page (can add later if needed)

## Testing & Verification

### Development Testing

**Note:** Service workers don't update properly in dev mode.

**Testing workflow:**

1. Run `pnpm build && pnpm preview`
2. Open DevTools → Application → Service Workers
3. Use "Update on reload" checkbox to force SW updates during testing

### Production Testing

**Scenario:**

1. Build and deploy version 1
2. Install PWA on device or add to home screen
3. Make a code change (e.g., add console.log, change text)
4. Build and deploy version 2
5. Reload the app → should see "Update Available" toast
6. Click "Update" → page reloads with new version

**Verification checklist:**

- [ ] Assets load from cache on repeat visits (Network tab → "from ServiceWorker")
- [ ] Toast appears when new version is deployed
- [ ] Clicking "Update" reloads and shows new version
- [ ] Old caches are deleted (Application → Cache Storage)
- [ ] PWA install prompt still works
- [ ] App works offline for cached assets

**Debugging:**

- Check `navigator.serviceWorker.controller` in console to verify SW is active
- Check cache names in Application → Cache Storage
- Use Lighthouse PWA audit to verify configuration

## Trade-offs

### Chosen Approach: Vite Plugin + Manual Update Flow

**Pros:**

- Automatic precaching of all build assets (handled by plugin)
- Less SW code to write manually
- Full control over UI/UX of update notifications
- Plugin integrates with Vite's build process
- Battle-tested Workbox under the hood

**Cons:**

- Adds `vite-plugin-pwa` + `workbox-window` dependencies
- Plugin config can be complex for advanced use cases
- ~20KB added to service worker bundle

**Why this approach:**

- App already uses modern tooling (TanStack Start, Vite) — plugin fits naturally
- Plugin handles tedious parts (precaching, cache cleanup, version hashing)
- We keep full design control over update UX
- Less risky than manual SW implementation (fewer production bugs)

### Alternative Approaches Considered

**Manual Service Worker:**

- Full control, zero dependencies, smallest bundle
- More error-prone (race conditions, quota errors, partial updates)
- Not worth the risk for a production app

**Full Workbox:**

- More features (background sync, push notifications)
- Heavier bundle, more complexity than needed
- Current approach can upgrade to full Workbox later if needed

## Future Enhancements

(Not in initial scope — add later if needed)

1. **Offline fallback page** — show custom UI when network fails
2. **Background sync** — queue failed API requests and retry when online
3. **Push notifications** — notify users of updates even when app is closed
4. **Partial caching of API responses** — cache read-only data (project list, session history)
5. **Update changelog** — show what's new in the toast description

## Success Criteria

- [ ] Static assets load from cache on repeat visits (faster page loads)
- [ ] Users see "Update Available" toast when new version is deployed
- [ ] Clicking "Update" immediately reloads with latest version
- [ ] Old caches are cleaned up automatically
- [ ] No manual SW registration code remains in `__root.tsx`
- [ ] Lighthouse PWA audit passes with 100 score
- [ ] App works offline for previously visited pages (static assets only)

## Next Steps

1. Write detailed implementation plan using `writing-plans` skill
2. Install dependencies (`vite-plugin-pwa`, `workbox-window`)
3. Configure plugin in `vite.config.ts`
4. Implement `useServiceWorkerUpdate` hook
5. Implement `<UpdateNotification />` component
6. Update `__root.tsx` to remove inline SW registration
7. Delete or move `public/sw.js` (replaced by generated SW)
8. Test with `pnpm build && pnpm preview`
9. Deploy and verify in production
