import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

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

// ---------------------------------------------------------------------------
// Service Worker registration (push-only, no offline caching)
// ---------------------------------------------------------------------------
// Only register outside the Lovable preview iframe so we don't pollute the
// editor with a persistent SW. Push notifications still need this in production.
if ("serviceWorker" in navigator) {
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app");

  if (inIframe || isPreviewHost) {
    // Clean up any old registrations from previous experiments while in the editor.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    });
    // Allow the SW to navigate the page after a notification click.
    navigator.serviceWorker.addEventListener("message", (e) => {
      const data = e.data as { type?: string; url?: string } | undefined;
      if (data?.type === "navigate" && data.url) {
        window.location.assign(data.url);
      }
    });
  }
}
