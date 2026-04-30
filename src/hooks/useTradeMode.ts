import { useEffect, useState, useCallback } from "react";

export type TradeMode = "all" | "retail" | "wholesale";
const KEY = "pubstore.trade-mode";
const EVT = "pubstore.trade-mode.changed";

const read = (): TradeMode => {
  if (typeof window === "undefined") return "all";
  const v = localStorage.getItem(KEY) as TradeMode | null;
  return v === "retail" || v === "wholesale" || v === "all" ? v : "all";
};

export function useTradeMode() {
  const [mode, setMode] = useState<TradeMode>(read);

  useEffect(() => {
    const onChange = () => setMode(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const set = useCallback((next: TradeMode) => {
    localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVT));
    setMode(next);
  }, []);

  return { mode, setMode: set };
}

/** Read recent searches from localStorage (kept in sync with Search page). */
export function getRecentSearchTokens(limit = 20): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("pubstore.recent-searches");
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return [];
    const tokens = arr
      .slice(0, limit)
      .flatMap((q) => q.toLowerCase().split(/\s+/))
      .filter((t) => t.length >= 3);
    return Array.from(new Set(tokens));
  } catch {
    return [];
  }
}
