# Wallet Top-Up System

## Overview

The wallet top-up system lets users add funds to their **personal wallet balance** using the **Pesepay** hosted checkout. Funds are held in `public.wallets` and every movement is recorded in `public.wallet_transactions`.

---

## User Flow

1. User opens **Wallet** (`/wallet`) and enters an amount (minimum **$1.00**).
2. App calls `pesepay-create-payment` edge function with:
   - `purpose: "wallet_topup"`
   - `amount`
   - `returnUrl` (web callback or mobile deep link, e.g. `tapson-mobile://payment-callback`)
3. Pesepay returns a `redirectUrl`; the app sends the user to the payment page.
4. After payment, Pesepay calls the `pesepay-result` webhook server-to-server.
5. The webhook decrypts the payload and, if `paid === true`, calls `apply_wallet_transaction('topup', amount)` for the user.
6. The user is redirected back to the app; the Wallet page polls `pesepay-status` up to 4 times (2.5 s apart) to confirm the outcome and refresh the balance.

---

## Database Schema

### `public.wallets`

| Column | Purpose |
|--------|---------|
| `user_id` | Wallet owner (PK / FK to `auth.users`) |
| `balance` | Personal wallet (top-ups, refunds, transfers) |
| `sales_balance` | Funds from product sales (settled after delivery) |

### `public.wallet_transactions`

| Column | Purpose |
|--------|---------|
| `id` | UUID |
| `user_id` | Owner |
| `kind` | `topup`, `purchase`, `refund`, `adjustment`, `transfer_in`, `transfer_out`, `withdrawal_hold`, `payout`, `sale`, `sales_to_personal_in`, `sales_to_personal_out` |
| `amount` | Signed numeric value |
| `balance_after` | Snapshot after the transaction |
| `description` | Human-readable note |
| `reference` | External reference (e.g. `pesepay:<ref>`) |
| `account` | `personal` or `sales` |
| `created_at` | Timestamp |

---

## Edge Functions

### `pesepay-create-payment`

**File:** `supabase/functions/pesepay-create-payment/index.ts`

Initiates a Pesepay hosted checkout. For `wallet_topup`, it builds an encrypted payload with:

```json
{
  "amountDetails": { "amount": 10.00, "currencyCode": "USD" },
  "reasonForPayment": "PUBSTORE Pay top-up",
  "resultUrl": "<project_url>/functions/v1/pesepay-result",
  "returnUrl": "https://... or tapson-mobile://...",
  "merchantReference": "wallet_topup_<user_prefix>_<timestamp>",
  "customer": { "email": "user@example.com" }
}
```

**Allowed `returnUrl` schemes**

- `http:` / `https:`
- `tapson-mobile:`
- `tapson:`
- `pubstore:`
- `com.pubstore.app:`

**Response**

```json
{
  "ok": true,
  "reference": "wallet_topup_abc123_1699999999999",
  "pesepayReference": "PESPAY-...",
  "redirectUrl": "https://checkout.pesepay.com/...",
  "amount": "10.00"
}
```

### `pesepay-result`

**File:** `supabase/functions/pesepay-result/index.ts`

Server-to-server webhook. It **only trusts encrypted `payload` fields**; plain JSON callbacks are rejected. It uses `interpretPesepay()` from `_shared/pesepay-status.ts` to decide the outcome.

For `wallet_topup_*` references:

1. Parses the user prefix from `merchantReference`.
2. Looks up the user in `public.profiles` with `user_id ILIKE '<prefix>%'`.
3. Deduplicates by `reference = pesepay:<pesepayReference>`.
4. Calls `apply_wallet_transaction(_kind := 'topup', _amount, _description, _reference)`.

### `pesepay-status`

**File:** `supabase/functions/pesepay-status/index.ts`

Client-side status checker. Accepts a `reference` and queries Pesepay's check-payment endpoint. Returns:

```json
{
  "ok": true,
  "status": "SUCCESS",
  "paid": true,
  "amount": 10.00,
  "reference": "wallet_topup_abc123_1699999999999",
  "pesepayReference": "PESPAY-...",
  "credited": true
}
```

The interpreter treats the `paid` boolean as the source of truth and maps statuses such as `SUCCESS`, `LIQUIDATED`, `FAILED`, `CANCELLED`, `PENDING`, and `PROCESSING` accordingly.

---

## Shared Status Interpreter

**File:** `supabase/functions/_shared/pesepay-status.ts`

`interpretPesepay(inner)` normalises the Pesepay callback/check response:

- `paid`: `inner.paid === true`
- `failed`: status string contains `fail`, `declin`, `reject`, or `error`
- `cancelled`: status string contains `cancel` or `abort`
- `pending`: status string contains `pend`, `process`, or `init`
- Amount is read from `amountDetails.amount` or `amount`.
- References are read from `merchantReference` and `referenceNumber`.

---

## Frontend

### `src/pages/Wallet.tsx`

- Input field with `min={1}` and placeholder `$1.00 minimum`.
- Calls `pesepay-create-payment` via `supabase.functions.invoke`.
- On return from Pesepay, polls `pesepay-status` up to 4 times.
- Shows toast feedback: success, syncing, or pending.

### `src/hooks/useWallet.ts`

- Fetches `balance` and `sales_balance` from `public.wallets`.
- Fetches recent `wallet_transactions`.
- Subscribes to realtime changes on `wallets` and `wallet_transactions` so the balance updates instantly after a top-up.

---

## Environment Secrets

| Secret | Purpose |
|--------|---------|
| `PESEPAY_INTEGRATION_KEY` | Pesepay API integration key (sent in `authorization` header) |
| `PESEPAY_ENCRYPTION_KEY` | 32-byte AES key used to encrypt/decrypt payloads |
| `PESEPAY_ENV` | `live` or `sandbox` — selects the API base URL |
| `PESEPAY_BASE_URL` | Optional override for the Pesepay API base |

---

## Commission / Settlement Notes

- Wallet top-ups go to the **personal** account (`balance`).
- Sales revenue goes to the **sales** account (`sales_balance`).
- Suppliers can move funds from `sales_balance` to `balance` via `move_sales_to_personal`.
- Orders are paid from `balance` using `pay-order` or `pay-group-buy-order`.

---

## Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Wallet not updating after payment | `pesepay-status` was checking `liquidation` string instead of `paid` boolean | Updated interpreter to trust `paid` flag |
| Minimum top-up too high | Hard-coded $10 validation | Reduced to $1.00 in `Wallet.tsx` and Flutter wallet screen |
| Deep link return URL rejected | Only `http/https` allowed | Added custom URI schemes to `ALLOWED_RETURN_SCHEMES` |
| Duplicate top-up credits | Webhook retried | Deduplicate by `reference` before calling `apply_wallet_transaction` |

---

## Related Files

- `src/pages/Wallet.tsx`
- `src/hooks/useWallet.ts`
- `supabase/functions/pesepay-create-payment/index.ts`
- `supabase/functions/pesepay-result/index.ts`
- `supabase/functions/pesepay-status/index.ts`
- `supabase/functions/_shared/pesepay-status.ts`
- `supabase/functions/pay-order/index.ts`
- `supabase/functions/pay-group-buy-order/index.ts`
