# PUBSTORE — Flutter (fully native)

Pixel-for-pixel native Android/iOS app that mirrors the PUBSTORE web + React
Native builds. Same Lovable Cloud (Supabase) backend, same design tokens, same
component vocabulary — reimplemented in Flutter/Dart with Material 3 + custom
widgets so we get real 60fps native performance on both platforms.

Think of this folder as the third client (web, RN, Flutter) reading from the
same tables. No WebView. No shared bundle.

## Why Flutter alongside React Native

- **Single rendering engine (Skia/Impeller)** — the UI looks _exactly_ the same
  on Android and iOS with zero platform drift, so we can honor the "pixel for
  pixel" contract from the web design system.
- **True native compilation** — Dart AOT to ARM, no JS bridge, predictable
  frame budgets for the marketplace grid + rides map.
- **Tight backend fit** — `supabase_flutter` gives us auth, realtime, storage
  and edge function invocation with the same API surface as the web client.

## One-time setup on your machine

The Lovable sandbox has no Flutter SDK, so bootstrap locally:

```bash
# 1. Install Flutter (stable channel, >= 3.24)
#    https://docs.flutter.dev/get-started/install
flutter --version
flutter doctor

# 2. Copy this folder out of the web repo
cp -R flutter ~/pubstore-flutter
cd ~/pubstore-flutter

# 3. Generate the native shells (Android + iOS) without touching lib/
flutter create . \
  --org app.lovable \
  --project-name pubstore \
  --platforms=android,ios \
  --description "PUBSTORE — native marketplace"

# 4. Install deps
flutter pub get
cd ios && pod install && cd ..

# 5. Run
flutter run                 # picks the connected device
flutter run -d chrome       # web preview
```

The `flutter create .` step generates `android/`, `ios/`, the Gradle wrapper,
`AppDelegate.swift`, `Info.plist`, etc. Everything under `lib/`, `pubspec.yaml`,
`analysis_options.yaml`, and `assets/` is already ours and wins.

## App identity (match the web release)

After `flutter create`, edit:

- `android/app/build.gradle`
  - `applicationId "app.lovable.14b25a14b8c040f29b8231f038ad2828"`
  - `versionCode 11`, `versionName "11.0"`
- `ios/Runner/Info.plist`
  - `CFBundleIdentifier = app.lovable.14b25a14b8c040f29b8231f038ad2828`
  - `CFBundleShortVersionString = 11.0`, `CFBundleVersion = 11`

## Building a release AAB

```bash
flutter build appbundle --release
# AAB: build/app/outputs/bundle/release/app-release.aab
```

Sign with the same keystore used for the Capacitor / RN builds
(`scripts/build-android-aab.sh` documents the env vars).

## Feature map — every web screen, mirrored

Every screen in `lib/screens/` is a 1:1 mirror of the web route with the same
Supabase queries. Verticals reuse a shared `VerticalScreen` widget, exactly
like the React Native build.

### Shell & auth

| Web route                       | Flutter screen                       | Backend                     |
| ------------------------------- | ------------------------------------ | --------------------------- |
| `/splash`                       | `screens/splash_screen.dart`         | –                           |
| `/onboarding`                   | `screens/onboarding_screen.dart`     | –                           |
| `/auth`                         | `screens/auth_screen.dart`           | `auth`                      |
| App shell (bottom tabs)         | `navigation/root_shell.dart`         | –                           |

### Core commerce

| Web route              | Flutter screen                         | Backend table(s)                          |
| ---------------------- | -------------------------------------- | ----------------------------------------- |
| `/`                    | `screens/home_screen.dart`             | `products`, `categories`                  |
| `/categories`          | `screens/categories_screen.dart`       | `categories`                              |
| `/search`              | `screens/search_screen.dart`           | `products` (ilike + rank)                 |
| `/product/:id`         | `screens/product_detail_screen.dart`   | `products`, `product_variants`, `reviews` |
| `/compare`             | `screens/compare_screen.dart`          | `products`                                |
| `/cart`                | `screens/cart_screen.dart`             | `cart_items`, `orders`, `order_items`     |
| `/wishlist`            | `screens/wishlist_screen.dart`         | `wishlist_items`                          |
| `/orders`              | `screens/orders_screen.dart`           | `orders`, `payment_status_history`        |
| `/pay/:orderId`        | `screens/pay_action_screen.dart`       | `orders`, edge fns                        |

### Account & wallet

| Web route                    | Flutter screen                           | Backend                                                       |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `/account`                   | `screens/account_screen.dart`            | `profiles`                                                    |
| `/addresses`                 | `screens/addresses_screen.dart`          | `addresses`                                                   |
| `/payment-methods`           | `screens/payment_methods_screen.dart`    | `payment_methods`                                             |
| `/wallet`                    | `screens/wallet_screen.dart`             | `wallets`, `wallet_transactions`, `manual_topups`             |
| `/notifications`             | `screens/notifications_screen.dart`      | `notifications` (realtime)                                    |
| `/notification-preferences`  | `screens/notification_prefs_screen.dart` | `notification_preferences`                                    |
| `/settings`                  | `screens/settings_screen.dart`           | `profiles`, `platform_settings`                               |
| `/verification`              | `screens/verification_screen.dart`       | `user_verifications`                                          |
| `/help`                      | `screens/help_center_screen.dart`        | static                                                        |
| `/privacy`                   | `screens/privacy_screen.dart`            | static                                                        |
| `/unsubscribe`               | `screens/unsubscribe_screen.dart`        | `email_unsubscribe_tokens`                                    |

### Messaging & social

| Web route                | Flutter screen                       | Backend                                              |
| ------------------------ | ------------------------------------ | ---------------------------------------------------- |
| `/messages`              | `screens/messages_screen.dart`       | `conversations` + realtime `messages`                |
| `/messages/:id`          | `screens/thread_screen.dart`         | `messages` realtime                                  |
| `/u/:handle`             | `screens/user_profile_screen.dart`   | `profiles`, `user_follows`, `job_posts`              |
| `/group-buy/:id`         | `screens/group_buy_screen.dart`      | `group_buys`, `group_buy_members`                    |
| `/live`                  | `screens/live_screen.dart`           | `live_streams`, `live_messages`, `live_reactions`    |

### Store / seller side

| Web route                | Flutter screen                          | Backend                                                        |
| ------------------------ | --------------------------------------- | -------------------------------------------------------------- |
| `/my-store`              | `screens/my_store_screen.dart`          | `suppliers`, `products`, `orders`                              |
| `/my-store/*` sections   | `screens/store_section_screen.dart`     | routes based on `section` param                                |
| `/my-store/analytics`    | `screens/store_analytics_screen.dart`   | `orders`, `products`                                           |
| `/become-supplier`       | `screens/become_supplier_screen.dart`   | `suppliers`                                                    |
| `/ads/dashboard`         | `screens/ads_dashboard_screen.dart`     | `ad_campaigns`, `ad_campaign_stats`                            |
| `/ads/new`               | `screens/ad_wizard_screen.dart`         | `ad_campaigns`                                                 |
| `/admin`                 | `screens/admin_screen.dart`             | `manual_topups`, `withdrawal_requests`, `platform_settings`    |
| `/supplier/:id`          | `screens/supplier_screen.dart`          | `suppliers`, `products`                                        |

### Marketplace verticals (config-driven)

Every vertical uses `screens/vertical_screen.dart` + an entry in
`screens/verticals_config.dart` (mirrors the RN `verticals.tsx`):

| Route          | Table                    |
| -------------- | ------------------------ |
| `/restaurants` | `restaurants`            |
| `/stays`       | `stays`                  |
| `/properties`  | `properties`             |
| `/auto`        | `vehicles`               |
| `/car-rentals` | `car_rentals`            |
| `/jobs`        | `job_postings`           |
| `/jobs/feed`   | `job_posts`              |
| `/jobs/network`| `job_connections`        |
| `/jobs/profile`| `job_seeker_profiles`    |
| `/services`    | `service_providers`      |
| `/agro`        | `agro_listings`          |
| `/industrial`  | `industrial_listings`    |
| `/finance`     | `finance_products`       |
| `/news`        | `news_articles`          |
| `/logistics`   | `logistics_requests`     |
| `/driver`      | `logistics_requests`     |
| `/rfq`         | `rfqs`                   |
| `/rides`       | `rides` (+ `google_maps_flutter`) |

## Shared infrastructure (`lib/services/`)

- `supabase_client.dart` — configured `SupabaseClient` (auth persists via
  `flutter_secure_storage` on device).
- `env.dart` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, project id (pulled from
  `--dart-define` so we never commit keys).
- `catalog_service.dart` — products / categories fetchers with pagination
  identical to `src/hooks/useInfiniteProducts.ts`.
- `list_service.dart` — generic `PagedListNotifier<T>` used by every vertical.
- `auth_service.dart` — sign-in, sign-up, WhatsApp code link, session
  restoration.
- `wallet_service.dart` — balance, top-ups, transactions.
- `push_service.dart` — FCM/APNs registration + token upsert into
  `push_subscriptions`.
- `location_service.dart` — `geolocator` permission + fetch helper.
- `realtime.dart` — thin wrapper over `supabase.channel(...)` for chat, rides,
  notifications, live streams.

## Design system (`lib/theme/`)

Everything mirrors `src/index.css` and `tailwind.config.ts`:

- `palette.dart` — semantic tokens (background, foreground, primary, accent,
  muted, mutedSurface, border, ridesMint, ridesCta, danger, warning).
- `typography.dart` — Sora (display), Manrope (body), JetBrainsMono. Wired via
  `google_fonts`.
- `radii.dart` + `spacing.dart` — same scale as Tailwind (`sm=8`, `md=12`,
  `lg=16`, `xl=24`, `pill=999`; 4px spacing unit).
- `theme.dart` — Material 3 `ThemeData` + `CupertinoThemeData`, with a shared
  `AppTheme` extension exposing `AppTheme.of(context).colors.primary` etc.

## Shared widgets (`lib/widgets/`)

Named to match the web + RN components so anyone jumping between clients
recognizes them instantly:

- `product_card.dart` — the staggered marketplace card (large red price,
  metadata chips, add-to-cart button).
- `listing_card.dart` — used by every vertical.
- `menu_preview_row.dart` — the round "story-style" menu items on restaurant
  cards.
- `masonry_grid.dart` — 2 cols mobile / 3 tablet / 4 desktop / 5 wide, JS-style
  column distribution using `SliverMasonryGrid` from `flutter_staggered_grid_view`.
- `filter_bar.dart`, `sort_pills.dart`, `subcategory_chips.dart` — mirror
  `src/components/marketplace/FilterBar.tsx`.
- `back_button.dart` — same behavior as the web `BackButton` (pop or fall
  back to home).
- `states.dart` — `LoadingState`, `EmptyState`, `ErrorState` widgets.
- `screen_container.dart` — safe-area + max-width wrapper used across screens.

## Build order (the roadmap)

We're building this iteratively — same order the web app grew. Each step
lands running, testable code before we move on.

1. **Bootstrap** — `pubspec.yaml`, theme, Supabase client, root shell with
   the 5 bottom tabs (Home, Categories, Explore, Messages, Profile).
2. **Auth** — splash → onboarding → auth (email + Google), session persistence.
3. **Home + Categories** — masonry grid, infinite scroll, category filter,
   subcategory chips, "For you" / "Following" tabs.
4. **Product detail + Cart + Wishlist + Orders** — full commerce loop.
5. **Verticals** — restaurants, stays, properties, auto, car rentals, jobs,
   services, agro, industrial, finance, news, logistics, rfq.
6. **Messaging + notifications + live** — realtime channels.
7. **Wallet + payments** — Pesepay, PayPal, manual EcoCash top-ups.
8. **Store side + admin dashboard** — supplier flows, ads, admin panel.
9. **Rides** — `google_maps_flutter`, realtime driver locations, pool.
10. **Polish** — animations, haptics, deep links, share intents.

## Native-only features enabled

- **Realtime** — Supabase channels (`postgres_changes`, `broadcast`,
  `presence`).
- **Push** — `firebase_messaging` (FCM/APNs), tokens saved to
  `push_subscriptions`.
- **Maps + location** — `google_maps_flutter`, `geolocator`.
- **Image caching** — `cached_network_image`.
- **Secure session** — `flutter_secure_storage` for the Supabase session +
  wallet PIN.
- **Deep links** — `app_links` for `pubstore.app/...` URLs.

## Handing changes back to the web project

Because this Flutter app is a client of the same backend, schema changes go
in `supabase/migrations/` as usual — this folder just consumes them. Keep the
per-vertical mapping tables above in sync when a new vertical or route ships.
