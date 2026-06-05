import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to top on every route change. Handles both window-level
 * scrolling and any inner scroll containers (main, [data-scroll-root]).
 * Also disables browser scroll restoration so back/forward doesn't fight us.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      try { window.history.scrollRestoration = "manual"; } catch {}
    }
  }, []);

  useEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document
        .querySelectorAll<HTMLElement>("main, [data-scroll-root]")
        .forEach((el) => { el.scrollTop = 0; });
    };
    reset();
    const raf = requestAnimationFrame(reset);
    const t = setTimeout(reset, 0);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [pathname]);

  return null;
}
