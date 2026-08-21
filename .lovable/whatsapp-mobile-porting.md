# WhatsApp (WasenderAPI) + Tapson — architecture & mobile porting guide

## 1. Provider setup

| Item | Value |
| --- | --- |
| Provider | wasenderapi.com (waapi.app kept as automatic fallback) |
| Outbound endpoint | `POST {WASENDER_BASE_URL}/api/send-message` with `{ to, text }`, `Authorization: Bearer <WASENDER_API_KEY>` |
| Inbound webhook | `<functions-base>/functions/v1/wasender-inbound`, events: `messages.upsert` |
| Webhook auth | shared secret compared against `WASENDER_WEBHOOK_SECRET` (headers `x-webhook-signature` / `x-wasender-signature` / `x-webhook-secret`) |

Secrets in the backend: `WASENDER_API_KEY`, `WASENDER_WEBHOOK_SECRET`, optional `WASENDER_BASE_URL`;
legacy `WAAPI_ACCESS_TOKEN`, `WAAPI_INSTANCE_ID` only used if the Wasender key is absent.

## 2. Server pieces (shared by web and mobile — no per-platform work)

- `_shared/whatsapp.ts` — `sendWhatsApp()`, phone normalisation, `[ref:kind_id]` tags, provider routing.
- `wasender-inbound` — verifies the secret, normalises the Baileys payload, forwards to `waapi-inbound`.
- `waapi-inbound` — the routing brain: dedup by message id, 6-digit link-code pairing,
  user matching by phone/tail/LID, `[ref:...]` → marketplace conversation, otherwise → Tapson.
- `tapson-whatsapp` — AI agent (Lovable AI, tool calls) with a keyword fallback that works
  even without AI credits. Available to **all** senders: matched users get account tools
  (orders, wallet, cart, rides), unmatched senders get search + deep links.
- `dispatch-whatsapp-notification` — renders and sends every event.
- `send-whatsapp-code` / `verify-whatsapp-code` — linking and 2FA codes.

## 3. Full event coverage

Dedicated renderers (rich copy + action link + reply-to-thread ref tag):
`order_placed`, `order_new_sale`, `order_status`, `inquiry_new`, `inquiry_decision`,
`property_inquiry_new`, `finance_application_new`, `rfq_submitted`.

Everything else is covered generically: the DB trigger `trg_notifications_whatsapp`
on `public.notifications` calls `_dispatch_whatsapp('generic_notification', id)`, and the
edge function mirrors the notification's title/body/link to WhatsApp with a type-aware emoji.
That automatically includes rides/carpool, chat messages, jobs & applications, connections,
food orders, restaurant reservations, car rentals, stays & bookings, logistics requests/bids,
service bids, quotes, live streams, group buys, wallet/payout/refund events, verifications
and any future notification type — no extra code per feature.

Duplicate protection:
- generic sends are skipped for types starting with `order`, `sale`, `inquiry`, `rfq`,
  `property_inquiry`, `finance_application` (already handled by the dedicated renderers);
- idempotency check against `whatsapp_send_log` (`event='notification'`, `entity_id=<notification id>`)
  so pg_net retries never double-send.

Delivery gating (`notification_preferences`):
`whatsapp_enabled` + per-category `whatsapp_orders` / `whatsapp_sales` / `whatsapp_inquiries`;
generic notifications require only `whatsapp_enabled`. If a user has **no** preferences row yet
but has a phone on their profile, they are treated as opted-in (they can disable it in Settings).

Every attempt is written to `whatsapp_send_log` (sent / failed / skipped) and every inbound
message to `whatsapp_inbound_log`.

## 4. Mobile porting (React Native / Expo and Flutter)

Nothing about WhatsApp delivery lives on the client — it is DB-trigger driven. The mobile
apps only need the *linking* and *preferences* surfaces:

1. **Link WhatsApp**
   - Call `create_whatsapp_link_code()` RPC (or `send-whatsapp-code` function) → returns a 6-digit code.
   - Deep-link the user into WhatsApp with the code prefilled:
     `https://wa.me/<business-number>?text=<code>` (`Linking.openURL` on RN, `url_launcher` on Flutter).
   - `waapi-inbound` consumes the code, stores `consumed_phone`, sets `whatsapp_enabled = true`
     and `whatsapp_sandbox_joined = true`, and replies with a confirmation message.
   - Poll or subscribe to `notification_preferences` to flip the UI to "Linked".

2. **Phone number** — make sure `profiles.phone` is saved in E.164 during onboarding; it is the
   primary match key for notifications.

3. **Preferences screen** — read/write `notification_preferences.whatsapp_enabled`,
   `whatsapp_orders`, `whatsapp_sales`, `whatsapp_inquiries` (mirror `src/pages/NotificationPreferences.tsx`).

4. **Tapson in-app** — mobile chat uses the `tapson-chat` function; WhatsApp uses
   `tapson-whatsapp`. Same tools and prompt, so behaviour matches across surfaces.

5. **Push vs WhatsApp** — both are fed by `public.notifications` inserts
   (`dispatch_notification_push` → `send-push` for Expo tokens, `dispatch_notification_whatsapp`
   → WhatsApp). Registering an Expo token in `expo_push_tokens` is all mobile needs for push;
   no duplicate notification-creation logic on the client.

6. **Deep links** — WhatsApp messages contain `https://pubstore.app/...` links. Register
   universal links / app links (`pubstore.app`) plus the `tapson-mobile://` scheme so taps
   from WhatsApp open the native app on the same screen (`/orders`, `/product/:id`,
   `/store/actions?section=...`, `/rides`, `/wallet`).

## 5. Verification checklist

- Send `hi` from any WhatsApp number → Tapson help menu (anonymous path).
- Link a code → confirmation message, `notification_preferences.whatsapp_enabled = true`.
- Place an order → buyer `order_placed`, seller `order_new_sale`.
- Trigger a ride/chat/booking notification → generic WhatsApp mirror with the deep link.
- Reply to a message containing `[ref:order_<id>]` → lands in the marketplace thread.
- Inspect `whatsapp_send_log` / `whatsapp_inbound_log` for status and errors.
