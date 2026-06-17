import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const shouldRegisterAppServiceWorker = () => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return false;

  const host = window.location.hostname;
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const params = new URLSearchParams(window.location.search);
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  return !inIframe && !isPreviewHost && params.get("sw") !== "off";
};

const cleanupAppServiceWorkers = async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((reg) => new URL(reg.scope).pathname === "/")
      .map((reg) => reg.unregister().catch(() => false)),
  );
};

createRoot(document.getElementById("root")!).render(
  <HelmetProvider><App /></HelmetProvider>
);

// ---------------------------------------------------------------------------
// Native-app feel: suppress browser long-press / right-click menus globally,
// except inside editable fields where the OS menu is expected.
// ---------------------------------------------------------------------------
const isEditable = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    !!el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], .select-text')
  );
};
window.addEventListener("contextmenu", (e) => {
  if (!isEditable(e.target)) e.preventDefault();
});
// Prevent iOS image/link callouts from drag-start
window.addEventListener("dragstart", (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "IMG" || t.tagName === "A")) e.preventDefault();
});
// Prevent pinch-zoom gesture artifacts on iOS Safari
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
// Block pinch / ctrl+wheel zoom on desktop
window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault();
});
// Block iOS double-tap zoom
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// ---------------------------------------------------------------------------
// Swallow Supabase auth-token lock contention errors. These happen when
// multiple tabs / hooks race to refresh the session and the navigator.locks
// mutex is "stolen" — the SDK still recovers on the next call, but the
// AbortError otherwise surfaces as a noisy unhandled rejection that can
// look like a network outage.
// ---------------------------------------------------------------------------
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e.reason as { message?: string })?.message ?? e.reason ?? "");
  if (
    msg.includes("Lock") && (msg.includes("stolen") || msg.includes("steal") || msg.includes("released"))
  ) {
    e.preventDefault();
  }
});

// ---------------------------------------------------------------------------
// Service Worker registration (push + installable app support)
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  if (!shouldRegisterAppServiceWorker()) {
    void cleanupAppServiceWorkers();
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    });
    navigator.serviceWorker.addEventListener("message", (e) => {
      const data = e.data as { type?: string; url?: string } | undefined;
      if (data?.type === "navigate" && data.url) {
        window.location.assign(data.url);
      }
    });
  }
}
