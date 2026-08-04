# Search-based AI recommendations ("Because you searched")

Shows products semantically matched to a shopper's most recent search phrases,
placed directly under the "Because you browsed" strip on Home.

## Data flow

```text
Search page  ──> localStorage "pubstore.recent-searches" (max 8 phrases)
Home strip   ──> useSearchRecommendations(limit)
                 └─> POST /functions/v1/search-recommendations { queries[<=3], limit }
                       ├─ cache hit  (search_reco_cache, 24h TTL) → product ids
                       └─ cache miss → embed query (Lovable AI, 1536 dims)
                                      → rpc search_products_semantic
                                      → fallback rpc search_products (trigram)
                                      → upsert cache
                 └─> fetchProductsByIds(ids)  → Product[] (order preserved)
```

## Backend

### Table `public.search_reco_cache`
| column | purpose |
| --- | --- |
| `query_key` (PK) | SHA-256 of `v1:<lowercased query>` |
| `query` | original phrase (debugging) |
| `product_ids` | jsonb array of ranked product ids |
| `created_at` | TTL anchor (24h) |

RLS enabled; a single `FOR ALL TO service_role` policy — no client can read or write it.
Grants: `ALL` to `service_role` only.

### Edge function `search-recommendations` (`verify_jwt = false`)
- Accepts `{ queries: string[] } | { query: string }`, `limit` (max 24). Takes at
  most the 3 most recent phrases, each ≥ 2 chars.
- Per query: cache lookup → on miss, embed with the Lovable AI Gateway
  (`POST https://ai.gateway.lovable.dev/v1/embeddings`, model
  `openai/text-embedding-3-small`, `dimensions: 1536` to match
  `products.search_embedding`) using the `Lovable-API-Key` header.
- Semantic match via `search_products_semantic(search_query, query_embedding, result_limit)`.
- If embedding or the RPC fails, falls back to the trigram RPC `search_products`
  so the strip still renders instead of disappearing.
- Result ids are cached (upsert) before returning.
- Merge/rank across queries: each query gets `recencyWeight = 1/(index+1)`, each
  id scores `recencyWeight * (perQuery - rank)`; scores sum across queries and the
  top `limit` ids are returned. The newest search therefore dominates.
- Response: `{ productIds: string[], queries: string[], source: "cache" | "ai" | "empty" }`.
- Runs with the service role, is unauthenticated (works for guests) and does **not**
  charge AI credits — cost is bounded by the 24h cache, so a home-page view is
  usually free.

## Frontend

- `src/hooks/useSearchRecommendations.ts`
  - `loadRecentSearches()` / `useRecentSearches()` read the same
    `pubstore.recent-searches` key the Search page writes, and resync on
    `focus` / `storage`.
  - `useSearchRecommendations(limit = 12)` — React Query, `enabled` only when at
    least one phrase exists, `staleTime` 10 min, key `["search-recommendations", queries, limit]`.
    Invokes the edge function, then hydrates full products.
- `src/data/products.ts` → `fetchProductsByIds(ids)`: single `in("id", ids)` query on
  the list column set, `active = true`, re-sorted to the incoming id order (cap 40).
- `src/components/marketplace/SearchRecommendationStrip.tsx`: horizontal rail of
  `ProductCard variant="compact"`, skeletons while loading, renders `null` when the
  shopper has no searches or nothing matched. Subtitle echoes the newest phrase.
- `src/pages/Home.tsx`: new section immediately after "Because you browsed",
  `SectionHeader icon={Sparkles} title="Because you searched"`.

## Mobile port checklist (RN / Flutter)

1. Persist recent searches on the search screen (AsyncStorage / SharedPreferences,
   key `pubstore.recent-searches`, newest first, max 8, case-insensitive dedupe).
2. Call `functions/v1/search-recommendations` with `{ queries, limit }` — no auth
   required, anon key is enough.
3. Fetch products by the returned ids (`products` select with `suppliers!inner`,
   `active = true`) and reorder client-side to match the id order.
4. Render a horizontal product rail titled "Because you searched" under the
   browsed rail; hide it when there are no queries or no results.
5. Cache the response client-side for ~10 minutes to match web behaviour.

## Extension points

- Add browsing history phrases (from `usePersonalizationLog` titles) to `queries`
  for cold-start shoppers with no searches.
- Periodic cleanup: `DELETE FROM search_reco_cache WHERE created_at < now() - interval '7 days'`.
- New products need embeddings: keep running the `semantic-search` function's
  `backfill` action, otherwise they only surface via the trigram fallback.
