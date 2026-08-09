# Store (Supplier) Plans — concept & mobile port spec

**Rule for mobile: read-only.** Native apps (React Native / Flutter) must show tiers, limits, commission and
feature locks, but **must never sell or change a subscription**. All purchases/upgrades happen on the web
(`/store/plans`). This avoids Apple/Google in-app-purchase rules for digital goods.

---

## 1. Concept

Every supplier store sits on exactly one plan. The plan controls three things:

1. **Commission** — % the platform keeps from each order at settlement.
2. **Listing cap** — how many products the store may have.
3. **Feature flags** — which store tools are unlocked.

If a supplier has no subscription row, or the subscription's `renews_at` has passed (lapsed), they are
treated as **Free**. Downgrade is implicit — nothing is deleted, features just stop working and existing
listings above the new cap simply can't be added to.

## 2. Tiers (live values from `supplier_plans`)

| code | name | price | commission | product limit | features |
|---|---|---|---|---|---|
| `free` | Free | $0/mo | **12%** | 20 | `basic_analytics` |
| `pro` | Pro | $19/mo | **7%** | 500 | + `full_analytics`, `bulk_import`, `live_selling`, `ads`, `coupons`, `priority_placement` |
| `elite` | Elite | $49/mo | **4%** | unlimited (`null`) | + `featured_badge`, `priority_support`, `top_placement` |

Feature keys and their user-facing labels (keep identical strings on mobile):

```
basic_analytics     Basic analytics
full_analytics      Full analytics
bulk_import         Bulk & auto import
live_selling        Live selling
ads                 PUBSTORE Ads
coupons             Coupons & promos
priority_placement  Priority search placement
featured_badge      Featured store badge
priority_support    Priority support
top_placement       Top search placement
```

## 3. Tables & columns

### `supplier_plans` (public catalogue, readable by everyone)
| column | type | meaning |
|---|---|---|
| `code` | text PK | `free` / `pro` / `elite` |
| `name` | text | display name |
| `price_usd` | numeric | monthly price, charged from wallet (web only) |
| `commission_rate` | numeric | 0.12 / 0.07 / 0.04 |
| `product_limit` | int null | `null` = unlimited |
| `perks` | jsonb (string[]) | marketing bullets shown on plan cards |
| `features` | jsonb (string[]) | feature flags above |
| `sort` | int | display order |
| `is_active` | bool | hide retired plans |

### `supplier_subscriptions` (one row per store)
| column | meaning |
|---|---|
| `supplier_id` | FK → `suppliers.id` (unique) |
| `plan_code` | FK → `supplier_plans.code` |
| `started_at` | when the current plan began |
| `renews_at` | next charge date; `<= now()` ⇒ **lapsed ⇒ treated as Free** |

### `supplier_commissions` (audit of every settled sale)
`id`, `supplier_id`, `order_id`, `plan_code`, `gross`, `rate`, `commission`, `net`, `created_at`.
Written by the escrow settlement function — never by a client.

### `products`
Counted per `supplier_id` to enforce the listing cap.

## 4. Server-side enforcement (identical for web and mobile — cannot be bypassed)

- `_enforce_supplier_product_limit()` — BEFORE INSERT on `products`; rejects insert when the store already
  has `product_limit` products.
- `_enforce_supplier_ads_feature()` — BEFORE INSERT on `ad_campaigns`; requires the `ads` feature.
- `_enforce_supplier_coupons_feature()` — BEFORE INSERT on `coupons`; requires `coupons`.
- `_enforce_supplier_live_feature()` — BEFORE INSERT on `live_streams`; requires `live_selling`.
- `_settle_order_escrow(order_id)` — on delivery confirmation, looks up the supplier's effective plan,
  computes `commission = gross * rate`, credits `net` to the supplier's sales wallet and inserts the
  `supplier_commissions` row.

Because all of this is enforced in the database, mobile only needs to *predict* the outcome for good UX;
it can never grant access it shouldn't have.

## 5. Web-only mutation

- RPC `supplier_subscribe_plan(_plan_code text)` — debits `price_usd` from the supplier's **personal**
  wallet balance, upserts `supplier_subscriptions` with `renews_at = now() + 30 days`.
- Do **not** call this from the native apps. It is invoked only from the web page `/store/plans`.
- (There is a `validate-iap-receipt` edge function stub for a future native IAP path — leave unused.)

## 6. Mobile implementation spec

### Data to fetch (read-only)
1. `supplier_plans` where `is_active = true`, ordered by `sort`.
2. `supplier_subscriptions` for my `supplier_id` (`maybeSingle`).
3. `count(products)` where `supplier_id = mine`.
4. Optional: last 50 `supplier_commissions` for the earnings/fee history screen.

### Derived state (mirror of the web `useSupplierPlan` hook)
```
lapsed        = subscription?.renews_at != null && renews_at <= now
activeCode    = (subscription && !lapsed) ? subscription.plan_code : 'free'
plan          = plans.find(p => p.code === activeCode) ?? plans.find(p => p.code === 'free')
features      = plan.features
can(f)        = features.includes(f)
productLimit  = plan.product_limit            // null ⇒ unlimited
atProductLimit= productLimit != null && productCount >= productLimit
upgradeFor(f) = first plan (by sort) whose features include f
```

### Screens
- **Store plans (read-only)**: current plan card (name, commission %, `productCount / limit`,
  renew or "Expired" date), then the three plan cards with perks and commission. Every plan card CTA is
  informational only.
- **Commission history**: gross / fee (rate) / net rows plus totals, from `supplier_commissions`.
- **Feature gates**: a `PlanGate(feature)` equivalent. When `can(feature)` is false, render a lock card:
  `"<Feature label> is a <required plan name> feature — you're on the <current plan> plan."`
- **Listing cap**: disable "Add product" and show `"You've reached your <n> product limit on <plan>."`
  when `atProductLimit`.

### Upgrade CTA wording on mobile (no purchase surface)
Never show a price button, "Subscribe", "Buy", or a link to a payment sheet. Use neutral copy:

> "Plan changes are managed on the PUBSTORE website."

Optionally a "Copy link" / share action for `https://pubstore.app/store/plans`. Do not deep-link into an
in-app browser checkout, and do not mention wallet charging on mobile.

### Refresh
After any product add/delete, invalidate the product-count query. Re-read the subscription on app
foreground so a plan bought on the web reflects in the app without a reinstall.

## 7. Edge cases
- No supplier store yet → show "Create your store first" empty state; no plan data.
- Lapsed subscription → show plan as Elite/Pro **Expired** but apply Free limits everywhere.
- `product_limit = null` → render "unlimited", never a progress bar.
- Products already above a reduced cap stay live; only new inserts fail.
- Commission is computed at settlement time from the plan then in force, so historical rows may show a
  different `rate` than the current plan — display `plan_code`/`rate` from the row, not the live plan.
