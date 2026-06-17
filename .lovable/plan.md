## What we're building

PUBSTORE will send branded WhatsApp messages from your Twilio sandbox for the events you picked, and incoming replies will land in the existing Messages inbox so you can answer from the app.

## Scope (events)

Outbound WhatsApp triggers:
1. **Order confirmation + status updates** → buyer (placed, paid, shipped, delivered, cancelled, refunded)
2. **New sale alert** → seller
3. **Inquiry / RFQ / property / finance** notifications → the receiving party (supplier, lister, finance provider)

Two-way: replies to any PUBSTORE WhatsApp message land in the user's in-app conversation with PUBSTORE (or with the counter-party where one exists, e.g. supplier ↔ buyer inquiry thread).

## User experience

- New "WhatsApp notifications" section in **Settings → Notifications**:
  - Toggle: *Send me WhatsApp notifications* (off by default — sandbox requires explicit join).
  - Shows the user's profile phone (read-only — they edit it on Account).
  - **Sandbox join instructions** banner: "Send `join <code>` to +1 415 523 8886 on WhatsApp to activate" with copy buttons. Until they join, Twilio will reject — we surface a friendly state in the UI.
  - Per-event sub-toggles (orders / sales / inquiries) that mirror the email prefs.
- A small "via WhatsApp" badge in the notification preferences list.

## Backend

### Database (one migration)
- Add to `public.profiles`: nothing — we reuse `phone`.
- Add to `public.notification_preferences`:
  - `whatsapp_enabled boolean default false`
  - `whatsapp_orders boolean default true`
  - `whatsapp_sales boolean default true`
  - `whatsapp_inquiries boolean default true`
  - `whatsapp_sandbox_joined boolean default false` (flipped to true the first time we receive an inbound from that number, so the UI can stop nagging).
- New table `public.whatsapp_send_log` (event, to, status, twilio_sid, error, payload, created_at) — analogous to `email_send_log`, with RLS so users see only their own rows and service_role full access.
- New table `public.whatsapp_inbound_log` (from, body, twilio_sid, conversation_id, created_at) for debugging + idempotency.
- DB triggers (pg_net) on `orders` (insert + status update), `product_inquiries`, `rfqs`, `property_inquiries`, `finance_applications` → call `dispatch-whatsapp-notification` edge function. Triggers no-op when the recipient has the relevant toggle off.

### Edge functions
1. **`send-whatsapp`** (internal): wraps Twilio gateway `/Messages.json` with `From=whatsapp:+14155238886`, `To=whatsapp:+E164`. Logs every send into `whatsapp_send_log`. Skips + logs `skipped_opt_out` when prefs are off or phone missing. `verify_jwt = true`, callable from other edge functions with service-role.
2. **`dispatch-whatsapp-notification`** (`verify_jwt = false`, pg_net caller): receives `{event, entity_id}`, loads the entity + recipient profile + prefs, renders the right short message (with deep link back into the app — e.g. `https://pubstore.app/orders/<id>`) and calls `send-whatsapp`.
3. **`twilio-whatsapp-inbound`** (`verify_jwt = false`, public webhook): Twilio posts here when a user replies. We:
   - Look up the user by phone.
   - Mark `whatsapp_sandbox_joined = true` on first inbound.
   - Find or create a system PUBSTORE conversation (or the active counter-party conversation if the reply is to a specific event, detected via a short `[ref:order_<id>]` tag we include in outbound messages).
   - Insert the message into `messages` so it shows up in the existing Messages page in real time.
   - Return empty TwiML so Twilio doesn't auto-reply.

### Twilio
- Already connected (test number confirmed). Sandbox sender hardcoded to `whatsapp:+14155238886`.
- After deploy, you paste the inbound webhook URL into Twilio Sandbox settings — I'll show you the exact URL.

## Message style

Short, plain-text WhatsApp messages (no HTML, sandbox doesn't allow rich templates) with the PUBSTORE brand prefix and a deep link, e.g.:

```
🛒 PUBSTORE — Order #A1B2 confirmed
2× Wireless headphones — $59.98
Track: https://pubstore.app/orders/<id>
Reply here to talk to the seller.
[ref:order_<id>]
```

## Out of scope (for this round)

- Marketing blasts (still email/in-app only).
- Approved-template / production sender (you said sandbox).
- OTP over WhatsApp (you didn't pick it).

## Technical notes

- Twilio called via Lovable connector gateway (no raw secrets in code).
- Phone normalization to E.164 helper in `_shared/phone.ts`.
- All triggers use `pg_net` (already enabled for the email system) — no new infra.
- Inbound idempotency via `twilio_sid` unique index.
- We surface a clean error in the UI if the user hasn't joined the sandbox yet (Twilio returns code `63007` / `63015`).
