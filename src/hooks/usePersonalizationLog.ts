import { useCallback, useEffect, useState } from "react";

/**
 * Lightweight client-side log of product interactions used to bias the
 * personalized feed ranking. Stored in localStorage so it survives reloads
 * and is also available to guests. Cap entries to keep storage bounded.
 */
const KEY = "pubstore.personalization-log";
const MAX = 200;

export type PersonalizationEvent = {
  productId: string;
  category?: string | null;
  title?: string | null;
  ts: number;
  source?: string;
};

function read(): PersonalizationEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(entries: PersonalizationEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
    // notify listeners in same tab
    window.dispatchEvent(new CustomEvent("pubstore:personalization-log"));
  } catch {
    /* ignore */
  }
}

export function logProductClick(p: { id: string; category?: string | null; title?: string | null }, source = "click") {
  const entry: PersonalizationEvent = {
    productId: p.id,
    category: p.category ?? null,
    title: p.title ?? null,
    ts: Date.now(),
    source,
  };
  const next = [entry, ...read().filter((e) => e.productId !== p.id)];
  write(next);
}

/** React hook: returns category-affinity counts derived from logged clicks. */
export function useClickAffinity(): { counts: Record<string, number>; tokens: string[]; version: number } {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("pubstore:personalization-log", bump);
    window.addEventListener("storage", (e) => {
      if (!e.key || e.key === KEY) bump();
    });
    return () => window.removeEventListener("pubstore:personalization-log", bump);
  }, []);

  const entries = read();
  const counts: Record<string, number> = {};
  const tokenSet = new Set<string>();
  entries.forEach((e, i) => {
    // Newer clicks weigh more; recency curve from 3 → 1.
    const weight = Math.max(1, 3 - Math.floor(i / 20));
    if (e.category) counts[e.category] = (counts[e.category] ?? 0) + weight;
    if (e.title) {
      e.title
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 4)
        .slice(0, 4)
        .forEach((t) => tokenSet.add(t));
    }
  });
  return { counts, tokens: Array.from(tokenSet), version };
}

export function useRefreshFeed() {
  const [seed, setSeed] = useState(0);
  const refresh = useCallback(() => setSeed((s) => s + 1), []);
  return { seed, refresh };
}
