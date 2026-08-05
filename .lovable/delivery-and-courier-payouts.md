# Delivery, Shipping & Courier Payouts

How checkout delivery options are built, how the fee is calculated, and how the courier gets paid.
Use this as the reference when porting to the mobile apps.

---

## 1. Concept

There is **no flat shipping fee**. At checkout, each supplier in the cart shows a real list of delivery options:

1. **Supplier self-delivery** — the supplier's own courier profile, when they offer delivery themselves.
2. **Partnered couriers** — active rows in `supplier_courier_partnerships` for that supplier (the default
   partnership is pre-selected).
3. **To be negotiated with supplier** — fallback when neither exists. Fee is `0` and the buyer arranges
   delivery directly with the supplier.

The chosen courier is stored on the order and is paid the delivery fee **only after the buyer confirms
delivery** (escrow settlement).

---

## 2. Data used

| Table | Role |
| --- | --- |
| `courier_profiles` | Rate card per courier user (base fee, per-km, per-kg, minimums, vehicle) |
| `supplier_courier_partnerships` | Which couriers a supplier works with; `is_default`, `active` |
| `orders.delivery_courier_user_id` | The courier chosen at checkout (null = negotiated with supplier) |
| `orders.shipping` | Quoted delivery fee for that supplier's order (0 when negotiated) |

Rate maths lives in `src/lib/courierRates.ts`:
- `courierToRate(profile)` — normalises a courier profile into a rate card.
- `quoteCourierRate(rate, { distanceKm, weightKg })` — returns the fee for the shipment.
- `summarizeRate(rate)` — the human-readable subtitle shown under each option.

---

## 3. Checkout flow (`src/pages/Cart.tsx`)

```text
cart grouped by supplier
   │
   ├── load supplier owners' courier_profiles      (self-delivery option)
   ├── load active supplier_courier_partnerships   (partner options)
   │        └── load those couriers' courier_profiles
   │
   ├── no options at all ──> single "To be negotiated with supplier" option, fee 0
   │
   └── selected option ──> quoteCourierRate() ──> shippingBySupplier[supplierId]
                                                   { fee, label, courierUserId, negotiated }
```

- `shipping` total = sum of per-supplier fees; `total = discountedSubtotal + shipping`.
- UI shows `TO BE NEGOTIATED`, `FREE`, or the formatted fee per supplier; the default partner carries a
  `BadgeCheck`.
- Bottom bar summary reads "Delivery negotiated with supplier" when any supplier is negotiated.
- One order per supplier is created, carrying `shipping` and `delivery_courier_user_id`.

---

## 4. Payout at settlement (`_settle_order_escrow`)

When the buyer confirms delivery and escrow is released, the held amount is split:

```text
escrow_amount
   ├── delivery fee ──> courier's SALES wallet   (only if delivery_courier_user_id is set)
   └── goods amount ──> supplier's SALES wallet, net of commission
```

- **Commission is charged on goods only** — never on the delivery fee.
- Commission rate comes from `supplier_effective_plan` (see `mem://features/supplier-plans`) and is logged
  in `supplier_commissions`.
- The courier receives a notification: delivery fee credited to their sales balance.
- Negotiated delivery (`delivery_courier_user_id = null`, `shipping = 0`) means no courier leg — the whole
  escrow settles against the supplier.
- Cancellations/refunds return the full escrow (goods + delivery) to the buyer; no courier payout happens.

---

## 5. Mobile port checklist

1. Never hardcode or default a shipping fee. Build options from `courier_profiles` +
   `supplier_courier_partnerships`, exactly as the web checkout does.
2. Pre-select the default active partnership; fall back to self-delivery, then to negotiated.
3. Reuse the same rate maths (base + per-km + per-kg with minimums) so quotes match the web.
4. Persist `shipping` and `delivery_courier_user_id` on each supplier's order at creation time.
5. Do not write payouts client-side — settlement and the courier credit happen inside
   `_settle_order_escrow` when the buyer confirms delivery.
6. Show the negotiated state explicitly ("To be negotiated with supplier") instead of `$0` alone.
