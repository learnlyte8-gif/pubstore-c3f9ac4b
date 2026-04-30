import { useEffect, useState } from "react";

/**
 * Track scroll direction on window. Returns whether the bottom tab bar
 * should be hidden (user scrolling down past a small threshold).
 * Showing again happens immediately on any upward scroll.
 */
export function useHideOnScroll(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (Math.abs(dy) > threshold) {
          if (dy > 0 && y > 80) setHidden(true);
          else if (dy < 0) setHidden(false);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return hidden;
}
