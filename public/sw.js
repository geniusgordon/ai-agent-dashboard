// Minimal service worker — required for PWA "Add to Home Screen".
// No caching: every request goes to the network.
// Bump the version to force re-install if you ever change this file.
const VERSION = "1";

self.addEventListener("install", () => {
  // Activate immediately, don't wait for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all open tabs so the new SW takes effect immediately
  event.waitUntil(self.clients.claim());
});

// Network-only: no caching at all
self.addEventListener("fetch", () => {
  // Falling through without calling event.respondWith()
  // lets the browser handle the request normally (network-only).
});
