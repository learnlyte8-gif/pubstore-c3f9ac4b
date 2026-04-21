// PUBSTORE Service Worker — Web Push only.
// Intentionally minimal: no fetch caching, no offline support — we only
// register this SW so we can receive push notifications.

self.addEventListener("install", (event) => {
  // Activate immediately on first install so push works without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
        // If a tab from our origin is already open, focus it and navigate.
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
