# Flutter ↔ Web Parity Checklist (Batch 10 QA sweep)

Every web `Route` in `src/App.tsx` maps to a Flutter screen reachable from the
root shell (bottom-nav, drawer, or programmatic navigation).

| Web route | Flutter screen | ✅ |
| --- | --- | --- |
| `/` | `splash_screen.dart` | ✅ |
| `/auth` | `auth_screen.dart` | ✅ |
| `/onboarding` | `onboarding_screen.dart` | ✅ |
| `/home` | `home_screen.dart` (via `root_shell.dart`) | ✅ |
| `/cart` | `cart_screen.dart` | ✅ |
| `/product/:id` | `product_detail_screen.dart` | ✅ |
| `/search` | `search_screen.dart` | ✅ |
| `/categories` | `categories_screen.dart` | ✅ |
| `/wishlist` | `wishlist_screen.dart` | ✅ |
| `/messages` | `messages_screen.dart` | ✅ |
| `/orders` | `orders_screen.dart` | ✅ |
| `/rfq` | `rfq_screen.dart` | ✅ |
| `/notifications` | `notifications_screen.dart` | ✅ |
| `/compare` | `compare_screen.dart` | ✅ |
| `/live`, `/live/:id` | `live_screen.dart` + `live_viewer_screen.dart` | ✅ |
| `/supplier/:id` | `supplier_screen.dart` | ✅ |
| `/profile`, `/account` | `profile_screen.dart` | ✅ |
| `/store` | `my_store_screen.dart` | ✅ |
| `/store/actions` | `store_actions_screen.dart` | ✅ |
| `/store/analytics` | `store_analytics_screen.dart` | ✅ |
| `/store/ads`, `/store/ads/new` | `ads_dashboard_screen.dart`, `ad_campaign_wizard_screen.dart` | ✅ |
| `/store/:section[/:sub]` | `store_section_screen.dart` | ✅ |
| `/addresses` | `addresses_screen.dart` | ✅ |
| `/payment-methods` | `payment_methods_screen.dart` | ✅ |
| `/become-supplier` | `become_supplier_screen.dart` | ✅ |
| `/help` | `help_center_screen.dart` | ✅ |
| `/privacy` | `privacy_screen.dart` | ✅ |
| `/settings` | `settings_screen.dart` | ✅ |
| `/settings/notifications` | `notification_preferences_screen.dart` | ✅ |
| `/wallet` | `wallet_screen.dart` | ✅ |
| `/verification` | `verification_screen.dart` | ✅ |
| `/news[/:slug]` | `news_screen.dart` | ✅ |
| `/stays[/:id]` | `stays_screen.dart` | ✅ |
| `/auto[/:id]` | `auto_screen.dart` | ✅ |
| `/industrial[/:id]` | `industrial_screen.dart` | ✅ |
| `/agro[/:id]` | `agro_screen.dart` | ✅ |
| `/rides[/:id]` | `rides_screen.dart` | ✅ |
| `/driver` | `driver_screen.dart` | ✅ |
| `/services` | `services_screen.dart` | ✅ |
| `/properties` | `properties_screen.dart` | ✅ |
| `/logistics` | `logistics_screen.dart` | ✅ |
| `/finance` | `finance_screen.dart` | ✅ |
| `/jobs[/:id]` | `jobs_screen.dart` | ✅ |
| `/jobs/feed` | `jobs_feed_screen.dart` | ✅ |
| `/jobs/network` | `jobs_network_screen.dart` | ✅ |
| `/jobs/me`, `/jobs/people/:userId` | `jobs_profile_screen.dart` | ✅ |
| `/car-rentals[/:id]` | `car_rentals_screen.dart` | ✅ |
| `/restaurants[/:id]` | `restaurants_screen.dart` | ✅ |
| `/u/:userId` | `user_profile_screen.dart` | ✅ |
| `/group-buy/:id` | `group_buy_detail_screen.dart` | ✅ |
| `/pay/:kind/:id` | `pay_action_screen.dart` | ✅ |
| `/admin` | `admin_screen.dart` | ✅ |
| `/unsubscribe` | `unsubscribe_screen.dart` | ✅ |

## Shimmer audit
All screen-level loading states now use `Skeletons.*` (no `CircularProgressIndicator`
as a page body). Remaining `CircularProgressIndicator` usages are only in-button
spinners (submit/upload buttons), which is the intended pattern.

Fixed in this batch:
- `onboarding_screen.dart` — auth-check → `Skeletons.screen(list)`
- `pay_action_screen.dart` — record fetch → `Skeletons.list`
- `restaurants_screen.dart` — detail load → `Skeletons.screen(detail)`
- `rfq_screen.dart` — RFQ list → `Skeletons.list`
- `settings_screen.dart` — interests load → `Skeletons.chipRow`

## List audit
All long, data-driven lists use `ListView.builder` / `GridView.builder`.
Remaining bare `ListView(children: [...])` occurrences are static composed
screens (settings, help, drawer, product-detail sections) with a fixed number
of children — the intended pattern.

## Previously-deferred items — now shipped
- **Google Sign-In**: `auth_service.dart` exposes `signInWithGoogle()` using
  `google_sign_in` + `supabase.auth.signInWithIdToken(OAuthProvider.google)`;
  wired into `auth_screen.dart` with a "Continue with Google" button.
  Requires `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_WEB_CLIENT_ID` via `--dart-define`
  and Google enabled in Lovable Cloud auth providers.
- **Push notifications**: new `services/push_service.dart` initializes
  Firebase, requests permission, and upserts the FCM/APNs token into
  `public.push_subscriptions` (same table the web `send-push` function reads).
  Called from `main()` and on every successful sign-in.
- **Deep admin analytics**: `admin_screen.dart` rebuilt with 3 tabs
  (Overview / Analytics / Moderation): 30-day revenue KPI + `fl_chart`
  line-chart, top verticals by supplier count, recent orders list, and
  inline approve/reject actions for pending KYC verifications.

Nothing is deferred — every route in `src/App.tsx` has a fully functional
Flutter counterpart wired to the same Lovable Cloud backend.
