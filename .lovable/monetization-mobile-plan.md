# Monetization implementation reference (AI credits → supplier plans → tier gating)

Everything below is already live on the web app + backend. This document is the spec for porting it
to the mobile apps (`react-native/`, `flutter/`). No backend changes are needed for mobile — the same
tables and RPCs are used from the mobile Supabase clients.

---

## 1. AI credits

### 1.1 Business rules

- Every AI feature call is metered in **AI credits**.
- Credit price is set at roughly a **6x markup on the underlying Lovable AI cost**.
- Each account gets **10 free AI actions for life** (any feature, cost ignored). After that, credits
  are required.
- Credits are bought with the user's **personal wallet balance** (no card flow) — plans and packs
  both debit the wallet.
- Metering happens **server-side only** (edge functions), never in the client.

### 1.2 Tables

| Table | Purpose |
| --- | --- |
| `ai_plans` | Monthly plan catalog (`code`, `name`, `price_usd`, `monthly_credits`, `blurb`, `sort_order`, `is_active`) |
| `ai_credit_packs` | One-off top-up packs (`code`, `name`, `credits`, `price_usd`, `bonus_label`, `sort_order`, `is_active`) |
| `ai_feature_costs` | Per-feature price (`feature`, `label`, `credits`, `notes`, `is_active`) |
| `ai_credit_accounts` | One row per user (`user_id`, `balance`, `plan_code`, `plan_started_at`, `plan_renews_at`, `trial_used`, `lifetime_credits_purchased`, `lifetime_credits_spent`) |
| `ai_credit_ledger` | Append-only history (`delta`, `balance_after`, `kind`, `feature`, `description`, `reference`) |

RLS: users can read their own account + ledger; catalog tables are publicly readable; writes only
happen through the RPCs / service role.

### 1.3 Catalog (current values)

Plans:

| code | name | price | credits/mo |
| --- | --- | --- | --- |
| free | Starter | $0 | 0 (10 free actions) |
| plus | Plus | $9.99 | 600 |
| pro | Pro | $29.99 | 2,200 |
| business | Business | $79.99 | 6,500 |

Packs (never expire):

| code | credits | price | bonus |
| --- | --- | --- | --- |
| pack_250 | 250 | $5 | — |
| pack_600 | 600 | $10 | +20% |
| pack_1600 | 1,600 | $25 | +28% |
| pack_4000 | 4,000 | $55 | +45% |

Feature costs:

| feature | label | credits |
| --- | --- | --- |
| tapson_chat | Tapson AI reply | 1 |
| semantic_search | Smart search | 1 |
| image_search | Search by photo | 2 |
| learnlyte_chat | Study assistant reply | 2 |
| extract_questions | Extract exam questions | 15 |
| mark_answers | Mark answers | 15 |
| generate_ad | AI product ad | 20 |

### 1.4 RPCs

- `ai_credits_account(_user_id uuid) -> ai_credit_accounts` — get-or-create the account row.
- `ai_subscribe_plan(_plan_code text) -> jsonb` — auth.uid() based. No-op if the same plan is still
  active; otherwise debits the wallet (`purchase`, reference `ai_plan:<code>`), sets
  `plan_renews_at = now() + 1 month` (NULL for free), **adds** `monthly_credits` to the balance and
  writes a `plan_start` ledger row. Returns `{ok, plan, balance, renews_at}`.
- `ai_buy_credit_pack(_pack_code text) -> jsonb` — debits the wallet (reference `ai_pack:<code>`),
  adds credits, writes a `purchase` ledger row. Returns `{ok, credits, balance}`.
- `ai_consume_credits(_user_id, _feature, _reference, _quantity) -> jsonb` — **service role only**,
  called from edge functions:
  - if `trial_used < 10`: increments trial, writes a `free_trial` ledger row (delta 0), returns
    `{ok:true, charged:0, source:'trial', trial_remaining}`.
  - else if `balance < cost`: returns `{ok:false, error:'insufficient_ai_credits', required, balance}`.
  - else debits `credits * quantity`, writes a `spend` ledger row, returns `{ok:true, charged, balance}`.

### 1.5 Edge-function enforcement

`supabase/functions/_shared/ai-credits.ts`:

- `getCaller(req)` — resolves the user from the `Authorization` header using the anon client.
- `chargeAiCredits(req, feature, {reference, quantity})` — returns either
  `{ok:true, charged, balance, source, trialRemaining}` or a ready-to-send error:
  - `401 auth_required` when unauthenticated
  - `402 insufficient_ai_credits` with `required` / `balance` / `feature`
  - `500 credit_check_failed`
- `refundAiCredits(userId, feature, credits, reference)` — called when the downstream AI request
  fails, writes a `refund` ledger row.

Every AI edge function calls `chargeAiCredits` **before** hitting the model and refunds on failure.
Mobile clients therefore do not need to check credits themselves — they only need to render the
402 error nicely and deep-link to the AI credits screen.

### 1.6 Web UI to mirror

- Hook `src/hooks/useAiCredits.ts` — exposes `balance`, `account`, `planCode`, `trialRemaining`
  (`10 - trial_used`), `plans`, `packs`, `costs`, `ledger`, `buyPack`, `subscribe`, `refresh`.
  Auth is tracked via `getSession()` + `onAuthStateChange`; `refresh()` invalidates the AI account,
  AI ledger and wallet queries.
- Page `src/pages/AiCredits.tsx` (`/ai-credits`) sections, in order:
  1. Balance card: big credit number, plan badge, "N of 10 free actions left", renewal date, wallet
     balance line ("plans and packs are charged to your wallet").
  2. Monthly plans grid (active plan highlighted, button disabled on active plan).
  3. Top-up packs grid with bonus badges.
  4. "What each AI feature costs" list from `ai_feature_costs`.
  5. AI credit history from the ledger (green for `+`, "free" when delta is 0, balance after).
- Client-side pre-check before calling the RPCs: if `personalBalance < price`, toast
  "Not enough wallet balance — top up your wallet first" instead of hitting the RPC.

### 1.7 Mobile port checklist (AI credits)

- [ ] `AiCreditsScreen` (RN) / `ai_credits_screen.dart` (Flutter) with the 5 sections above.
- [ ] Reuse the same queries: `ai_plans`, `ai_credit_packs`, `ai_feature_costs` (filter `is_active`,
      order by `sort_order`/`credits`), `ai_credit_accounts` by `user_id`, ledger limit 50 desc.
- [ ] Call `ai_subscribe_plan` / `ai_buy_credit_pack` via `rpc`, then refetch account + wallet.
- [ ] Global handler for edge-function `402 insufficient_ai_credits` → modal "Out of AI credits" with
      a button to the AI credits screen.
- [ ] Show remaining free actions on AI entry points (Tapson, smart search, study assistant).

---

## 2. Supplier plans & commission

### 2.1 Business rules

- Three store tiers. Higher tier = lower commission + higher listing cap + more features.
- Plan fee is charged **once per month from the personal wallet** at subscribe time
  (`renews_at = now() + 1 month`); a lapsed subscription silently falls back to `free`.
- Commission is taken **at settlement**, not at checkout: the buyer is debited the full order total,
  the seller is credited `total - commission` into their **sales** wallet account.

### 2.2 Catalog (current values)

| code | name | price/mo | commission | product limit | features |
| --- | --- | --- | --- | --- | --- |
| free | Free | $0 | 12% | 20 | basic_analytics |
| pro | Pro | $19 | 7% | 500 | + full_analytics, bulk_import, live_selling, ads, coupons, priority_placement |
| elite | Elite | $49 | 4% | unlimited | + featured_badge, priority_support, top_placement |

### 2.3 Tables

| Table | Purpose |
| --- | --- |
| `supplier_plans` | `code`, `name`, `price_usd`, `commission_rate`, `product_limit` (NULL = unlimited), `perks` jsonb[], `features` jsonb[], `sort`, `is_active` |
| `supplier_subscriptions` | one row per supplier: `supplier_id` (PK), `plan_code`, `started_at`, `renews_at` |
| `supplier_commissions` | one row per paid order: `order_id` (unique), `supplier_id`, `seller_id`, `plan_code`, `gross`, `rate`, `commission`, `net` |

### 2.4 Server logic

- `supplier_effective_plan(_supplier_id)` — returns the subscription's plan when `renews_at` is NULL
  or in the future, else the `free` plan. Single source of truth for rate/limit/features.
- `supplier_subscribe_plan(_plan_code)` — resolves the caller's store by `owner_id`, errors with
  `you do not have a store`, debits the wallet (`supplier_plan:<code>`), upserts the subscription,
  and inserts a `supplier_plan` notification linking to `/store/plans`.
- `supplier_has_feature(_supplier_id, _feature)` — boolean containment check against the effective
  plan's `features` array.
- `pay_order_with_wallet(_order_id)` (settlement, called by the `pay-order` edge function with the
  buyer's JWT):
  1. locks the order, verifies `buyer_id = auth.uid()`, idempotent when already paid;
  2. `pl := supplier_effective_plan(order.supplier_id)`;
  3. `commission = round(total * pl.commission_rate, 2)`, `net = total - commission`;
  4. debits buyer personal wallet (`purchase`), credits seller `sales` wallet with `net`
     (description mentions the commission %);
  5. inserts the `supplier_commissions` row (`ON CONFLICT (order_id) DO NOTHING`);
  6. sets `app.settlement` / `app.allow_escrow_write` so `_orders_block_escrow_tamper` allows the
     write, marks the order `paid`, then notifies the seller (`payment_received` → `/wallet`).

### 2.5 Server-side tier enforcement (triggers)

| Trigger fn | Table | Rule |
| --- | --- | --- |
| `_enforce_supplier_product_limit` | `products` | blocks insert when count ≥ plan `product_limit` |
| `_enforce_supplier_live_feature` | `live_streams` | requires `live_selling` |
| `_enforce_supplier_ads_feature` | `ad_campaigns` | requires `ads` |
| `_enforce_supplier_coupons_feature` | `coupons` | requires `coupons` |

All are `SECURITY DEFINER` with `search_path = public` and raise a human-readable message, e.g.
"Your Free plan allows up to 20 products. Upgrade your plan to list more." Mobile must surface these
Postgres error messages verbatim.

### 2.6 Web UI to mirror

- Hook `src/hooks/useSupplierPlan.ts`: loads my supplier, plans, subscription, commissions and
  product count. Derives `lapsed`, `activeCode` (falls back to `free`), `plan`, `features`,
  `can(feature)`, `productLimit`, `atProductLimit`, `upgradeFor(feature)` (cheapest plan that
  includes the feature), plus `subscribe` mutation. `FEATURE_LABEL` maps feature keys to copy.
- Page `src/pages/SupplierPlans.tsx` (`/store/plans`): plan cards with price, commission, listing
  cap, perks, current-plan state; listing usage (`productCount / productLimit`); commission history
  (gross, rate, commission, net per order).
- `src/components/store/PlanGate.tsx`: wraps gated UI; when `can(feature)` is false it renders an
  `UpgradeNotice` (feature label + cheapest unlocking plan + link to `/store/plans`) instead of the
  children.
- Gated surfaces today:
  - Bulk / AliExpress / Stays import tabs — `bulk_import` (`StoreSection.tsx`)
  - Coupon creation — `coupons` (`StoreSection.tsx`)
  - Ads dashboard + campaign wizard — `ads`
  - "Go live" tile in `MyStore.tsx` — `live_selling` (locked visual + redirect)
  - 30/90-day ranges and status/top-product charts in `StoreAnalytics.tsx` — `full_analytics`

### 2.7 Mobile port checklist (supplier plans)

- [ ] `SupplierPlansScreen` / `supplier_plans_screen.dart` at route `store/plans` with plan cards,
      listing usage and commission history.
- [ ] Port `useSupplierPlan` as a shared service/provider (`supplierPlanProvider` in Flutter,
      `useSupplierPlan` hook in RN) exposing `can()`, `atProductLimit`, `upgradeFor()`.
- [ ] Port `PlanGate` / `UpgradeNotice` as a mobile widget (`PlanGate`, `UpgradeNotice`).
- [ ] Apply gates on the mobile equivalents: store imports, coupons, ads dashboard/wizard, go-live
      button, analytics ranges/charts.
- [ ] Block the "add product" CTA when `atProductLimit`, and show the trigger error text on failure.
- [ ] Show the effective commission rate on the store dashboard and on each sale row.

---

## 3. Shared integration notes for mobile

1. **Wallet is the payment rail.** Both AI and supplier purchases call
   `apply_wallet_transaction(..., 'personal')`. Mobile must refresh wallet + AI account + subscription
   after any purchase, and pre-check the balance to avoid an RPC error round-trip.
2. **Two wallet accounts** exist: `personal` (spending) and `sales` (seller earnings, credited net of
   commission). Keep them visually separate on the mobile wallet screen.
3. **Never trust the client.** Feature availability and credit balance are advisory in the UI; the
   DB triggers and edge functions are the real gate. Always render the server error message.
4. **Error codes to handle in mobile networking layer:**
   - `401 auth_required` → sign-in sheet
   - `402 insufficient_ai_credits` → AI credits screen
   - Postgres exceptions containing `requires the Pro or Elite supplier plan` / `allows up to` →
     upgrade sheet for `/store/plans`
5. **Catalog is data-driven.** Do not hardcode prices, credit costs, commission rates or limits in
   mobile code — read them from `ai_plans`, `ai_credit_packs`, `ai_feature_costs` and
   `supplier_plans` so pricing changes ship without an app release.
