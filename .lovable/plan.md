
# PUBSTORE Ads Engine

A self-serve ad platform like Google Ads, scoped to the marketplace. Suppliers boost their own products (or other promo content) with wallet-funded campaigns. Buyers see ads in 4 placements; some give loyalty points back.

## 1. Database (new tables)

- **ad_campaigns** — owner_id, supplier_id, product_id, name, placement (`banner`|`inline`|`interstitial`|`rewarded`), pricing_mode (`flat_boost`|`cpc`), daily_budget, max_bid_cpc, total_spent, status (`draft`|`active`|`paused`|`exhausted`|`ended`), starts_at, ends_at, creative (jsonb: headline, tagline, image, video, cta), targeting (jsonb: categories[], countries[], cities[], interests[]).
- **ad_campaign_stats** — daily rollup per campaign: date, impressions, clicks, conversions, spend, points_paid_out.
- **ad_events** — raw log: campaign_id, user_id (nullable), event (`impression`|`click`|`reward_view`|`conversion`), placement, charged, created_at. Auto-aggregated nightly.
- **loyalty_points** — user_id, balance, lifetime_earned.
- **loyalty_ledger** — user_id, delta, reason, reference, created_at.

All with proper GRANTs + RLS (owner manages own campaigns; events insert via security-definer RPC; loyalty read-only for owner).

## 2. Pricing model (hybrid)

- **Flat boost**: pick placement + daily budget (e.g. $1, $5, $20/day). Wallet is debited once per day at midnight UTC for active flat campaigns; ad served until daily impression cap hit.
- **CPC auction** (banner + interstitial premium slots): each request picks the eligible campaign with the highest `max_bid_cpc`; wallet charged per click via `apply_wallet_transaction` (kind: `ad_click`). Daily budget caps spend; campaign auto-pauses on exhaustion.

## 3. Server logic (edge functions + RPC)

- `ads-serve` (edge fn) — input: placement, user context (category, country, interests). Returns ranked eligible campaigns. Uses targeting filters + bid/boost ranking + frequency capping (no more than 1 impression of the same ad per user per 10 min).
- `ads-track` (edge fn) — records impression/click; on click for CPC, calls `charge_ad_click` RPC which debits supplier wallet and increments stats atomically.
- `ads-reward` (edge fn) — on completed rewarded view (≥10s watched), credits user loyalty points (e.g. 5 pts per ad, max 5/day) and charges advertiser a fixed `$0.05` per view.
- `ads-daily-cron` — scheduled (pg_cron + http_post): debits flat-boost daily budgets, resets daily caps, marks `exhausted`/`ended`.

## 4. Frontend

### Advertiser (My Store)
- New section **My Store → Ads** with:
  - Dashboard: spend, impressions, CTR, points awarded per campaign.
  - "New campaign" wizard (4 steps): product → placement → creative (AI-prefill from product) → budget + targeting → review.
  - Pause/resume, edit budget, view stats.

### Buyer
- `useAd(placement, context)` hook — calls `ads-serve`, handles impression beacon on mount, click beacon on tap.
- `<BannerAdSlot />` — replaces current trending-only `BannerAd` with real ad rotation (falls back to trending if no fill).
- `<InlineAdCard />` — sponsored card injected every 6 items in Home/For You/category grids; marked "Sponsored".
- `<InterstitialAdManager />` — shows full-screen ad once per session after 3 navigations or on app foreground; skippable after 3s.
- `<RewardedAdSheet />` — opt-in "Watch ad, earn 5 points" CTA in Wallet + Home reels strip; uses existing `AdReel` 15s player; rewards on completion.

### Loyalty
- `LoyaltyBalance` card in `/wallet` page showing points + history.
- "Redeem points" → coupon (existing `coupons` table) at e.g. 100 pts = $1 off.

## 5. Files

**New**
- `supabase/migrations/<ts>_ads_engine.sql`
- `supabase/functions/ads-serve/index.ts`
- `supabase/functions/ads-track/index.ts`
- `supabase/functions/ads-reward/index.ts`
- `supabase/functions/ads-daily-cron/index.ts`
- `src/hooks/useAds.ts`, `src/hooks/useLoyalty.ts`
- `src/components/ads/BannerAdSlot.tsx`, `InlineAdCard.tsx`, `InterstitialAdManager.tsx`, `RewardedAdSheet.tsx`, `SponsoredBadge.tsx`
- `src/pages/ads/AdsDashboard.tsx`, `AdCampaignWizard.tsx`, `AdCampaignDetail.tsx`
- `src/components/wallet/LoyaltyCard.tsx`

**Modified**
- `src/pages/MyStore.tsx` + `StoreSection.tsx` — add "Ads" entry.
- `src/pages/Home.tsx` — interlace `InlineAdCard`, mount `InterstitialAdManager`, replace/augment `BannerAd`.
- `src/pages/ProductDetail.tsx` + category pages — `InlineAdCard` injection.
- `src/pages/Wallet.tsx` — `LoyaltyCard`.
- `src/App.tsx` — route additions.

## 6. Targeting & ranking (technical)

```text
serve(placement, ctx):
  candidates = active campaigns where
    placement match
    AND (targeting.categories empty OR ctx.category in targeting.categories)
    AND (targeting.countries empty OR ctx.country in targeting.countries)
    AND (targeting.interests empty OR overlap(ctx.interests, targeting.interests))
    AND today_spend < daily_budget
    AND NOT seen by user in last 10 min
  rank:
    cpc:   ORDER BY max_bid_cpc DESC, random()
    flat:  ORDER BY (daily_budget - spent_today) DESC, random()
  return top 1 (or top N for inline)
```

## 7. Out of scope (v1)

- External ad networks (AdMob/Meta Audience).
- Real video generation — rewarded uses existing `AdReel` Ken-Burns reel.
- Stripe billing for ads — wallet only (matches existing PUBSTORE Pay).
- A/B creative testing & detailed audience analytics — basic stats only.
