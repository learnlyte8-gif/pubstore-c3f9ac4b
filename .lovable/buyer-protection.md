# Buyer Protection & Escrow (Trade Assurance)

How payments are protected between buyers and sellers, what each party can do, and how both sides get notified.
Use this as the reference when porting the flow to the mobile apps.

---

## 1. Concept

Money is never paid straight to the seller. When a buyer pays, the amount is **held in escrow** on the order.
Funds are released only after **both parties confirm delivery**:

1. Seller marks the order delivered.
2. Buyer confirms delivery.
3. Escrow is settled: commission is deducted per the supplier plan, the net lands in the seller's **sales** wallet.

If something goes wrong, the buyer can cancel (early stages only) or request a refund, which support resolves.

---

## 2. Order fields (`public.orders`)

| Field | Meaning |
| --- | --- |
| `payment_status` | `unpaid` / `paid` / `refunded` |
| `escrow_status` | `none` / `held` / `disputed` / `released` / `refunded` |
| `escrow_amount` | amount held (falls back to `total`) |
| `escrow_released_at` | when funds were paid out |
| `supplier_marked_delivered_at` | seller confirmation timestamp |
| `buyer_confirmed_delivered_at` | buyer confirmation timestamp |
| `refund_status` | `none` / `requested` / `declined` / `refunded` |
| `refund_reason`, `refund_requested_at`, `refund_resolved_at`, `refund_admin_note` | refund trail |
| `dispute_opened_at`, `dispute_reason` | open dispute marker |

Escrow/payment/refund columns cannot be written from the client: the trigger
`_orders_block_escrow_tamper` rejects direct updates unless the server-side session flags
`app.settlement` / `app.allow_escrow_write` are set, which only the RPCs below do.

---

## 3. State machine

```text
paid ──> escrow_status = held
           │
           ├── seller marks delivered ──> status = shipped, supplier_marked_delivered_at
           │        │
           │        └── buyer confirms ──> status = delivered ──> escrow released (net of commission)
           │
           ├── buyer requests refund ──> refund_status = requested, escrow_status = disputed
           │        ├── admin approves ──> wallet refund, escrow refunded, status = cancelled
           │        └── admin declines ──> refund_status = declined, escrow back to held
           │
           └── cancelled (buyer / seller / admin) ──> auto-settle: escrow returned to buyer wallet
```

---

## 4. Server-side RPCs (all `SECURITY DEFINER`, authenticated only)

| Function | Caller | Rules |
| --- | --- | --- |
| `pay_order_with_wallet(_order_id)` | buyer | debits buyer wallet, sets `payment_status = paid`, `escrow_status = held` (no seller payout) |
| `supplier_mark_order_delivered(_order_id)` | seller (supplier owner) | blocked if cancelled, refunded, or a refund is open; bumps `placed/processing` to `shipped` |
| `buyer_confirm_order_delivered(_order_id)` | buyer | requires `supplier_marked_delivered_at`; blocked if cancelled, refunded, or refund open; sets `delivered` and calls `_settle_order_escrow` when funds are held |
| `request_order_refund(_order_id, _reason)` | buyer | requires paid + not delivered + not cancelled + no open/settled refund; reason ≥ 5 chars; marks escrow `disputed` |
| `resolve_order_refund(_order_id, _approve, _note)` | **admin only** (`has_role(auth.uid(),'admin')`) | approve → refund to buyer wallet + order cancelled; decline → escrow back to `held` |
| `cancel_order_by_buyer(_order_id)` | buyer | only while `awaiting_payment` / `placed`; just sets `cancelled` and lets the auto-settle trigger refund |
| `_settle_order_escrow(_order_id)` | internal | commission per `supplier_effective_plan`, net → seller `sales` wallet, logs `supplier_commissions`, `escrow_status = released` |

### Auto-settlement on cancellation

Trigger `trg_auto_settle_cancelled_order` → `_auto_settle_cancelled_order()` fires on any status change to
`cancelled`, from any source (buyer RPC, seller status update, admin action):

- If escrow is `held` / `disputed`, the amount is returned to the buyer's **personal** wallet and the order is
  marked `escrow_status = refunded`, `payment_status = refunded`, `refund_status = refunded`.
- Any open refund request is closed out.
- Recursion is guarded with `app.cancel_settlement`.

---

## 5. Notifications (both parties, always)

Every state change writes to `public.notifications` (which also fans out to push via the Expo trigger).

| Event | Buyer | Seller | Admin |
| --- | --- | --- | --- |
| Seller marks delivered | "Seller marked your order delivered — confirm to release payment" (`/orders`) | — | — |
| Buyer confirms delivery | "Delivery confirmed" (`/orders`) | "Buyer confirmed delivery" (`/store/orders`) | — |
| Escrow released | — | "Funds released — $net added to your sales balance" (`/wallet`) | — |
| Refund requested | "Refund request submitted" (`/orders`) | "Refund requested: <reason>" (`/store/orders`) | "Refund needs review" (`/admin`) to every admin |
| Refund approved | "Refund approved — returned to your wallet" (`/wallet`) | "Refund approved — order cancelled" (`/store/orders`) | — |
| Refund declined | "Refund declined" (`/orders`) | "Refund declined — payment stays protected" (`/store/orders`) | — |
| Order cancelled | "Order cancelled — refunded" (`/wallet`) | "Order cancelled" (`/store/orders`) | — |
| Status bump (processing/shipped) | "Order update" (`/orders`) | — | — |

---

## 6. Web UI

### Buyer — `src/pages/Orders.tsx`
- `BuyerProtectionCard`: two-step checklist (seller marked / you confirmed), **Mark as delivered** button disabled
  until the seller marked delivered, plus **Request refund**.
- `RefundSheet`: preset reasons + optional details, submits `request_order_refund`.
- `EscrowCard`: held / released / disputed / refunded state with the amount.
- **Cancelled orders lock everything**: action buttons hidden, tracking replaced by a cancelled banner, and a note
  explains any held payment was returned automatically. Cancel is also blocked while a refund request is open.

### Seller — `src/pages/StoreSection.tsx` (Orders view)
- Escrow banner (held vs released), refund-pending banner stating only support admins can resolve it.
- **Mark delivered** action; status bumps limited to `processing` / `shipped`.
- All actions hidden once the order is `delivered`, `cancelled`, or refunded, with an explanatory banner.

### Admin — `src/pages/Admin.tsx`
- **Refunds** tab lists open requests with reason and amount; approve/decline with an admin note via
  `resolve_order_refund`. No other role can see or call it.

---

## 7. Mobile port checklist

1. Call the RPCs — never update `orders` escrow/refund columns directly (the tamper trigger will reject it).
2. Mirror the gating: confirm-delivery disabled until `supplier_marked_delivered_at`; refund only when
   `payment_status = 'paid'` and not delivered/cancelled; everything disabled when `status = 'cancelled'` or
   `refund_status = 'refunded'`.
3. Cancel button only for `awaiting_payment` / `placed` and no open refund.
4. Surface `escrow_status` prominently (held / released / disputed / refunded) with the amount.
5. Subscribe to `notifications` realtime (or rely on push) so both sides see updates live.
6. Refund resolution UI ships only in the admin surface.
