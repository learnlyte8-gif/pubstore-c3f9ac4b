## Goal

Rebuild the Flutter Messages surface to match `src/pages/Messages.tsx` 1:1 — inbox with tabs, full-screen thread, swipe-to-reply, long-press actions, reactions, reply quotes, forwarding, and attachment cards. Replaces the stub `messages_screen.dart` and `thread_screen.dart`.

## Scope

### Inbox (`messages_screen.dart`)
- Tabs: Unread · Suppliers · People · Groups · Discover
- Search bar, refresh, unread counts per conversation
- Rows show peer avatar with gradient ring, verified badge, subtitle (response time / @username / group meta), last message + time
- Realtime refresh via Supabase channel + focus/visibility polling
- Auto-open conversation from `?supplier=` or `?conv=` deep-link equivalents (in-app args)
- Merges buyer conversations + supplier-owned + member-based (DMs, group buys)

### Thread (`thread_screen.dart`)
- Header: back, gradient-ring avatar, live dot, verified check, name, subtitle, call/video/info actions, group/supplier deep-link
- Empty state with suggested quick prompts
- Day dividers, sender grouping, tail bubbles, "Host" badge for supplier owner
- SwipeBubble (Dismissible-based) → reply on threshold; long-press → action sheet; double-tap → ❤️ reaction
- Reply preview strip above composer, cancel button
- Reactions row under bubble (emoji + count)
- Forwarded label + Reply quote card
- Composer: attach button, text field, send / mic / heart, product picker sheet
- Attachment card widget for product / supplier / wishlist / cart-unlock / catalog kinds
- Notifications insert on send

### Supporting files
- `services/messages_service.dart` — extended with: fetch messages, insert (with attachment/reply/forward), update reactions, delete, mark read, list group buys / profiles, product search reuse
- `models/message_models.dart` — `ChatConversation`, `ChatMessage`, `ChatAttachment` union, `Reactions` typedef
- `widgets/chat/swipe_bubble.dart`, `widgets/chat/reply_quote.dart`, `widgets/chat/reaction_chips.dart`, `widgets/chat/attachment_card.dart`, `widgets/chat/message_actions_sheet.dart`, `widgets/chat/product_picker_sheet.dart`, `widgets/chat/discover_people.dart`

### Out of scope (left as TODO stubs)
- Voice recording (`Mic` UI shown but records nothing)
- Real audio/video call handlers (buttons no-op)
- InquiryApprovalPanel / PendingInquiriesInbox (kept as placeholder cards linking to the web equivalent behavior; can be built next turn)

## Technical notes

- Realtime: `supabase.channel(...).onPostgresChanges(...)` — one subscription per active conversation for INSERT/UPDATE/DELETE, one shared subscription for conversations list, plus a 15s poll timer while foregrounded.
- Optimistic sends: temp id in local list, replaced by server row on success, removed on error.
- Sticky-to-bottom scroll: track `_stick` from `NotificationListener<ScrollNotification>`, snap to bottom on new message when stuck.
- SwipeBubble: use `Dismissible` with `direction: mine ? endToStart : startToEnd`, `confirmDismiss` returning false so the row springs back; fire `onReply` when past 56px.
- Reactions stored in `messages.reactions jsonb` — update entire map on toggle, mirror web logic (single reaction per user across all emojis).
- Attachments stored in `messages.attachment jsonb`; render via `AttachmentCard` dispatching on `kind`.
- Deep-link params passed through Flutter navigation args instead of URL search params (`MessagesScreen(supplierId: ..., prefill: ..., convId: ...)`).

## Deliverables

New/edited files:
1. `flutter/lib/screens/messages_screen.dart` (rewrite)
2. `flutter/lib/screens/thread_screen.dart` (rewrite)
3. `flutter/lib/services/messages_service.dart` (extend)
4. `flutter/lib/models/message_models.dart` (new)
5. `flutter/lib/widgets/chat/swipe_bubble.dart` (new)
6. `flutter/lib/widgets/chat/reply_quote.dart` (new)
7. `flutter/lib/widgets/chat/reaction_chips.dart` (new)
8. `flutter/lib/widgets/chat/attachment_card.dart` (new)
9. `flutter/lib/widgets/chat/message_actions_sheet.dart` (new)
10. `flutter/lib/widgets/chat/product_picker_sheet.dart` (new)
11. `flutter/lib/widgets/chat/discover_people.dart` (new)

No backend/schema changes — reuses existing `conversations`, `messages`, `conversation_members`, `notifications`, `group_buys`, `profiles`, `suppliers`.

Approve to build, or tell me which parts to trim (e.g. skip Discover tab, skip attachments) if you want it smaller.