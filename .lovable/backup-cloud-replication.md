# Backup Cloud — Replicating the Backend to a Second Supabase Project

Goal: stand up a **mirror project** (call it `BACKUP`) that is structurally identical to the
live project (`PRIMARY`) — same schema, functions, triggers, RLS, storage, edge functions,
secrets, auth config — and keep it loaded with current user + business data.

Nothing in this document changes `PRIMARY`. Every step is run against `BACKUP`.

---

## 0. Naming / variables used below

```bash
export PRIMARY_DB="postgresql://postgres:<pw>@db.<primary-ref>.supabase.co:5432/postgres"
export BACKUP_DB="postgresql://postgres:<pw>@db.<backup-ref>.supabase.co:5432/postgres"
export BACKUP_REF="<backup-project-ref>"
export BACKUP_URL="https://<backup-project-ref>.supabase.co"
```

The Lovable-managed project's DB password/service role key are not exposed in the sandbox.
Use the Lovable **Cloud → Advanced settings → Export data** page for a data snapshot of
`PRIMARY`, and use a plain (self-owned) Supabase project as `BACKUP` so you hold its keys.

---

## 1. Create the backup project

1. New Supabase project, **same region** as primary (`eu-west-1`) so replication latency and
   egress stay low.
2. Compute size: start `micro`, size up before the first full data load if the primary is >2 GB.
3. Record: project ref, anon/publishable key, service role key, DB password.

---

## 2. Extensions (must exist before schema)

The primary relies on these; create them first in `BACKUP`:

```sql
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_net;        -- outbound HTTP from triggers (push, webhooks)
create extension if not exists pg_cron;       -- scheduled jobs
create extension if not exists pg_trgm;       -- trigram product search
create extension if not exists vector;        -- 1536-dim product embeddings
create extension if not exists postgis;       -- only if geo columns are used
```

`pg_net` and `pg_cron` live in the `extensions`/`cron` schemas — enable them from the Database →
Extensions page if the `create extension` call is blocked.

---

## 3. Schema: replay the migration history

`supabase/migrations/` holds **115 ordered migration files** — that is the source of truth for
the whole schema (tables, RLS, grants, functions, triggers, cron jobs).

```bash
# from the repo root
supabase link --project-ref $BACKUP_REF
supabase db push            # replays every file in supabase/migrations in filename order
```

If `db push` is unavailable, replay manually in filename order (they are timestamp-prefixed):

```bash
for f in supabase/migrations/*.sql; do
  echo "== $f"
  psql "$BACKUP_DB" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

Notes:
- Some migrations reference the vault/secret names; those resolve to `BACKUP`'s own secrets.
- Migrations that `insert` seed rows (categories, `ai_plans`, `ai_feature_costs`,
  `supplier_plans`, `platform_settings`) will seed `BACKUP` automatically — do **not** also copy
  those tables in step 6, or you get duplicate-key errors.

### 3b. Structural verification

```bash
psql "$BACKUP_DB" -At -c "select count(*) from information_schema.tables where table_schema='public'"
psql "$BACKUP_DB" -At -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"
psql "$BACKUP_DB" -At -c "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"   -- must return 0 rows
```

The public schema should contain ~110 tables, including the core groups:

| Domain | Tables |
| --- | --- |
| Catalog | `products`, `product_variants`, `product_tier_prices`, `categories`, `suppliers`, `supplier_certifications` |
| Commerce | `orders`, `order_items`, `cart_items`, `wishlist_items`, `coupons`, `coupon_redemptions`, `reviews` |
| Money | `wallets`, `wallet_transactions`, `manual_topups`, `withdrawal_requests`, `supplier_commissions`, `payment_methods` |
| Monetization | `ai_plans`, `ai_credit_accounts`, `ai_credit_ledger`, `ai_credit_packs`, `ai_feature_costs`, `supplier_plans`, `supplier_subscriptions`, `ad_campaigns`, `ad_events`, `ad_campaign_stats` |
| Identity | `profiles`, `user_roles`, `user_verifications`, `addresses`, `notification_preferences` |
| Verticals | `stays`, `stay_bookings`, `properties`, `vehicles`, `car_rentals`, `rides`, `shared_trips`, `restaurants`, `menu_items`, `agro_listings`, `industrial_listings`, `job_postings`, `job_seeker_profiles`, `logistics_requests`, `service_requests`, `finance_products` |
| Messaging / notify | `conversations`, `conversation_members`, `messages`, `notifications`, `push_subscriptions`, `expo_push_tokens`, `email_send_log`, `whatsapp_*` |

> RLS + GRANTs come from the migrations. Never hand-create a table on `BACKUP` without the
> matching `GRANT` block, or PostgREST returns permission errors.

---

## 4. Auth: users, providers, config

### 4a. Provider + policy config (manual, per project)
Replicate on `BACKUP`:
- Email/password enabled, **email confirmations ON**, anonymous sign-ups **OFF**.
- Google OAuth provider: same client id/secret, redirect `https://<backup-ref>.supabase.co/auth/v1/callback`.
- Site URL + redirect allow-list: preview URL, `https://pubstore.app`, `https://www.pubstore.app`,
  and the mobile deep link `tapson-mobile://payment-callback`.
- JWT expiry, password strength, and the auth email hook → `auth-email-hook` function.

### 4b. User accounts
`auth.users` cannot be inserted through the API — copy it at the SQL level, preserving `id`
(every `public` table keys off `auth.users.id`):

```bash
pg_dump "$PRIMARY_DB" \
  --data-only --no-owner --no-privileges \
  -t 'auth.users' -t 'auth.identities' \
  > /tmp/auth_users.sql

psql "$BACKUP_DB" -v ON_ERROR_STOP=1 -f /tmp/auth_users.sql
```

Rules:
- Copy `encrypted_password` as-is — hashes are portable, so existing passwords keep working.
- Do **not** copy `auth.sessions` / `auth.refresh_tokens`; users re-login on the backup.
- If the primary DB role can't read `auth`, fall back to: export `profiles` + emails, then
  invite users on `BACKUP` (`auth.admin.inviteUserByEmail`) and remap ids — much more work, so
  prefer the SQL copy.
- After the copy, confirm counts match: `select count(*) from auth.users;`

---

## 5. Storage buckets

Create buckets with identical names/visibility, then replay the `storage.objects` policies from
the migrations (they are already in `supabase/migrations`):

| Bucket | Visibility | Notes |
| --- | --- | --- |
| `product-images` | public | writes limited to `auth.uid()/` prefix |
| `verifications` | private | admin-read only (ID documents) |
| any others listed in Storage on primary | match exactly | check before switching over |

File copy:

```bash
# list every object, stream each one primary -> backup
psql "$PRIMARY_DB" -At -c "select bucket_id||'/'||name from storage.objects" > /tmp/objects.txt
while read -r path; do
  b="${path%%/*}"; k="${path#*/}"
  curl -sf "https://<primary-ref>.supabase.co/storage/v1/object/$b/$k" \
       -H "Authorization: Bearer $PRIMARY_SERVICE_KEY" -o /tmp/blob || continue
  curl -sf -X POST "$BACKUP_URL/storage/v1/object/$b/$k" \
       -H "Authorization: Bearer $BACKUP_SERVICE_KEY" \
       -H "x-upsert: true" --data-binary @/tmp/blob
done < /tmp/objects.txt
```

---

## 6. Data load

Order matters because of foreign keys. Load in these waves:

1. `profiles`, `user_roles`, `addresses`, `notification_preferences`
2. `suppliers` (self-referencing `mirror_of` — load with the FK deferred or run twice)
3. `products`, `product_variants`, `product_tier_prices`, `reviews`
4. Vertical listings (`stays`, `properties`, `vehicles`, `car_rentals`, `restaurants`, `menu_*`,
   `agro_listings`, `industrial_listings`, `job_*`, `service_*`, `logistics_*`, `finance_*`)
5. `wallets`, `wallet_transactions`, `ai_credit_accounts`, `ai_credit_ledger`,
   `supplier_subscriptions`, `supplier_commissions`
6. `orders`, `order_items`, `cart_items`, `wishlist_items`, `coupons`, `coupon_redemptions`
7. Messaging + notifications + push tokens + logs (optional; large and low value)

```bash
pg_dump "$PRIMARY_DB" --data-only --no-owner --no-privileges \
  --disable-triggers \
  -t public.profiles -t public.suppliers -t public.products \
  ... \
  > /tmp/data.sql
psql "$BACKUP_DB" -v ON_ERROR_STOP=1 -f /tmp/data.sql
```

`--disable-triggers` matters: the primary has triggers that recompute commissions, enforce
listing caps, block premature `delivered`, and fire `pg_net` webhooks. Loading with triggers
live would double-charge wallets and spam notifications.

Skip (seeded by migrations, or must not be replayed): `categories`, `ai_plans`,
`ai_feature_costs`, `ai_credit_packs`, `supplier_plans`, `platform_settings`,
`search_reco_cache`, `learnlyte_ai_cache`, `_push_test_state`.

Reset sequences afterwards if any table uses `serial`/`identity`:

```sql
select setval(pg_get_serial_sequence(c.table_name, c.column_name),
       coalesce((select max(x) from (select 1) t), 1))
from information_schema.columns c where false; -- template; run per-table as needed
```

---

## 7. Edge functions (38 functions)

Every function lives in `supabase/functions/<name>/index.ts` with shared code in `_shared/`.
Deploy them all against `BACKUP`:

```bash
supabase link --project-ref $BACKUP_REF
for d in supabase/functions/*/; do
  n=$(basename "$d"); [ "$n" = "_shared" ] && continue
  supabase functions deploy "$n" --no-verify-jwt
done
```

Functions to deploy: `agora-token`, `auth-email-hook`, `dispatch-order-email`,
`dispatch-whatsapp-notification`, `generate-ad`, `handle-email-suppression`,
`handle-email-unsubscribe`, `image-search`, `import-list`, `import-product`, `import-stay`,
`learnlyte-ai`, `mcp`, `omkar-airbnb-search`, `omkar-aliexpress-search`, `pay-group-buy-order`,
`pay-order`, `paypal-capture-order`, `paypal-create-order`, `paypal-public-config`,
`pesepay-create-payment`, `pesepay-result`, `pesepay-status`, `preview-transactional-email`,
`process-email-queue`, `search-recommendations`, `semantic-search`, `send-push`,
`send-transactional-email`, `send-whatsapp-code`, `tapson-chat`, `tapson-whatsapp`,
`test-whatsapp`, `twilio-whatsapp-inbound`, `validate-iap-receipt`, `verify-whatsapp-code`,
`waapi-inbound`.

Keep `supabase/config.toml`'s per-function settings identical (`verify_jwt`, import maps).

---

## 8. Secrets / function env

Set the same secret **names** on `BACKUP` (values are the same third-party credentials, except
Supabase's own which are project-specific):

Project-specific — use `BACKUP`'s values: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL`, `SUPABASE_JWKS`.

Copy as-is: `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `LOVABLE_API_KEY`, `OPENAI_API_KEY`,
`OMKAR_API_KEY`, `OMKAR_AIRBNB_API_KEY`, `FIRECRAWL_API_KEY`,
`GOOGLE_SEARCH_CONSOLE_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PESEPAY_ENCRYPTION_KEY`,
`PESEPAY_INTEGRATION_KEY`, `PESEPAY_ENV`, `TWILIO_API_KEY`, `WAAPI_ACCESS_TOKEN`,
`WAAPI_INSTANCE_ID`, `WAAPI_TRIAL_NUMBER`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

> While `BACKUP` is only a standby, point payment secrets at **sandbox** credentials so a
> stray webhook can't move real money. Swap to live values only at cutover.

---

## 9. Cron jobs, realtime, webhooks

- **Cron**: three migrations register `cron.schedule` jobs (ride matching / carpool sweep,
  email queue, digests). Verify with `select jobname, schedule, command from cron.job;`.
  **Unschedule them on `BACKUP`** while it is a standby — otherwise both projects send emails
  and push notifications for the same rows.
- **Realtime**: re-add publication members that the app subscribes to:
  ```sql
  alter publication supabase_realtime add table public.wallets, public.wallet_transactions,
    public.messages, public.notifications, public.rides, public.orders;
  ```
- **pg_net triggers** (Expo push) will fire on `BACKUP` inserts. Keep them, but only after
  the standby stops receiving mirrored writes, or you double-notify.

---

## 10. Keeping user data flowing into the backup

Pick one of three modes.

### A. Scheduled snapshot (simplest, recommended to start)
Nightly job that pulls the primary's data and reloads `BACKUP`:
- source: Lovable **Cloud → Advanced settings → Export data** (CSV/dump), or `pg_dump --data-only`
- reload with `--disable-triggers`, truncating each table before load (`truncate ... cascade` in
  reverse FK order) so the copy stays exact.
- RPO: up to 24 h. Zero impact on the app.

### B. Logical replication (near-real-time, read-only standby)
On `PRIMARY`:
```sql
create publication pubstore_backup for table
  public.profiles, public.suppliers, public.products, public.orders, public.order_items,
  public.wallets, public.wallet_transactions, public.stays, public.rides, ... ;
```
On `BACKUP` (schema already created by step 3):
```sql
create subscription pubstore_backup_sub
  connection 'host=db.<primary-ref>.supabase.co port=5432 dbname=postgres user=<user> password=<pw> sslmode=require'
  publication pubstore_backup
  with (copy_data = true, create_slot = true);
```
Rules: `BACKUP` tables must be write-idle for replicated tables; disable triggers on them
(`alter table x disable trigger user`) so business logic doesn't re-run; monitor
`pg_stat_replication` / slot lag on the primary and drop the slot if it grows unbounded.
Replication does **not** carry `auth.users` DDL-level changes — re-run step 4b periodically.

### C. Dual-write from the app (real-time, no DB peering)
Add a mirror hop on the write path:
1. A DB trigger on the tables you care about pushes the row (`to_jsonb(new)`, table name, op)
   into an outbox table.
2. A cron'd edge function drains the outbox and `upsert`s into `BACKUP` via its REST endpoint
   using `BACKUP`'s service role key (stored as `BACKUP_SUPABASE_URL` /
   `BACKUP_SERVICE_ROLE_KEY` secrets).
3. Failed rows stay in the outbox with a retry count — the queue is the durability guarantee.

Use C only for the tables that truly need second-level freshness (`profiles`, `orders`,
`wallet_transactions`, `products`); pair it with A for everything else.

---

## 11. Client switchover

The web app reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID`
(`src/integrations/supabase/client.ts`). The mobile apps read `react-native/src/config/env.ts`
and `flutter/lib/config/env.dart`.

Cutover checklist:
1. Stop writes to `PRIMARY` (maintenance flag in `platform_settings`).
2. Run one final incremental sync + storage sync.
3. Drop the subscription / stop the mirror job on `BACKUP`, re-enable its triggers and cron.
4. Swap payment secrets to live values on `BACKUP`.
5. Point env vars at `BACKUP`, redeploy web, ship mobile config update.
6. Smoke test: sign in, browse catalog, add to cart, wallet top-up, place order, escrow
   settlement, an AI feature (credits charge), push notification, image upload.

---

## 12. Verification matrix (run after every full rebuild)

| Check | Expected |
| --- | --- |
| `select count(*) from information_schema.tables where table_schema='public'` | matches primary |
| tables without RLS | 0 |
| `select count(*) from auth.users` | matches primary |
| row counts for `profiles`, `suppliers`, `products`, `orders`, `wallets` | match primary |
| `select sum(balance) from wallets` | matches primary |
| deployed edge functions | 37 (all except `_shared`) |
| storage object count per bucket | matches primary |
| `select count(*) from cron.job` | 0 while standby, 3 after cutover |
| sign-in with an existing password | succeeds |

---

## 13. Operational cautions

- Never run both projects with live payment credentials at the same time.
- Never copy `auth.sessions`, `auth.refresh_tokens`, or vault secrets.
- Product embeddings (`products.embedding`) copy fine as `vector` values; if skipped, re-run the
  `semantic-search` backfill on `BACKUP`.
- Escrow/settlement columns are written only by security-definer RPCs — after a data load, do
  not "fix" order money fields by hand; re-run the RPC path instead.
- Keep this file updated whenever a migration adds a table, bucket, secret, or cron job.
