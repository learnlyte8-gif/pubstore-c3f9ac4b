import { useEffect } from "react";

/**
 * Keep the mobile status bar / browser chrome color in sync with the app's
 * background color (which is what the sticky appbar uses).
 * - Updates <meta name="theme-color"> dynamically (PWA + Chrome/Android).
 * - If running inside Capacitor, also calls the StatusBar plugin.
 */
export function useStatusBarSync() {
  useEffect(() => {
    const apply = async () => {
      const styles = getComputedStyle(document.documentElement);
      const bg = styles.getPropertyValue("--background").trim(); // "0 0% 100%"
      if (!bg) return;
      const hsl = `hsl(${bg})`;
      // Convert to hex for theme-color (some browsers reject hsl())
      const hex = hslStringToHex(bg) || "#ffffff";

      // Remove media-scoped theme-color metas to avoid conflicts.
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.parentElement?.removeChild(m));

      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", hex);
      document.head.appendChild(meta);

      // Capacitor native bridge (only when actually inside the native app).
      try {
        const cap = (window as any).Capacitor;
        if (cap?.isNativePlatform?.()) {
          const mod = await import("@capacitor/status-bar");
          const isDark = document.documentElement.classList.contains("dark");
          await mod.StatusBar.setBackgroundColor({ color: hex }).catch(() => {});
          await mod.StatusBar.setStyle({ style: isDark ? mod.Style.Dark : mod.Style.Light }).catch(() => {});
          await mod.StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        }
      } catch {
        /* plugin not installed natively yet — safe to ignore */
      }
      // Keep `hsl` reference to avoid TS unused warning in dev.
      void hsl;
    };

    apply();

    // Re-apply when light/dark class flips on <html>.
    const obs = new MutationObserver(() => apply());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", apply);

    return () => {
      obs.disconnect();
      mq.removeEventListener?.("change", apply);
    };
  }, []);
}

function hslStringToHex(hslTriplet: string): string | null {
  // hslTriplet like "0 0% 100%" or "220 14% 96%"
  const m = hslTriplet.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return null;
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) => Math.round((n + mm) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
