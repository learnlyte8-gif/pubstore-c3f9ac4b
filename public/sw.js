// PUBSTORE Service Worker — Offline cache + Web Push.
// Built via vite-plugin-pwa (injectManifest strategy).
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// ---------------------------------------------------------------------------
// Precache the built app shell (HTML, JS, CSS, icons)
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Activate updated SW immediately on next load.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// ---------------------------------------------------------------------------
// Runtime caching strategies
// ---------------------------------------------------------------------------

// HTML navigations → Network first, fall back to cached shell when offline.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    !url.pathname.startsWith("/~oauth") &&
    !url.pathname.startsWith("/auth/callback"),
  new NetworkFirst({
    cacheName: "pubstore-pages",
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// JS / CSS / web workers → SWR (fast + auto-updates in background).
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "worker",
  new StaleWhileRevalidate({ cacheName: "pubstore-assets" }),
);

// Images → cache-first with a generous cap.
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "pubstore-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// Fonts → cache-first, long lived.
registerRoute(
  ({ request, url }) =>
    request.destination === "font" ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com"),
  new CacheFirst({
    cacheName: "pubstore-fonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

// Supabase REST/storage GETs → SWR so previously-seen data is available offline.
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) &&
    (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/storage/")),
  new StaleWhileRevalidate({
    cacheName: "pubstore-api",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
);

// Offline fallback: if a navigation has no network AND no cached match,
// return the cached app shell (index.html) so the SPA can still boot and
// render its own empty states.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cache = await caches.open("pubstore-pages");
    const shell =
      (await cache.match("/index.html")) ||
      (await caches.match("/index.html")) ||
      (await caches.match("/"));
    if (shell) return shell;
  }
  return Response.error();
});

// ---------------------------------------------------------------------------
// Web Push (unchanged behaviour)
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try { payload = { title: "PUBSTORE", body: event.data?.text?.() ?? "" }; } catch (_) {}
  }

  const title = payload.title || "PUBSTORE";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    data: { url: payload.url || "/home", ...(payload.data || {}) },
    vibrate: [80, 40, 80],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/home";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            client.postMessage({ type: "navigate", url: target });
            await client.focus();
            return;
          } catch (_) {}
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

// Allow the page to trigger an immediate SW update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
