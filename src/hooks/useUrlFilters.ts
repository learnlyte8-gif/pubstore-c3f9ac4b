import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Tiny URL-state hook: reads/writes flat string query params and exposes
 * a setter that merges and removes empties. Designed for filter bars.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const out = { ...defaults } as T;
    (Object.keys(defaults) as (keyof T)[]).forEach((k) => {
      const v = params.get(String(k));
      if (v != null) (out as Record<string, string>)[String(k)] = v;
    });
    return out;
  }, [params, defaults]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => {
            if (v == null || v === "" || v === defaults[k as keyof T]) {
              next.delete(k);
            } else {
              next.set(k, String(v));
            }
          });
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { values, update, reset };
}
