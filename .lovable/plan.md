# Flutter Parity Migration Plan

Goal: bring the Flutter app to full feature parity with the web app (`src/pages/*`). Every screen, every action, every data flow that exists on web must exist and work in Flutter.

## Approach

Work in ordered batches. For each batch:
1. Read the web page(s) in `src/pages/` + supporting hooks/components.
2. Diff against the matching `flutter/lib/screens/*` file.
3. Port missing UI sections, actions, Supabase queries, navigation, empty/error/loading (shimmer) states.
4. Wire navigation from drawer, home, and cross-screen links.
5. Verify: `flutter analyze` + spot-check by reading the resulting file.
6. Report per batch: what was missing, what was added, what still needs backend work.

Rules kept throughout:
- Reuse `Skeletons.*` for loading states (no spinners).
- `ListView.builder` / `GridView.builder` for all lists.
- Match web Supabase table/column names exactly (schema is source of truth).
- Semantic tokens from `theme/palette.dart` — no hardcoded colors.
- Keep `owner_id`, `image`, `active`, `moq`, `sold`, `text` conventions already fixed.

## Batches (execution order)

**Batch 1 — Shell & Navigation**
- `root_shell.dart`, drawer, bottom nav, `splash_screen.dart`, `onboarding_screen.dart`, `auth_screen.dart`
- Confirm every web route in `App.tsx` has a Flutter destination and drawer entry.

**Batch 2 — Home & Discovery**
- `home_screen.dart` (feed, wallet header, new arrivals, verticals strip, stories, live rail)
- `categories_screen.dart`, `search_screen.dart` (universal search), `news_screen.dart`

**Batch 3 — Product & Commerce Core**
- `product_detail_screen.dart` (gallery, variants, tier prices, reviews, inquiry, group buy, share)
- `cart_screen.dart`, `wishlist_screen.dart`, `compare_screen.dart`, `orders_screen.dart`, `pay_action_screen.dart`

**Batch 4 — Supplier / Store**
- `my_store_screen.dart`, `store_actions_screen.dart`, `store_section_screen.dart` (products, orders, inventory, settings, coupons, fulfilment)
- `store_analytics_screen.dart`, `ads_dashboard_screen.dart`, `ad_campaign_wizard_screen.dart`
- `become_supplier_screen.dart`, `supplier_screen.dart` (public storefront)

**Batch 5 — Verticals**
- `stays`, `auto`, `car_rentals`, `industrial`, `agro`, `properties`, `services`, `logistics`, `finance`, `restaurants`, `rides`, `driver`
- Each: list + filters + detail + booking/inquiry action, matching web.

**Batch 6 — Jobs & Social**
- `jobs_screen.dart`, `jobs_feed_screen.dart`, `jobs_network_screen.dart`, `jobs_profile_screen.dart`
- `user_profile_screen.dart`, followers/following, post likes/comments.

**Batch 7 — Messaging & Live**
- `messages_screen.dart`, `thread_screen.dart` (attachments, quotes, ride/inquiry cards)
- `live_screen.dart` (streams list, viewer, reactions, chat)
- Tapson chatbot behaviour aligned with web `tapson-chat` responses.

**Batch 8 — Account & Settings**
- `profile_screen.dart`, `account`, `addresses_screen.dart`, `payment_methods_screen.dart`
- `wallet_screen.dart` (topup, withdraw, ledger), `verification_screen.dart`
- `settings_screen.dart` + `notification_preferences_screen.dart`, `privacy_screen.dart`, `help_center_screen.dart`, `unsubscribe_screen.dart`

**Batch 9 — Admin & Misc**
- `admin_screen.dart`, `group_buy_detail_screen.dart`, `rfq_screen.dart`, notifications screen, splash polish.

**Batch 10 — Final QA sweep**
- Route audit: every `App.tsx` `<Route>` has a Flutter equivalent reachable from UI.
- Shimmer audit: no `CircularProgressIndicator` on screen-level loading.
- List audit: all long lists use `.builder`.
- Run `flutter analyze`; fix warnings.
- Produce a parity checklist marking each web route ✅.

## Deliverables per batch
- Edited Flutter files.
- Short "diff report" listing: features ported, features intentionally deferred (with reason), any new migrations needed.

## Kickoff
Reply "start" (or "start batch N") and I will begin executing top-down, one batch per turn, without stopping until every batch is complete or you tell me to pause.
