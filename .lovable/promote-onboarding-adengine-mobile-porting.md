# PUBSTORE — Promote & Earn, Supplier Onboarding, Promoter Ad Engine

Reference for porting these three systems to mobile (React Native `react-native/`, Flutter `flutter/`).
Everything below is what the web app actually does today. All server logic lives in Postgres
(security-definer RPCs + triggers), so mobile only has to call the same RPCs and read the same tables —
no new backend code is required.

---

## 1. Promotion system (Promote & Earn)

### 1.1 Concept

Any signed-in user can become a **promoter**. Sellers open a product for promotion and set a commission.
The promoter gets a short link, shares it, and when a buyer purchases through that link the promoter earns
a commission that matures into their PUBSTORE wallet.

### 1.2 Data model (schema `public`)

| Table | Purpose | Key columns |
|---|---|---|
| `promoter_profiles` | one row per promoter | `user_id` (PK), `code` (`PUB-XXXXXX`), `level`, `risk_score`, `risk_band`, `frozen`, `frozen_reason`, `accepted_terms_at`, `public_leaderboard`, `currency` |
| `promotions` | promoter ↔ product ↔ campaign pairing | `promoter_id`, `product_id`, `campaign` |
| `promotion_links` | shareable short links | `code` (6 chars), `channel`, `campaign`, `clicks`, `promotion_id`, `product_id` |
| `promotion_clicks` | raw click log | `link_id`, `visitor_id`, `user_id`, `source`, `landing_page`, `user_agent`, `ip_hash`, `is_bot` |
| `promotion_attributions` | who gets credit, expiring | `visitor_id` **or** `user_id`, `promoter_id`, `link_id`, `product_id`, `expires_at` |
| `commissions` | the ledger | `order_id`, `order_item_id`, `product_id`, `supplier_id`, `promoter_id`, `commission_type/rate/base/amount`, `release_days`, `status`, `created_at/confirmed_at/available_at/paid_at/cancelled_at` |
| `commission_adjustments` | reversals & manual corrections | `commission_id`, `amount` (negative for reversal), `kind`, `reason` |
| `promoter_payouts` | withdrawals to wallet | `amount`, `method` (`wallet`), `status`, `reference` (`promoter_payout:<id>`) |
| `promoter_fraud_events` | risk signals | `kind` (e.g. `self_purchase`), `severity`, `detail`, `order_id`, `resolved` |
| `promoter_earnings_summary` | **view** used by the UI | `total_earned`, `pending_amount`, `confirming_amount`, `available_amount`, `paid_amount`, `reversed_amount`, `sales_count`, `sales_revenue` |

Product-side columns on `products`: `promote_enabled` (bool, default false), `commission_type`
(`percent` | `fixed`, default `percent`), `commission_value` (numeric, default 0),
`commission_release_days` (int, default 7), `min_promoter_level` (int, default 1).

**RLS summary** (all policies target `authenticated`):
- `promoter_profiles`: own row select/insert/update, or admin.
- `promotions`, `promotion_links`: `ALL` where `promoter_id = auth.uid()` (or admin).
- `promotion_clicks`, `promotion_attributions`: select own (promoter, or the attributed user), or admin.
- `commissions`: select where promoter is you **or** you own the supplier (`suppliers.owner_id = auth.uid()`) **or** admin. No client writes — only the definer functions write.
- `commission_adjustments`, `promoter_payouts`: select own or admin. `promoter_fraud_events`, `commission_audit_log`: admin only.

So a mobile client can never mutate the ledger directly; it always goes through the RPCs below.

### 1.3 Server functions (call with `rpc`)

| RPC | Args | Returns | Notes |
|---|---|---|---|
| `promoter_ensure_profile()` | — | `promoter_profiles` row | Idempotent; creates the profile with a unique `PUB-` code on first call. Raises `sign in required` when anonymous. |
| `promote_get_link(_product_id, _channel default 'link', _campaign default null)` | uuid, text, text | `promotion_links` row | Ensures profile, rejects frozen accounts, rejects products where `promote_enabled = false` or `promoter_profiles.level < products.min_promoter_level`, reuses an existing promotion/link, otherwise generates a unique 6-char code (retries up to 6 times on collision). |
| `track_promotion_click(_code, _visitor_id, _source, _landing_page, _user_agent)` | text… | jsonb `{found, product_id, code}` | Always logs the click. Bots (UA matching `bot|crawler|spider|preview|facebookexternalhit|whatsapp`) are logged but do **not** increment `clicks` and do **not** create attribution. Otherwise upserts attribution with `expires_at = now() + 7 days`, keyed on `user_id` when signed in, else on `visitor_id`. Self-clicks (`uid = promoter_id`) and frozen promoters are skipped. |
| `promote_claim_attribution(_visitor_id)` | text | void | Moves an anonymous visitor attribution onto the now signed-in user (keeps the later `expires_at`, deletes the anonymous row). Skips self-attribution. |
| `promoter_withdraw_earnings(_amount)` | numeric | `promoter_payouts` row | Requires `level >= 2`, not frozen, `amount >= 10`, and `amount <= sum(available)`. Marks commissions `paid` oldest-first (splitting a commission row if the amount lands mid-row), then credits the wallet via `apply_wallet_transaction(uid, 'commission', amount, 'Promoter earnings payout', 'promoter_payout:<id>', 'personal')` — idempotent by reference. Sends a notification. |
| `product_commission_per_unit(_unit_price, _type, _value)` | — | numeric | `fixed` → value, `percent` → `price * value / 100`, clamped to `[0, unit_price]`. Mirrored client-side by `commissionPerUnit` in `src/data/products.ts`. |
| `promote_mature_commissions()` | — | int | Cron job `promote-mature-commissions`, `17 * * * *` (hourly): flips `confirmed → available` once `available_at <= now()` and notifies. |
| `admin_promote_overview()`, `admin_set_commission_status(_commission_id,_status,_reason)`, `admin_set_promoter_hold(_promoter_id,_frozen,_reason)` | — | — | Admin console only. |

### 1.4 Commission lifecycle (fully automatic, trigger-driven)

Trigger `_promo_commissions_on_order_event()` on `orders`:

```text
order paid (escrow_status -> held/released)   -> _create_promo_commissions(order_id)  -> status 'pending'
escrow_status -> released (delivered)         -> status 'confirmed', available_at = now() + release_days
hourly cron promote_mature_commissions()      -> status 'available'
promoter_withdraw_earnings()                  -> status 'paid'  + wallet credit
escrow refunded/cancelled, or order cancelled -> 'cancelled' (unpaid) / 'reversed' (+ negative adjustment if already paid)
```

`_create_promo_commissions(order_id)` details:
1. Finds the newest non-expired attribution for `orders.buyer_id` (`expires_at > orders.created_at`). No attribution → no commission.
2. If the attributed promoter *is* the buyer → writes a `self_purchase` fraud event and returns (no earnings).
3. Skips frozen promoters.
4. Loops `order_items`: skips items whose product isn't `promote_enabled`, and skips items that don't match a product-scoped attribution.
5. `commission_base = unit_price * qty`, `commission_amount = per_unit * qty`, both rounded to 2dp. Commission is on the product price only — never on delivery.
6. Inserts with `ON CONFLICT (order_item_id, promoter_id) WHERE order_item_id IS NOT NULL DO NOTHING` → idempotent per order item.
7. Notifies each promoter (`notifications.type = 'promoter_sale'`, link `/promote/earnings`).

Notification types emitted: `promoter_sale`, `promoter_commission` (confirmed / available / paid out).

### 1.5 Web screens and how they fetch (port these)

Routes: `/promote`, `/promote/product/:id`, `/promote/links`, `/promote/earnings`, `/x/:code`.
Hooks: `src/hooks/usePromote.ts`. Helpers: `src/lib/promote.ts`.

**Products feed — `PromoteProducts.tsx` + `usePromotableProducts(sort, search, category)`**
```sql
select *, suppliers(name, verified, gold, country, city, location_address, latitude, longitude, trade_type, email)
from products
where promote_enabled = true and active = true and commission_value > 0
[and title ilike '%q%'] [and category_slug = c]
limit 60
```
Sort pills → order by: `new`/searching → `created_at desc`, `trending` → `sold desc`,
`converting` → `review_count desc`, `deals` → `original_price desc nulls last`,
`earning` → `commission_value desc` then re-sorted client-side by actual per-unit commission.
While a search string is present the sort pills are ignored and newest-first is used (matches the admin ads studio).
Search input is debounced 300 ms. Cards show image, title, price, and `Earn $X per sale`.
The RN screen `react-native/src/screens/PromoteScreen.tsx` already implements a simpler version of this
(no sort pills, no commission-value ordering) — bring it in line.

**Promote screen — `PromoteProduct.tsx`**
1. Product fetch by id with the same supplier join.
2. `usePromotionLink(id, 'link')` → `promote_get_link`; `retry: false` so "not promotable"/"on hold" errors surface once.
3. Share URL = `${origin}/x/${code}` (`shareUrlForCode`). Mobile should use the production origin `https://pubstore.app`.
4. Share text is built **only from verified product data** by `shareMessage({title, price, originalPrice, url})` so prices can't be faked.
5. Channels (`channelShareUrl`): WhatsApp `https://wa.me/?text=`, Facebook `sharer.php?u=`, X `twitter.com/intent/tweet?text=`, Telegram `t.me/share/url`. On mobile use the native share sheet plus a WhatsApp-first button.
6. Copy link/message, Download image (see §3), and the full ad studio.

**My promotions — `PromoteLinks.tsx` + `useMyPromotions()`**
Fetches `promotion_links` for the user (200 max) and all `commissions (link_id, commission_amount, status)`,
then aggregates per link: orders + earned, excluding `cancelled`/`reversed`. Products are hydrated in a second
`products.in('id', ids)` query. Shows clicks / orders / earned per link.

**Earnings — `PromoteEarnings.tsx` + `usePromoterEarnings()`**
Three parallel queries: `promoter_earnings_summary` (`maybeSingle`, zeros when absent),
`commissions` (own, newest first, 120) with products hydrated, `promoter_payouts` (50).
Withdraw calls `promoter_withdraw_earnings(amount)` then invalidates
`promoter-earnings`, `promoter-commissions`, `promoter-payouts`, `my-promotions`, `wallet`.

**Click redirect — `/x/:code` → `PromoteRedirect.tsx`**
Calls `trackPromotionClick(code, ?s=source)` then `replace`-navigates to `/product/:product_id`
(or `/home` if the code is unknown). On mobile this must be a **deep link / universal link** handler
for `pubstore.app/x/:code` that runs the same RPC before navigating to the product screen.

**Attribution plumbing — `src/lib/promote.ts`**
- `getVisitorId()`: stable uuid in `localStorage` key `pubstore.visitor.id` → on mobile use `AsyncStorage` / `SharedPreferences` (Flutter: `shared_preferences`) with the same key semantics; it must survive reinstall-free sessions.
- `markPendingClaim()`: sets `pubstore.promote.pendingClaim`.
- `claimPromoterAttribution()`: on every app start / auth state change, if the pending flag is set and a session exists, call `promote_claim_attribution(visitor_id)` and clear the flag. Web does this in `AppShell.tsx`; mobile should do it in the root navigator / auth listener. Best-effort, never blocks UI.

**Seller side**
- Product add/edit forms (`src/pages/StoreSection.tsx`) expose: `promote_enabled` checkbox, `commission_type` select, `commission_value`, `commission_release_days`, plus a live "Promoters earn X per unit — about $Y each" preview.
- `Promoted sales` view (`PromotedSalesView.tsx` + `usePromotedSales(supplierId)`): `commissions` where `supplier_id = <own supplier>`, newest first (200), hydrating `profiles(user_id, display_name, username, avatar_url)` and products. Amounts come from `commission_amount` (not `amount`).

### 1.6 Mobile porting checklist (promotion)

- [ ] Deep-link handler for `/x/:code` → `track_promotion_click` → product screen.
- [ ] Persistent `visitor_id` + pending-claim flag; call `promote_claim_attribution` after sign-in.
- [ ] `promoter_ensure_profile` on entering the Promote section; show the frozen banner from `frozen`/`frozen_reason`.
- [ ] Products feed with the 5 sort pills, debounced search, `Earn $X per sale` badge.
- [ ] Promote screen: link via `promote_get_link`, native share sheet, WhatsApp first, copy, image/video download or share.
- [ ] My promotions + Earnings screens (summary view, commission rows with status chips, payouts).
- [ ] Withdraw sheet: min $10, requires `level >= 2`, surfaces the RPC error text verbatim.
- [ ] Seller: promote toggle + commission fields in the product form; Promoted sales list.
- [ ] Push/in-app notifications for `promoter_sale` and `promoter_commission` deep-linking to `/promote/earnings`.

---

## 2. Supplier onboarding

### 2.1 Steps and gating

`src/components/SupplierOnboarding.tsx` → `buildOnboardingSteps(supplier, verification)` returns four steps;
`isOnboardingComplete(steps)` gates publishing products. `OnboardingBlockedBanner` shows the next unfinished step.

| id | Label | Done when | Target |
|---|---|---|---|
| `details` | Business details | `name` && `country` && `about` && `business_type` && (`phone` \|\| `email`) | `/store/profile` |
| `categories` | Category preferences | `categories.length > 0` | `/store/profile?step=categories` |
| `collection` | Collection point & delivery | `collection_point_images.length > 0` && `delivery_note` non-blank | `/store/profile?step=collection` |
| `verification` | Identity verification | `useVerification()` status `approved` | `/verification` |

The progress card shows `done of 4` with a percentage bar and hides itself entirely once all steps pass.

### 2.2 `suppliers` fields written by the profile form

`src/pages/StoreSection.tsx` → `ProfileView` updates:
`name`, `country`, `city`, `about`, `logo`, `banner`, `latitude`, `longitude`, `location_address`,
`business_type`, `phone`, `email`, `website`, `trade_type` (`retail|wholesale|both`), `categories[]`,
`verticals[]`, `manual_payment_enabled`, `manual_payment_number`, `manual_payment_name`,
`manual_payment_instructions`, and the collection block: `collection_point_images text[]`,
`collection_point_address text`, `delivery_note text`.

`mapSupplier` in `src/data/products.ts` exposes these to the UI as `collectionPointImages`,
`collectionPointAddress`, `deliveryNote`, `locationAddress`, etc.

### 2.3 Image uploads

Logo, banner and collection-point photos upload to the **`product-images`** storage bucket at
`${user.id}/store/${kind}-${Date.now()}.${ext}`, then the public URL is written to the supplier row.
Uploads require an active session — web uses `src/lib/uploadAuth.ts` to guarantee a fresh session before
uploading, otherwise storage RLS rejects the write. Mobile must do the same (refresh session, then upload
under a path prefixed by the user's own id).

Verification documents live in the separate verification flow (`/verification`, `useVerification`), which
is admin-approved and unrelated to the profile form.

### 2.4 Mobile porting checklist (onboarding)

- [ ] Port `buildOnboardingSteps` verbatim (pure function, no DOM) into shared logic.
- [ ] Profile screen sections: business details, categories/verticals pickers, location picker (lat/lng + address), manual payment block, collection point (multi-image picker + address + delivery note).
- [ ] Multi-image picker writing to `product-images/${uid}/store/...` with a refreshed session.
- [ ] Block "Add product" until all four steps pass, with the same blocked banner and "Continue" jump.

---

## 3. Ad creation engine — promoter side only

### 3.1 What promoters get

`src/components/promote/PromoterAdStudio.tsx` is rendered on `/promote/product/:id`. It is the same engine
as the admin ads studio, scoped to a single product: pick a template, edit the copy and prices, drag elements,
download a square post image or a vertical reel video, and share it with the promoter link.

Nothing is persisted for promoters — the studio is purely local (no `social_ads` row is written). Only admins
create stored ads. Promoters read templates through the RLS policy
*"Signed in users can view active ad templates"* on `ad_templates` (`SELECT … USING (active)`).

### 3.2 Template fetch

```sql
select id, name, format, style from ad_templates where active = true order by name
```
`format` is `square` (1080×1080) or `vertical` (1080×1920). `style` is jsonb `{ bg, accent, text, layout }`.
Active layouts today: `deal`, `clean`, `hook`, `sale`, `hero-five`, `staggered`, `marketplace`, `catalog`,
`product-card`, `product-card-multi` (18 template rows across the two formats). Selecting a template also sets the format,
which the user can still override.

### 3.3 The creative object

```ts
type AdCreative = {
  headline?, subhead?, badge?, cta?,
  price?, originalPrice?,
  imageUrl?, imageUrls?,      // hero + gallery, deduped, max 6
  brand?, format?: "square" | "vertical",
  style?: { bg, accent, text, layout },
  offsets?: Record<ElementKey, { dx, dy }>,
}
```
Defaults in the promoter studio: `headline = product.title`, `subhead = "Shop it on PUBSTORE"`,
`badge = "Deal"` when `originalPrice > price` else `"New"`, `cta = "Shop now"`,
`price`/`originalPrice` prefilled from the product but editable (empty falls back to product price),
`imageUrls = [product.image, ...product.gallery]` deduped.

Draggable elements (`AD_ELEMENTS`): `art`, `badge`, `headline`, `subhead`, `price`, `cta`, `searchbar`, `brand`.
`AdLayoutEditor` overlays a handle per element on the rendered preview and stores pixel nudges in `offsets`.
Anchor fractions for handle placement are in `ANCHORS` in `src/components/admin/AdLayoutEditor.tsx`.

Every template draws a `Pubstore.app` search bar (`SEARCH_BAR_TEXT`) at the top.

### 3.4 Rendering (`src/lib/adCreative.ts`)

Pure canvas, no dependencies. Font `'TikTok Sans', Arial, sans-serif`.
- `loadImage` (with `crossOrigin = "anonymous"`), `uniqueUrls`, `loadAdImages(ad, 6)`.
- `renderAdCreative(ad)` → `HTMLCanvasElement`; `adCreativeDataUrl(ad)` → PNG data URL for the live preview;
  `downloadAdCreative(ad, filename)` → triggers the file download.
- Helpers reused by layouts: `drawSearchBar`, `drawProductCard`, `drawShopCard`, `drawCover`,
  `drawClippedImage`, `roundRect`, `money`, `hexA`, `shade`.
- Text is wrapped and shrunk to fit, with a reserved bottom band for price + CTA so nothing overlaps.

The preview re-renders on every creative change via a `useEffect` guarded by an `alive` flag.

### 3.5 Video (`src/lib/adVideo.ts`)

- `canRecordAdVideo()` → requires `MediaRecorder` + `canvas.captureStream`.
- `renderAdVideo(ad, {seconds, fps=30})`: hero image with a gentle Ken Burns zoom on top, the other product
  images as a marquee sliding right→left underneath (speed 110 px/s, tiles repeated to at least 3),
  search bar on top, copy revealed over the first 0.6 s. Duration clamped to **2–120 s** (2-minute social cap);
  the studio offers 5, 8, 15, 30, 60, 120 s and defaults to 8.
- Mime preference: `video/webm;codecs=vp9` → vp8 → webm → mp4. Throws if the ad has no images.
- `downloadAdVideo(ad, filename, opts)` saves the blob.

### 3.6 Mobile porting notes (ad engine)

There is no HTML canvas or `MediaRecorder` on native, so the engine must be re-implemented per platform:

- **React Native**: render the creative as a normal RN view tree (the layouts are simple rects/text/images)
  and export with `react-native-view-shot` at 1080×1080 / 1080×1920, then share via `react-native-share`.
- **Flutter**: build each layout as a widget inside a `RepaintBoundary` and export with
  `toImage(pixelRatio: …)` → PNG bytes → `share_plus`.
- Keep `style.layout`, `AdCreative`, the element keys and the offsets contract identical so templates stay
  interchangeable between web and mobile; read the same `ad_templates` rows.
- Video: prefer a **server-rendered** clip. The `remotion/` project already renders the same hero + marquee
  concept (`remotion/src/ads/VerticalAd.tsx`), so a render endpoint is a cleaner path than an on-device
  encoder. Short term, mobile can ship image ads only and hide the video button.
- Marketplace CDN images need permissive CORS on web; on native they are plain HTTP fetches, so some images
  that fail on the web preview will work on mobile.

---

## 4. Cross-cutting rules to preserve

- Commission is on product price only, on completed orders, never on delivery fees.
- Self-purchase earns nothing and logs a fraud event.
- Attribution: last link clicked wins, 7-day window, follows the visitor into their account after sign-in.
- Money never moves client-side: only `promoter_withdraw_earnings` credits the wallet, through
  `apply_wallet_transaction` with an idempotent `promoter_payout:<id>` reference.
- Minimum withdrawal $10; promoter `level >= 2` (verified) required.
- Ad copy and prices shown on shared creatives originate from verified product data.
