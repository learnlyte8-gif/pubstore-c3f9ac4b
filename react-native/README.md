# PUBSTORE — React Native (fully native)

Fully native Android/iOS app that mirrors the PUBSTORE web product. Every
screen reads and writes directly against the same Lovable Cloud (Supabase)
backend that powers the web app — no WebView, no shared web bundle.

## One-time setup on your machine (Android Studio)

The Lovable sandbox has no React Native CLI / Android SDK, so the native
`android/` and `ios/` folders are generated locally on your machine the first
time:

```bash
# 1. Copy this folder out of the web repo
cp -R react-native ~/pubstore-rn
cd ~/pubstore-rn

# 2. Generate the native shells without overwriting our JS/TS code
npx @react-native-community/cli@latest init pubstore \
  --version 0.75.4 --skip-install --directory .tmp-rn
cp -R .tmp-rn/android .tmp-rn/ios .tmp-rn/.eslintrc.js .tmp-rn/.prettierrc.js \
      .tmp-rn/.watchmanconfig .tmp-rn/metro.config.js .tmp-rn/jest.config.js .
rm -rf .tmp-rn

# 3. Install JS deps + iOS pods
npm install
cd ios && pod install && cd ..

# 4. Maps: add your Google Maps key
#    Android: paste into android/app/src/main/AndroidManifest.xml inside <application>:
#      <meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>
#    iOS: AppDelegate.mm → [GMSServices provideAPIKey:@"YOUR_KEY"];

# 5. Open in Android Studio:  File → Open → ~/pubstore-rn/android
#    Or run directly:
npx react-native run-android
```

> The init step creates the Gradle wrapper, `MainActivity`, `Info.plist`, etc.
> After it finishes, our `App.tsx` / `index.js` / `src/` win because they
> were already in place.

## Configuring the app id / version

Match the web project's release identity. After `init`, edit:

- `android/app/build.gradle` → `applicationId "app.lovable.14b25a14b8c040f29b8231f038ad2828"`,
  `versionCode 11`, `versionName "11.0"`
- `ios/pubstore/Info.plist` → `CFBundleIdentifier`,
  `CFBundleShortVersionString = 11.0`, `CFBundleVersion = 11`

## Building a release AAB

```bash
cd android
./gradlew bundleRelease
# AAB:  android/app/build/outputs/bundle/release/app-release.aab
```

Sign with the same keystore you already use for the Capacitor build
(`scripts/build-android-aab.sh` documents the env vars).

## Screen architecture

Every screen is implemented in React Native and reads from the same Supabase
tables as the web app.

| Tab / route       | File                                | Backend table(s)                       |
| ----------------- | ----------------------------------- | -------------------------------------- |
| Home              | `screens/HomeScreen.tsx`            | `products`, `categories`               |
| Categories        | `screens/CategoriesScreen.tsx`      | `categories`                           |
| Explore (hub)     | `screens/MoreScreen.tsx`            | navigation only                        |
| Messages list     | `screens/MessagesScreen.tsx`        | `conversations` + realtime `messages`  |
| Message thread    | `screens/ThreadScreen.tsx`          | `messages` (realtime channel)          |
| Profile           | `screens/ProfileScreen.tsx`         | `profiles`, `auth.users`               |
| Product detail    | `screens/ProductDetailScreen.tsx`   | `products`, `wishlist_items`, `cart_items` |
| Cart + checkout   | `screens/CartScreen.tsx`            | `cart_items`, `orders`, `order_items`  |
| Wishlist          | `screens/WishlistScreen.tsx`        | `wishlist_items` join `products`       |
| Search            | `screens/SearchScreen.tsx`          | `products` ilike                       |
| Orders            | `screens/OrdersScreen.tsx`          | `orders`                               |
| Wallet            | `screens/WalletScreen.tsx`          | `wallets`, `wallet_transactions`       |
| Notifications     | `screens/NotificationsScreen.tsx`   | `notifications` (realtime)             |
| Addresses         | `screens/AddressesScreen.tsx`       | `addresses`                            |
| Payment methods   | `screens/PaymentMethodsScreen.tsx`  | `payment_methods`                      |
| Account / profile | `screens/AccountScreen.tsx`         | `profiles`                             |
| Settings          | `screens/SettingsScreen.tsx`        | `notification_preferences`             |
| Verification      | `screens/VerificationScreen.tsx`    | `user_verifications`                   |
| My store          | `screens/MyStoreScreen.tsx`         | `suppliers`, `products`, `orders`      |
| Help center       | `screens/HelpCenterScreen.tsx`      | static                                 |
| Privacy           | `screens/PrivacyScreen.tsx`         | static                                 |
| Rides             | `screens/RidesScreen.tsx`           | `rides` (realtime) + `react-native-maps` |
| Auth + Onboarding | `screens/AuthScreen.tsx`, `OnboardingScreen.tsx`, `SplashScreen.tsx` | `auth` |

### Marketplace verticals (config-driven)

Every vertical reuses the `VerticalScreen` component with its own Supabase
query and row mapper:

| Route        | Table                  |
| ------------ | ---------------------- |
| Restaurants  | `restaurants`          |
| Stays        | `stays`                |
| Properties   | `properties`           |
| Auto         | `vehicles`             |
| CarRentals   | `car_rentals`          |
| Jobs         | `job_postings`         |
| Services     | `service_providers`    |
| Agro         | `agro_listings`        |
| Industrial   | `industrial_listings`  |
| Finance      | `finance_products`     |
| News         | `news_articles`        |
| Live         | `live_streams`         |
| Logistics    | `logistics_requests`   |
| Driver       | `logistics_requests`   |
| RFQ          | `rfqs`                 |

Add a new vertical: drop another entry in `screens/verticals.tsx` and register
it in `navigation/RootNavigator.tsx` + `screens/MoreScreen.tsx`.

## Shared infrastructure

- `services/supabase.ts` — Supabase client with `AsyncStorage` session.
- `services/useSupabaseList.ts` — generic list hook used by all verticals.
- `services/push.ts` — FCM/APNs registration helper.
- `services/location.ts` — geolocation + permission helper.
- `components/ProductCard.tsx`, `ListingCard.tsx`, `ScreenContainer.tsx`,
  `States.tsx` — shared UI primitives.
- `config/theme.ts` — design tokens mirroring the web `index.css`.

## Native-only features

- **Realtime chat & notifications** — `supabase.channel(...).on('postgres_changes', ...)`.
- **Push notifications** — `@react-native-firebase/messaging`.
- **Location + maps** — `@react-native-community/geolocation`, `react-native-maps`.
- **Image cache** — `react-native-fast-image`.
- **Session persistence** — `@react-native-async-storage/async-storage`.
