# Make displayed search results truly AI-ranked

## What will change
- Keep semantic retrieval for finding candidates across the full product catalog.
- Add an AI relevance-ranking pass that reads the shopper’s natural-language request and selects/orders only products that genuinely satisfy it.
- Return an explicit result source so the page can distinguish AI-ranked results from keyword fallback results.
- Show AI-ranked products first without mixing ordinary keyword matches into the visible result list when AI succeeds.

## Verification
- Deploy and call the search with natural-language queries whose words differ from product titles.
- Confirm the response identifies itself as AI-ranked and the displayed order matches the shopper’s intent.
- Confirm keyword fallback still works if AI ranking is unavailable.
