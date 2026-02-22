# PWA Caching with Force Update Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add production-ready PWA caching with user-controlled force update notifications to the AI Agent Dashboard.

**Architecture:** Use `vite-plugin-pwa` to automatically precache static assets with version-based cache busting. Implement a React hook to detect service worker updates and a toast notification UI for user-triggered updates.

**Tech Stack:** `vite-plugin-pwa`, `workbox-window`, `sonner` (toast), React 19, TanStack Start

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install vite-plugin-pwa and workbox-window**

Run:
```bash
cd /Users/gordon/Playground/ai-agent-dashboard/main
pnpm add -D vite-plugin-pwa
pnpm add workbox-window
```

Expected: Dependencies installed successfully

**Step 2: Verify installation**

Run:
```bash
pnpm list vite-plugin-pwa workbox-window
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add vite-plugin-pwa and workbox-window"
```

---

## Task 2: Configure Vite PWA Plugin

**Files:**
- Modify: `vite.config.ts`

**Step 1: Add VitePWA import**

At the top of `vite.config.ts`, add:

```typescript
import { VitePWA } from "vite-plugin-pwa";
```

**Step 2: Add VitePWA plugin to plugins array**

In the `plugins` array, add `VitePWA()` configuration after `devtools()`:

```typescript
plugins: [
  devtools(),
  VitePWA({
    registerType: "prompt",
    includeAssets: [
      "favicon.svg",
      "apple-touch-icon.png",
      "logo192.png",
      "logo512.png",
    ],
    manifest: {
      short_name: "Agent Dash",
      name: "AI Agent Dashboard",
      icons: [
        {
          src: "favicon.svg",
          type: "image/svg+xml",
          sizes: "any",
        },
        {
          src: "logo192.png",
          type: "image/png",
          sizes: "192x192",
        },
        {
          src: "logo512.png",
          type: "image/png",
          sizes: "512x512",
        },
      ],
      start_url: "/",
      display: "standalone",
      theme_color: "#0a0a0a",
      background_color: "#0a0a0a",
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "google-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
          },
        },
      ],
    },
  }),
  nitro(),
  // ... rest of plugins
],
```

**Step 3: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: No type errors

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat(pwa): configure vite-plugin-pwa"
```

---

## Task 3: Create Service Worker Update Hook

**Files:**
- Create: `src/hooks/useServiceWorkerUpdate.ts`

**Step 1: Create the hook file**

Create `src/hooks/useServiceWorkerUpdate.ts` with:

```typescript
import { useCallback, useEffect, useState } from "react";
import type { Workbox } from "workbox-window";

export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);

  const updateApp = useCallback(() => {
    if (wb) {
      wb.addEventListener("controlling", () => {
        window.location.reload();
      });
      wb.messageSkipWaiting();
    }
  }, [wb]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      import("workbox-window").then(({ Workbox }) => {
        const workbox = new Workbox("/sw.js");

        workbox.addEventListener("waiting", () => {
          setUpdateAvailable(true);
        });

        workbox.register();
        setWb(workbox);
      });
    }
  }, []);

  return { updateAvailable, updateApp };
}
```

**Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: No type errors

**Step 3: Commit**

```bash
git add src/hooks/useServiceWorkerUpdate.ts
git commit -m "feat(pwa): add useServiceWorkerUpdate hook"
```

---

## Task 4: Create Update Notification Component

**Files:**
- Create: `src/components/UpdateNotification.tsx`

**Step 1: Create the component file**

Create `src/components/UpdateNotification.tsx` with:

```typescript
import { useEffect } from "react";
import { toast } from "sonner";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

export function UpdateNotification() {
  const { updateAvailable, updateApp } = useServiceWorkerUpdate();

  useEffect(() => {
    if (updateAvailable) {
      toast("Update Available", {
        description: "A new version is available",
        action: {
          label: "Update",
          onClick: updateApp,
        },
        duration: Number.POSITIVE_INFINITY,
      });
    }
  }, [updateAvailable, updateApp]);

  return null;
}
```

**Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/UpdateNotification.tsx
git commit -m "feat(pwa): add UpdateNotification component"
```

---

## Task 5: Update Root Layout

**Files:**
- Modify: `src/routes/__root.tsx`

**Step 1: Add UpdateNotification import**

Add import at the top of `__root.tsx`:

```typescript
import { UpdateNotification } from "@/components/UpdateNotification";
```

**Step 2: Remove inline SW registration from headScript**

Replace the current `headScript` constant with:

```typescript
// Inline script to prevent FOUC (Flash of Unstyled Content)
const headScript = `
(function() {
  var theme = localStorage.getItem('theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.classList.add(theme);
})();
`;
```

Remove the service worker registration lines (the vite-plugin-pwa handles registration now).

**Step 3: Add UpdateNotification component**

In the `RootComponent` function, update the `<Provider>` block to include `<UpdateNotification />`:

```typescript
<Provider queryClient={queryClient}>
  <Outlet />
  <UpdateNotification />
</Provider>
```

**Step 4: Run typecheck**

Run:
```bash
pnpm typecheck
```

Expected: No type errors

**Step 5: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(pwa): integrate UpdateNotification in root layout"
```

---

## Task 6: Remove Old Service Worker

**Files:**
- Delete: `public/sw.js`

**Step 1: Remove the old service worker file**

The `vite-plugin-pwa` will generate a new service worker during build. Remove the old minimal one:

Run:
```bash
git rm public/sw.js
```

Expected: File removed

**Step 2: Commit**

```bash
git commit -m "chore(pwa): remove old minimal service worker"
```

---

## Task 7: Test PWA Configuration

**Files:**
- None (testing only)

**Step 1: Build the app**

Run:
```bash
pnpm build
```

Expected: Build completes successfully, should see logs from vite-plugin-pwa about precache manifest generation

**Step 2: Preview the build**

Run:
```bash
pnpm preview
```

Expected: Server starts on port (default 3000)

**Step 3: Verify service worker registration**

1. Open browser to preview URL (e.g., `http://localhost:3000`)
2. Open DevTools → Application → Service Workers
3. Verify `/sw.js` is registered and activated

Expected: Service worker active, status "activated"

**Step 4: Verify caching**

1. In DevTools → Application → Cache Storage
2. Check for cache entries (e.g., `workbox-precache-v2-<hash>`)
3. Reload the page
4. In DevTools → Network tab, verify assets show "(from ServiceWorker)"

Expected: Assets served from cache

**Step 5: Stop preview**

Press `Ctrl+C` to stop the preview server

---

## Task 8: Test Update Flow (Manual)

**Files:**
- Modify: `src/routes/__root.tsx` (temporary change for testing)

**Step 1: Make a visible change**

In `src/routes/__root.tsx`, change the 404 page heading or add a console.log:

```typescript
notFoundComponent: () => (
  <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
    <div className="text-center">
      <h1 className="text-6xl font-bold font-heading text-primary">404 v2</h1>
      {/* ... rest */}
```

**Step 2: Rebuild**

Run:
```bash
pnpm build
```

Expected: New build with different hash

**Step 3: Start preview again**

Run:
```bash
pnpm preview
```

**Step 4: Verify update notification**

1. With the preview server running and a browser tab open from the previous build
2. Reload the page
3. The new service worker should be detected
4. Verify toast appears with "Update Available" message

Expected: Toast notification visible with "Update" button

**Step 5: Test update action**

Click the "Update" button in the toast

Expected: Page reloads, new version (404 v2) visible if you navigate to a non-existent route

**Step 6: Revert test change**

Revert the temporary change to `__root.tsx`:

```bash
git checkout src/routes/__root.tsx
```

**Step 7: Stop preview**

Press `Ctrl+C`

---

## Task 9: Update Documentation

**Files:**
- Modify: `docs/plans/2026-02-23-pwa-caching-force-update-design.md`

**Step 1: Mark design as implemented**

Update the status line in the design doc:

```markdown
**Date:** 2026-02-23  
**Status:** Implemented
```

**Step 2: Commit**

```bash
git add docs/plans/2026-02-23-pwa-caching-force-update-design.md
git commit -m "docs: mark PWA design as implemented"
```

---

## Task 10: Final Validation

**Files:**
- None (validation only)

**Step 1: Run full validation**

Run:
```bash
pnpm validate
```

Expected: All checks pass (typecheck, lint, format, tests)

**Step 2: Build and verify in production mode**

Run:
```bash
pnpm build
pnpm preview
```

**Step 3: Run Lighthouse PWA audit (optional)**

1. Open preview in Chrome
2. DevTools → Lighthouse
3. Select "Progressive Web App" category
4. Run audit

Expected: PWA audit passes, score 90+ (100 ideal)

**Step 4: Stop preview**

Press `Ctrl+C`

---

## Success Criteria

- [ ] `vite-plugin-pwa` and `workbox-window` installed
- [ ] Vite config includes PWA plugin with correct settings
- [ ] `useServiceWorkerUpdate` hook created and working
- [ ] `UpdateNotification` component created and integrated
- [ ] Old `public/sw.js` removed
- [ ] Inline SW registration removed from `__root.tsx`
- [ ] Build generates service worker with precache manifest
- [ ] Assets load from cache on repeat visits
- [ ] Update toast appears when new version deployed
- [ ] Clicking "Update" reloads with latest version
- [ ] All tests pass, typecheck passes
- [ ] No lint/format errors

---

## Notes

- **Service workers only work in production builds** — always test with `pnpm build && pnpm preview`, not `pnpm dev`
- **HTTPS required in production** — service workers won't register on HTTP (localhost is exempt)
- **Cache debugging** — use DevTools → Application → Cache Storage to inspect caches
- **Update testing** — use DevTools → Application → Service Workers → "Update on reload" during development
- **Manifest** — the plugin can inline the manifest or use `public/manifest.json` (we're inlining it in the config)
