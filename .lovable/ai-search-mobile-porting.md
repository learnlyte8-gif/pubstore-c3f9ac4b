# AI Search — Mobile Parity Guide (Flutter & React Native)

How the web's search screen works end-to-end, and exactly what each mobile app must
replicate to match it. The web pipeline lives in:

- `src/hooks/useSemanticProducts.ts` — server AI search + keyword fallback
- `src/hooks/useUniversalSearch.ts` — merging rules, filters, the local pool
- `src/lib/search.ts` — on-device fuzzy ranker (`rankSearch`)
- `supabase/functions/semantic-search/index.ts` — embeddings + Gemini re-rank
- `src/pages/Search.tsx` — the UI (chips, filters, sort, Tapson's take)

---

## 1. The pipeline

### Step 1 — Instant local results while typing (no network)

The web app pre-loads a cached pool (~400 products plus suppliers, services,
vehicles, stays, properties, jobs, news) and ranks it **on-device** with
`rankSearch` from `src/lib/search.ts`:

- Tokenizes the query, drops stopwords ("i", "want", "need", "looking", "buy"…).
- Scores each token across 5 weighted fields: title (5), category (2.5),
  badge (1.2), supplier name (1.8), description (1).
- Per-word matching is typo-tolerant: exact = 1.0, prefix = 0.85, contains = 0.6,
  Damerau-Levenshtein distance 1 = 0.5, distance 2 (long tokens) = 0.3.
- Drops items that match fewer than 50% of query tokens.
- Small tie-breakers: popularity (log of sold ×0.6), rating/reviews, free
  shipping (+0.2), active deals ending within 48h (+0.6).

This powers the suggestion list and the instant results shown before submit.

**Mobile requirement:** port `rankSearch` verbatim (pure Dart/Kotlin/TS math —
no dependencies). Load a product pool on first open (simplest: reuse the same
`products` table select the web uses, limit ~400, active only) and keep it in
memory. Debounce text input ~250ms and run the ranker on-device.

### Step 2 — Server AI search on submit

When the shopper **submits** the search (enter key / search button), the web
calls the `semantic-search` edge function:

```
POST {SUPABASE_URL}/functions/v1/semantic-search
Authorization: Bearer <access_token | anon key>
Content-Type: application/json

{ "query": "warm jacket for winter", "limit": 60 }
```

Inside the function:

1. The query is embedded with OpenAI `text-embedding-3-small` (1536 dims) via
   the Lovable AI Gateway.
2. `search_products_semantic` RPC matches that vector against pre-computed
   `products.search_embedding` values across the **full catalog** — not just
   the local slice.
3. The top ~35 semantic candidates go through a **Gemini re-rank**
   (`google/gemini-3.6-flash`, temperature 0). The model reads the shopper's
   request plus compact cards (id, title, category, short description) and
   returns an ordered JSON array of **only** IDs that genuinely satisfy the
   intent (max 24). Weak, incidental, accessory and unrelated matches are
   dropped.

**Ordinary catalog search is free** — it never consumes AI credits, guests
included. No credit gating on this endpoint.

**Mobile requirement:** on submit, POST to the same function. Headers:

- `Authorization: Bearer <supabase access token>` (or the anon key for guests —
  the function is open to shoppers, guests included).
- No extra AI headers needed; this endpoint is not credit-metered.

### Step 3 — Merging rules (critical)

The web response returns `{ results, source }` where `source` is one of
`ai-ranked`, `semantic`, `keyword`, or `empty`.

- **`ai-ranked`** (the normal success path): the AI's ordered hits are the
  authority. They sit at the top in the server's **exact order** (web assigns
  score 1000 − position so downstream sorting never breaks it).
  **Product results are only the AI picks** — keyword-matched products are NOT
  mixed in. Non-product verticals (vehicles, stays, services, jobs, news…) are
  never suppressed; local keyword hits for those still fill in.
- **`semantic`** (AI ranker failed but embeddings worked): full semantic
  result list, in RPC similarity order.
- **`keyword`** (embeddings failed entirely): falls back to the trigram RPC
  `search_products(search_query, result_limit)`. The shopper's search **never
  errors**.
- Local pool keyword results for products are only shown when the server
  returns nothing usable.

**Mobile requirement:** parse `source`; when `ai-ranked`, render *only* those
products for the product section (do not merge your local `ilike` results);
keep other verticals from local search as-is.

### Step 4 — What the UI shows

- An **"AI matched" chip** next to the result count when `source === "ai-ranked"`.
- **Filters (rating, price, free shipping, MOQ, ready-to-ship, verified,
  country) apply after merging.** AI hits are exempt from the verified/country
  filters because server hits carry no supplier metadata.
- **Sort options (price, rating, sold) override AI order** — if the shopper
  explicitly sorts, respect it.
- Recent-search memory (persist last N queries; the web uses them for
  "Because you searched" recommendations via `search-recommendations` —
  optional on mobile v1).

### Step 5 — Extras on the same screen (web)

- **Tapson's take** — a streamed 2–3 sentence AI buying tip via the
  `tapson-chat` edge function (SSE). This one IS credit-gated; guests and
  empty balances skip it. Optional on mobile v1.
- **Image search** — photo → keywords via the `image-search` function
  (credited), then run through the same ranker. Optional on mobile v1.

---

## 2. Response shape

```jsonc
// semantic-search success (ai-ranked)
{
  "results": [
    {
      "id": "uuid",
      "title": "…",
      "description": "…",
      "category_slug": "…",
      "badge": "…",
      "price": 12.5,
      "image": "…",
      "rating": 4.6,
      "review_count": 128,
      "sold": 540,
      "free_shipping": true,
      "moq": 1,
      "lead_time": "…",
      "ready_to_ship": true
      // note: NO score field on ai-ranked — order = rank
    }
  ],
  "source": "ai-ranked"
}
```

`source: "semantic"` rows additionally carry a `score` (cosine similarity).
Map rows to your product model; `moq`/`lead_time`/`ready_to_ship` may be null.

---

## 3. Screen-by-screen parity checklist

| Web behavior | Flutter | React Native |
|---|---|---|
| Debounced on-device fuzzy ranking while typing | port `rankSearch` to Dart | port `rankSearch` (TS — can copy near-verbatim) |
| Pool of ~400 active products loaded for local search | catalog service select | `useSupabaseList` / one-shot select |
| Submit → `semantic-search` POST | `http`/`supabase_client` | `fetch` with `Authorization` header |
| Preserve server hit order for products | don't re-sort AI results | don't re-sort AI results |
| `ai-ranked` ⇒ products are AI picks ONLY | gate local product merge on source | same |
| Other verticals unaffected | keep existing local search | keep existing local search |
| "AI matched" chip by result count | new widget + condition | conditional chip |
| Filters applied post-merge | filter after merge step | filter after merge step |
| Sort overrides AI order | respect explicit sort | respect explicit sort |
| Keyword fallback on any server failure | try/catch → `search_products` RPC | try/catch → `supabase.rpc('search_products', …)` |
| Never show a search error to the shopper | catch-all → empty/keyword state | catch-all → empty/keyword state |
| Recent searches persisted | SharedPreferences | localStorage |

---

## 4. Reference snippets

### Flutter — submit search

```dart
Future<List<Map<String, dynamic>>> semanticSearch(String query, {int limit = 60}) async {
  final client = SupabaseClient(Env.supabaseUrl, Env.supabaseAnonKey);
  try {
    final session = client.auth.currentSession;
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${session?.accessToken ?? Env.supabaseAnonKey}',
    };
    final res = await http.post(
      Uri.parse('${Env.supabaseUrl}/functions/v1/semantic-search'),
      headers: headers,
      body: jsonEncode({'query': query, 'limit': limit}),
    );
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      final rows = (body['results'] as List).cast<Map<String, dynamic>>();
      if (rows.isNotEmpty) {
        aiRanked.value = body['source'] == 'ai-ranked'; // drives the chip
        return rows;
      }
    }
  } catch (_) {/* fall through */}

  // Fallback: trigram keyword RPC — search never errors
  final data = await client.rpc('search_products', params: {
    'search_query': query,
    'result_limit': limit,
  });
  aiRanked.value = false;
  return List<Map<String, dynamic>>.from(data as List);
}
```

### React Native — submit search

```ts
async function semanticSearch(query: string, limit = 60) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/semantic-search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ query, limit }),
      },
    );
    if (res.ok) {
      const body = await res.json();
      if (body.results?.length) return { rows: body.results, source: body.source };
    }
  } catch { /* fall through */ }
  const { data } = await supabase.rpc('search_products', {
    search_query: query, result_limit: limit,
  });
  return { rows: data ?? [], source: 'keyword' };
}
```

### Merging (both platforms, pseudocode)

```text
if source == 'ai-ranked':
    productResults = serverRows                      # AI picks ONLY, keep order
else if source == 'semantic':
    productResults = serverRows (already score-ordered)
else:
    productResults = serverRows (keyword rows)
localProducts = rankSearch(pool, query)               # only if productResults empty
otherVerticals = localSearch(vehicles, stays, ...)    # never suppressed
final = otherVerticals + [productResults]             # render per your layout
chip = (source == 'ai-ranked')
```

---

## 5. Edge cases to test

1. **Query whose words appear nowhere in any title** (e.g. "gift for a
   gardener") — `ai-ranked` must still return sensible products; the old
   `ilike`-only screens return nothing here.
2. **AI ranker returns `[]`** — the function treats a candidate match with no
   qualified picks as an empty `ai-ranked` response; show "No matches" for
   products, keep other verticals.
3. **Embedding service down** — response falls back to `keyword` via the
   trigram RPC; no user-visible error.
4. **Guest (no session)** — search must work with the anon key; no credits.
5. **Slow network** — show the instant local results immediately; the server
   results replace them when they arrive.
6. **Sort selected** — AI order is overridden; only `source === 'ai-ranked'`
   chip behavior changes.
7. **Very long query** — cap at a reasonable length client-side (~120 chars)
   before sending.

---

## 6. What NOT to do

- Do **not** call `supabase.rpc('search_products_semantic', …)` directly from
  the client — you'd have to embed the query yourself; always go through the
  `semantic-search` function.
- Do **not** merge local keyword products into an `ai-ranked` result list —
  that recreates the "keyword noise above real matches" bug this system fixed.
- Do **not** add credit checks on this endpoint — catalog search is free and
  works for guests by design.
- Do **not** re-sort `ai-ranked` results before display (only an explicit user
  sort may reorder them).
