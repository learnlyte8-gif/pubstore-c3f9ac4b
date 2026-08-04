import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsByIds } from "@/data/products";

const RECENT_KEY = "pubstore.recent-searches";

export function loadRecentSearches(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(arr) ? arr.filter((q) => typeof q === "string" && q.trim().length >= 2) : [];
  } catch {
    return [];
  }
}

/** Recent search phrases, kept in sync with other tabs / the search page. */
export function useRecentSearches(): string[] {
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  useEffect(() => {
    const sync = () => setRecent(loadRecentSearches());
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return recent;
}

/**
 * AI/semantic recommendations derived from the shopper's most recent searches.
 * The edge function embeds each query, matches it against product embeddings
 * and caches the result server-side (24h) so repeat loads are free.
 */
export function useSearchRecommendations(limit = 12) {
  const recent = useRecentSearches();
  const queries = recent.slice(0, 3);

  return useQuery({
    queryKey: ["search-recommendations", queries, limit],
    enabled: queries.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-recommendations", {
        body: { queries, limit },
      });
      if (error) throw error;
      const ids: string[] = data?.productIds ?? [];
      const products = await fetchProductsByIds(ids);
      return { products, queries, source: data?.source as string | undefined };
    },
  });
}
