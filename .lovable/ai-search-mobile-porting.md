# AI Search — Mobile Parity Guide

This guide describes the current Pubstore web search and the behavior Flutter and React Native must reproduce. Search is universal, fast, free to shoppers, and works for signed-in users and guests.

## 1. User experience

The mobile search screen should have two phases:

1. **While typing:** immediately rank a cached local pool on the device. Debounce input by about 250 ms so results do not jump on every keystroke.
2. **On submit:** call the shared `semantic-search` backend function. Replace the local suggestions with the returned universal results while preserving their exact order.

Do not block the screen while waiting for the server. Keep the local results visible with a small loading indicator. Ignore stale responses when the shopper changes the query before an earlier request finishes.

Show an **AI matched** chip only when the response source is `ai-ranked`.

Normal search does **not** consume AI credits.

## 2. What search covers

One submitted query can return a mixed, ranked list containing:

| `kind` | ID prefix | Destination |
|---|---:|---|
| `product` | `p:` | Product detail screen using the unprefixed UUID |
| `supplier` | `s:` | Supplier/store detail |
| `service` | `sv:` | Services screen focused on the provider |
| `property` | `pr:` | Property listing/detail |
| `finance` | `fn:` | Finance listing/detail |
| `vehicle` | `vh:` | Vehicle listing/detail |
| `stay` | `st:` | Stay listing/detail |
| `industrial` | `in:` | Industrial listing/detail |
| `news` | `nw:` | News article |
| `user` | `u:` | Public profile |
| `restaurant` | `rs:` | Restaurant detail |
| `live` | `lv:` | Live stream |
| `ride` | `rd:` | Main rides screen; there is no ride detail screen yet |

The server's `href` is useful on web, but mobile should navigate from `kind` plus the unprefixed ID. Do not copy web URLs into a native navigator.

## 3. Local search while typing

Port the web `rankSearch` behavior to the mobile app:

- Normalize to lowercase and tokenize the query.
- Drop conversational stopwords such as “I”, “want”, “need”, “looking”, and “buy”.
- Score title, category, badge, supplier name, and description.
- Support exact, prefix, contains, and Damerau–Levenshtein typo matches.
- Require at least half the meaningful query tokens to match.
- Use popularity, rating, free shipping, and ending-soon deals only as small tie-breakers.

Load a limited active-item pool when the screen opens and cache it in memory. The local ranker exists for instant feedback; it is not the final authority after submit.

## 4. Calling the shared search function

Send a POST request to the existing `semantic-search` function:

```http
POST <BACKEND_URL>/functions/v1/semantic-search
Authorization: Bearer <user access token or public app key>
Content-Type: application/json

{"query":"place to stay in Harare","limit":60}
```

Rules:

- Trim the query and cap it at 120 characters.
- Do not submit fewer than 2 characters.
- Use the signed-in access token when available; otherwise use the app's public key.
- Do not add an AI-credit check or AI-credit header.
- Add a mobile request timeout of roughly 10–12 seconds and retain local results if it expires.

## 5. What happens on the server

The current pipeline is:

1. Product embedding search and all non-product database searches run **in parallel**.
2. Products are matched by meaning across the full catalog using 1,536-dimensional embeddings.
3. If product embedding search fails or returns no products, the trigram `search_products` fallback runs immediately. Non-product matches never suppress the product fallback.
4. Suppliers, services, properties, finance, vehicles, stays, industrial listings, news, profiles, restaurants, live streams, and rides are matched concurrently.
5. Up to 24 compact candidates are sent to the AI ranker, which orders the entire mixed set and drops only clearly unrelated entries.
6. The AI pass has an 8-second server cutoff. If it is unavailable or slow, the server returns semantic or keyword results instead of failing the search.
7. Results are cached in each warm server instance for 5 minutes, up to 200 query/limit combinations. Repeat searches can return almost instantly.

The mobile app must not repeat embeddings or AI ranking locally. It should call this shared function so web and mobile stay consistent.

## 6. Response contract

```json
{
  "results": [
    {
      "id": "p:87c1…",
      "kind": "product",
      "title": "Wireless earbuds",
      "description": "…",
      "category_slug": "electronics",
      "price": 19.99,
      "image": "https://…",
      "rating": 4.6,
      "review_count": 128,
      "sold": 540,
      "free_shipping": true,
      "moq": 1,
      "lead_time": "0–2 days",
      "ready_to_ship": true
    },
    {
      "id": "rs:14b2…",
      "kind": "restaurant",
      "title": "Example Restaurant",
      "category_slug": "Grill",
      "price": 2,
      "image": "https://…",
      "href": "/restaurants/14b2…"
    }
  ],
  "source": "ai-ranked"
}
```

`source` is one of:

- `ai-ranked`: the mixed results were ordered by the AI ranker.
- `semantic`: embeddings worked, but AI ranking was unavailable or produced no usable order.
- `keyword`: products came from the trigram fallback; other matching categories may still be present.
- `empty`: the query was too short or nothing matched.

All returned IDs are prefixed. Split on the **first colon**:

```ts
function splitSearchId(value: string) {
  const colon = value.indexOf(':');
  return colon < 0
    ? { prefix: '', rawId: value }
    : { prefix: value.slice(0, colon), rawId: value.slice(colon + 1) };
}
```

Never prefix an ID again if it already contains a recognized prefix.

## 7. Result ordering and merging

The submitted server response is authoritative:

- Preserve the exact returned order for `ai-ranked` results.
- Do not separate products and other categories and then concatenate them; that destroys universal ranking.
- Do not mix local product matches into `ai-ranked` results.
- For `semantic` and `keyword`, preserve server order unless the shopper explicitly chooses a sort option.
- Apply price, rating, shipping, country, verified, MOQ, and ready-to-ship filters **after** receiving and mapping results.
- An explicit shopper-selected sort may override server order.
- If the request fails completely, keep the local results and optionally call `search_products` directly as the last product-only fallback.

Pseudocode:

```text
on query changed:
    generation += 1
    localResults = rankSearch(cachedPool, query)

on submit:
    requestGeneration = generation
    show localResults + loading state
    response = semanticSearch(query)
    if requestGeneration != generation:
        discard response
    else if response is valid:
        results = response.results          # exact mixed order
        source = response.source
        showAiChip = source == "ai-ranked"
    else:
        keep localResults
```

## 8. Mobile result model

Use one universal result model rather than trying to decode every row into a product:

```ts
type SearchKind =
  | 'product' | 'supplier' | 'service' | 'property' | 'finance'
  | 'vehicle' | 'stay' | 'industrial' | 'news' | 'user'
  | 'restaurant' | 'live' | 'ride';

type UniversalSearchResult = {
  id: string;
  kind: SearchKind;
  title: string;
  description?: string | null;
  category_slug?: string | null;
  badge?: string | null;
  price?: number | null;
  image?: string | null;
  rating?: number;
  review_count?: number;
  sold?: number;
  free_shipping?: boolean;
  moq?: number | null;
  lead_time?: string | null;
  ready_to_ship?: boolean;
  supplier_id?: string;
  city?: string;
  country?: string;
  verified?: boolean;
  href?: string;
};
```

Unknown `kind` values should render a safe generic result row rather than crashing an older mobile release.

## 9. React Native reference

```ts
async function universalSearch(query: string, limit = 60) {
  const clean = query.trim().slice(0, 120);
  if (clean.length < 2) return { results: [], source: 'empty' as const };

  const { data: { session } } = await supabase.auth.getSession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${BACKEND_URL}/functions/v1/semantic-search`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? PUBLIC_APP_KEY}`,
      },
      body: JSON.stringify({ query: clean, limit }),
    });

    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const body = await response.json();
    return {
      results: Array.isArray(body.results) ? body.results : [],
      source: body.source ?? 'empty',
    };
  } finally {
    clearTimeout(timer);
  }
}
```

Catch abort/network errors in the screen and keep the already-visible local results. Do not show a raw server error to the shopper.

## 10. Flutter reference

```dart
Future<Map<String, dynamic>> universalSearch(
  String query, {
  int limit = 60,
}) async {
  final clean = query.trim().substring(0, min(query.trim().length, 120));
  if (clean.length < 2) return {'results': [], 'source': 'empty'};

  final session = supabase.auth.currentSession;
  final response = await http
      .post(
        Uri.parse('$backendUrl/functions/v1/semantic-search'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization':
              'Bearer ${session?.accessToken ?? publicAppKey}',
        },
        body: jsonEncode({'query': clean, 'limit': limit}),
      )
      .timeout(const Duration(seconds: 12));

  if (response.statusCode != 200) {
    throw Exception('Search unavailable');
  }

  final body = jsonDecode(response.body) as Map<String, dynamic>;
  return {
    'results': (body['results'] as List? ?? const []),
    'source': body['source'] ?? 'empty',
  };
}
```

Catch timeout/network failures in the controller and keep local results visible.

## 11. Navigation rules

Map `kind` to native screens. Important special cases:

- Strip `p:` before opening a product.
- Strip `rs:` and open the restaurant detail screen. The equivalent web path is `/restaurants/:id`, not a query-string URL.
- A `ride` result opens the main rides screen because no individual ride-detail screen exists yet.
- A supplier result may represent a normal supplier only; mirror suppliers are excluded by the server.
- Do not trust an unknown web `href` as a native deep link. Use the mobile route map.

## 12. Optional features on the search screen

These are separate from ordinary search:

- **Tapson's take:** streamed buying guidance from `tapson-chat`; this is AI-credit metered.
- **Image search:** turns a photo into search terms through `image-search`; this is AI-credit metered.
- **Because you searched:** recommendations based on persisted recent queries.

Do not accidentally charge ordinary text search while adding these features.

## 13. Test checklist

- [ ] Results appear immediately while typing, before the network responds.
- [ ] A submitted query returns a mixed list across products and other categories.
- [ ] `ai-ranked` order is not changed by the client.
- [ ] The AI matched chip appears only for `ai-ranked`.
- [ ] Guests can search with the public app key.
- [ ] Signed-in users search with their access token.
- [ ] A failed embedding call still returns keyword products even when non-products match.
- [ ] A slow/unavailable ranker returns semantic or keyword results without an error screen.
- [ ] Stale responses cannot replace results for a newer query.
- [ ] Repeating the same query is faster because the server cache is reused.
- [ ] Restaurant taps open the selected restaurant detail screen.
- [ ] Ride taps open the main rides screen.
- [ ] Prefixed IDs are stripped exactly once.
- [ ] Unknown result kinds do not crash the app.
- [ ] Filters run after the server result is received.
- [ ] Explicit sort is the only action that may replace AI order.
- [ ] Ordinary search does not consume AI credits.

## 14. Do not do these

- Do not implement mobile search with only `title ilike`.
- Do not call the embedding RPC directly from mobile.
- Do not run an AI model in the mobile app for ranking.
- Do not perform products first and other categories later on the client.
- Do not merge local product noise into `ai-ranked` results.
- Do not discard product fallback results because another category matched.
- Do not use `/restaurants?id=…`; restaurant detail uses an ID path on web and a detail route on mobile.
- Do not navigate rides to a nonexistent detail screen.
- Do not display raw backend or AI errors to shoppers.
- Do not add AI-credit charging to ordinary search.
