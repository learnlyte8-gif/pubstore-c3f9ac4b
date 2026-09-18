import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aiFunctionHeaders } from "@/lib/aiAuth";
import type { UniversalHit } from "@/hooks/useUniversalSearch";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/semantic-search`;

type Row = {
  id: string;
  kind?: string | null;
  title: string;
  description: string | null;
  category_slug: string | null;
  badge: string | null;
  price: number | null;
  image: string | null;
  rating: number | null;
  review_count: number | null;
  sold: number | null;
  free_shipping: boolean | null;
  moq: number | null;
  lead_time: string | null;
  ready_to_ship: boolean | null;
  href?: string | null;
  city?: string | null;
  country?: string | null;
  verified?: boolean | null;
  score?: number | null;
};

/**
 * The server returns already-prefixed ids (`p:`, `s:`, `sv:`…) that match the
 * client pool's id scheme, plus the vertical in `kind` and a ready `href`.
 * Older keyword rows (bare uuid, products only) are still handled.
 */
function toHit(row: Row): UniversalHit {
  const moq = row.moq == null ? null : Number(row.moq);
  const kind = (row.kind ?? "product") as UniversalHit["kind"];
  const bare = row.id.includes(":") ? row.id.split(":").slice(1).join(":") : row.id;
  return {
    id: row.id.includes(":") ? row.id : `p:${row.id}`,
    kind,
    title: row.title,
    category: row.category_slug ?? "products",
    badge: row.badge ?? null,
    description: row.description ?? "",
    image: row.image,
    href: row.href ?? `/product/${bare}`,
    price: row.price == null ? null : Number(row.price),
    rating: Number(row.rating ?? 0),
    reviews: row.review_count ?? 0,
    sold: row.sold ?? 0,
    freeShipping: !!row.free_shipping,
    dealEndsAt: null,
    moq,
    leadTime: row.lead_time ?? null,
    readyToShip: !!row.ready_to_ship,
    city: row.city ?? null,
    country: row.country ?? null,
    verified: !!row.verified,
  };
}

/**
 * Full-catalog matches for a query across every vertical.
 *
 * The client-side pool only holds a slice of the catalog, so submitted searches
 * also hit the server: the `semantic-search` edge function (vector embeddings +
 * AI re-ranking over products, suppliers, services, stays, vehicles, news…),
 * falling back to the trigram `search_products` RPC whenever AI is unavailable.
 */
export function useSemanticProducts(query: string, limit = 60) {
  const q = query.trim();
  return useQuery({
    queryKey: ["semantic-products", q, limit],
    enabled: q.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ hits: UniversalHit[]; source: string }> => {
      try {
        const res = await fetch(FN_URL, {
          method: "POST",
          headers: await aiFunctionHeaders(),
          body: JSON.stringify({ query: q, limit }),
        });
        if (res.ok) {
          const body = await res.json();
          const rows: Row[] = body?.results ?? [];
          if (rows.length) return { hits: rows.map(toHit), source: body?.source ?? "semantic" };
        }
      } catch {
        // fall through to keyword search
      }
      const { data } = await supabase.rpc("search_products", { search_query: q, result_limit: limit });
      return { hits: ((data as Row[]) ?? []).map(toHit), source: "keyword" };
    },
  });
}
