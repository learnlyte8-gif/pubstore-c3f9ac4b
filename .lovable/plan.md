
# PUBSTORE — Complete Build Blueprint

A super-app for an emerging market: marketplace + 13 vertical services (food, rides, jobs, services, property, delivery, finance, news, stays, auto, industrial, agro, restaurants) glued together by chat, wallet, loyalty, ads, and a buyer/supplier identity. Mobile-first PWA + Capacitor wrapper, plus a thin React Native shell that mirrors the same backend.

---

## 1. Tech Foundation

- **Frontend**: React 18 + Vite 5 + TypeScript 5, TailwindCSS v3, shadcn/ui, React Router v6, TanStack Query, framer-motion, lucide-react icons.
- **Backend (Lovable Cloud / Supabase)**: Postgres + RLS, Auth (email/password + Google), Storage (product/avatar/chat media), Edge Functions (payments, AI, push, ads), Realtime (chat, rides, live).
- **Native shell**: Capacitor (Android AAB script in `scripts/build-android-aab.sh`), plus parallel React Native app under `react-native/` mirroring screens.
- **Payments**: PayPal (`paypal-*` functions) + Pesepay (`pesepay-*`) routed via 4 branded tiles (EcoCash, OneMoney, Visa, Mastercard).
- **AI**: `tapson-chat` assistant, `generate-ad`, `image-search`, `import-product`/`import-list` via Lovable AI Gateway.
- **Push**: `send-push` edge function + service worker (`public/sw.js`).

---

## 2. Design System

### 2.1 Color tokens (HSL, defined in `src/index.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `0 0% 100%` | `0 0% 0%` | App canvas |
| `--foreground` | `0 0% 0%` | `0 0% 100%` | Primary text |
| `--card` | `0 0% 100%` | `0 0% 6%` | Surfaces |
| `--primary` | `213 89% 52%` | `213 89% 56%` | CTA (IG blue) |
| `--muted` | `0 0% 96%` | `0 0% 10%` | Secondary surface |
| `--muted-foreground` | `0 0% 45%` | `0 0% 64%` | Captions |
| `--border` | `0 0% 86%` | `0 0% 16%` | Hairlines |
| `--destructive` | `0 100% 60%` | same | Errors / delete |
| `--ring` | `213 89% 52%` | `213 89% 56%` | Focus ring |
| `--radius` | `0.5rem` | — | Base radius |

**Brand gradient stops** (`--ig-yellow → orange → pink → purple → blue`) drive `--gradient-ig` (45°), `--gradient-ig-soft` (135°) and `--gradient-story` (conic) — used on stories, the splash mark, the live badge, and supplier rings.

**Vertical accent gradients** (in `DepartmentsBar.tsx`):
- Market `from-primary to-primary/70`
- Food `from-rose-600 via-orange-500 to-amber-400`
- Jobs `from-blue-700 to-indigo-500`
- Rides `from-emerald-500 to-teal-400`
- Services `from-violet-600 to-fuchsia-500`
- Property `from-sky-700 to-blue-500`
- Delivery `from-orange-600 to-rose-500`
- Finance `from-emerald-700 to-cyan-600`
- News `from-rose-500 to-orange-400`
- Stays `from-amber-500 to-yellow-300`
- Auto `from-zinc-900 to-zinc-600`
- Industrial `from-sky-700 to-sky-400`
- Agro `from-emerald-700 to-lime-500`

### 2.2 Typography

System font stack (SF Pro / Segoe UI / Roboto). Bold-first: body weight **700**, headings **900**, prices `font-variant-numeric: tabular-nums` and weight **900**. Letter-spacing `-0.014em` body, `-0.03em` H1. Inputs forced to ≥16px on mobile to block iOS zoom.

### 2.3 Shadows & motion

- `--shadow-soft` (1px), `--shadow-card` (4–16px), `--shadow-elevated` (10–30px), `--shadow-pop` (blue-tinted, hero CTAs), `--shadow-inset` (chips).
- Tap feedback: `transform: scale(0.96); opacity:0.85` on `:active` for buttons/links (coarse pointers only).
- Animations in `tailwind.config.ts`: `fade-in`, `marquee`, `float-up` (like reactions), `shimmer` (skeleton hero), accordion up/down.

### 2.4 Iconography

`lucide-react` everywhere, stroke `2.4`, sized 18–24px. Brand pictograms (Visa, Mastercard, EcoCash, OneMoney, PayPal) are inline SVG in `BrandMark` inside `Wallet.tsx`. Department tiles are 48×48 rounded-2xl gradient chips with white icon and a small dot indicator when the route is active.

---

## 3. App Shell & Navigation

### 3.1 Shell (`src/components/AppShell.tsx`)

- Top: safe-area-aware sticky header on most pages (logo left, search/cart/wallet right; route-specific).
- Body: scrollable `<main>` (overscroll locked, `pan-y` only).
- Bottom tab bar (mobile): **Home / Categories / Explore / Messages / Profile** (mirrored 1:1 in `react-native/src/navigation/RootTabs.tsx`).
- Floating elements: `InstallPrompt` (PWA A2HS), `LiveActivityToaster` (realtime price drops/order updates), `NativeSuggestionToaster`, `TapsonAssistant` FAB (bottom-right above tab bar, IG-gradient ring + sparkles icon).
- Status-bar color synced via `useStatusBarSync` hook to match the current section gradient.

### 3.2 Routes (single source of truth: `src/App.tsx`)

Public: `/` Splash → decides destination, `/auth`, `/onboarding`.

Authenticated (wrapped in shell):
- Core: `/home`, `/search`, `/categories`, `/wishlist`, `/cart`, `/orders`, `/messages`, `/notifications`, `/compare`, `/rfq`.
- Product/seller: `/product/:id`, `/supplier/:id`, `/u/:userId`, `/group-buy/:id`.
- Live: `/live`, `/live/:id`.
- Account: `/account` (alias `/profile`), `/addresses`, `/payment-methods`, `/settings`, `/settings/notifications`, `/wallet`, `/verification`, `/privacy`, `/help`, `/become-supplier`.
- My Store: `/store`, `/store/actions`, `/store/analytics`, `/store/ads`, `/store/ads/new`, `/store/:section`, `/store/:section/:sub`.
- Verticals: `/restaurants[/:id]`, `/stays[/:id]`, `/auto[/:id]`, `/industrial[/:id]`, `/agro[/:id]`, `/properties`, `/services`, `/logistics`, `/finance`, `/jobs[/:id]`, `/jobs/feed|network|me|people/:userId`, `/car-rentals[/:id]`, `/news[/:slug]`, `/rides[/:id]`, `/driver`.
- Payments: `/pay/:kind/:id`.
- Fallback: `*` → `NotFound`.

---

## 4. Screens in detail

### 4.1 Splash `/` (`src/pages/Splash.tsx`)
- Full-screen white/black. Logo 96×96 centred + brand word `PUBSTORE` (tracking `0.18em`). Footer: small "from PUBSTORE Inc.".
- 1.6s timer → reads session/profile → routes to `/home`, `/onboarding`, or `/auth`. 280ms fade-out.

### 4.2 Onboarding `/onboarding`
Stepper sheet: pick country/city (LocationPicker), interests (multi-chip from `data/interests.ts`), preferred language. Bottom sticky primary CTA. Guest mode stored via `lib/guest.ts`. Completion marks `profile_completed = true`.

### 4.3 Auth `/auth`
- Two-tab segmented control: Sign in / Sign up.
- Email + password + Google OAuth button (white card, Google "G" mark, IG-blue ring on focus).
- Error inline, success toast, then `/home`.

### 4.4 Home `/home` (`src/pages/Home.tsx`)
Vertical stack:
1. **Header bar** — logo, search shortcut chip, wallet pill (balance), bell.
2. **`DepartmentsBar`** — horizontally scrollable 48px gradient tiles (13 verticals); active tile scales 1.04 and shows a dot.
3. **Stories rail** — conic-gradient ring around suppliers' avatars.
4. **`BannerAdSlot`** — full-bleed rounded-3xl ad with `SponsoredBadge`, falls back to trending product.
5. **For-you feed** — masonry-ish product cards (image, title, price, save heart, supplier handle). Every 6th item: `InlineAdCard`.
6. **AdReel strip** — 15s vertical video tiles, can earn loyalty via `RewardedAdSheet`.
7. **`InterstitialAdManager`** — overlays after 3 navigations, skippable at 3s.
8. **Bottom tab bar** + Tapson FAB.

### 4.5 Categories `/categories`
- IG-style 3-column grid of category tiles (gradient header, lucide icon). Tap → filtered Search.
- Top sticky chips: All / Trending / Near me / New.

### 4.6 Search `/search`
- Pill input with mic + camera (image search via `image-search` function).
- Suggestions, recent, trending, `RotatingHint` placeholder.
- Result grid identical to Home; filter sheet (price, rating, distance, supplier tier, free shipping).

### 4.7 Product detail `/product/:id` (`src/pages/ProductDetail.tsx`)
- Hero carousel (1:1 swipe, dots).
- Title, price block (bold-900 + tabular nums), rating, supplier row with tier badge and follow button.
- **Action row with translucent background** (recent change): Save, Share, Compare, Group buy, Message — chips with backdrop-blur.
- Tabs: Details / Specs / Reviews / Q&A.
- Sticky bottom bar: `Add to cart` (secondary) + `Buy now` (primary blue, pop shadow).
- "Sponsored similar" inline ad slot below reviews.

### 4.8 Cart `/cart`
- Grouped by supplier. Quantity steppers, save-for-later, coupon field, totals (subtotal, fees, loyalty discount).
- "Checkout" → `/pay/order/:id`.

### 4.9 Orders `/orders`
- Tabs: Active / Shipped / Delivered / Cancelled / Returns. Each card: thumbnail, status pill (color-coded), tracking link to `/logistics`.

### 4.10 Wishlist `/wishlist`
2-col grid of saved items; long-press to add to cart or move to list.

### 4.11 Messages `/messages` & `Thread` `/u/:userId`-derived
- Chat list (avatar, last message, unread dot in primary, time).
- Thread: media bubbles, product/attachment cards (`AttachmentCard`), `ShareToChatSheet`. Realtime via Supabase.

### 4.12 Notifications `/notifications`
- Grouped Today / This week. Each row: icon, title, body, action button. Filter chips.

### 4.13 Compare `/compare`
- Up to 4 products side-by-side table (sticky first column).

### 4.14 Live `/live` and `/live/:id`
- Reels-style vertical stream player. Heart float (`float-up` animation), live badge (gradient + pulse), chat overlay, "Shop now" sheet.

### 4.15 Supplier `/supplier/:id`
- Hero banner with gradient overlay, avatar with story ring, follow button, tier badge, location pin.
- Tabs: Shop / Reviews / About / Live.

### 4.16 User profile `/u/:userId` and `Account` `/account`
- Avatar 96×96, handle, bio, stats (orders, followers, following).
- Action grid: Wishlist, Orders, Wallet, Become supplier, Help, Settings.
- Toggle theme.

### 4.17 My Store `/store` + sections
- Dashboard cards: revenue, orders, views, conversion.
- Grid of section tiles (`StoreSection`): Products, Inventory, Orders, Promotions, Customers, Analytics, Ads, Payouts, Settings.
- `StoreActions` quick CRUD; `AddAdDialog` modal for quick boost.
- **Ads** subsystem (`AdsDashboard`, `AdCampaignWizard`): 4-step wizard (product → placement → creative → budget).

### 4.18 Wallet `/wallet` (`src/pages/Wallet.tsx`)
- Balance card (gradient), Send/Receive/Withdraw buttons.
- **Top-up provider tiles** (5-column grid, recent change): EcoCash (red roundel), OneMoney (yellow), Visa (blue + gold), Mastercard (red/yellow), PayPal (PP blue). All 4 Pesepay options route through Pesepay checkout; PayPal uses PayPal.
- "Enter amount" input (no presets — recent change), checkout CTA.
- Transaction history list, filter chips.
- `LoyaltyCard`: points balance + redeem.

### 4.19 Addresses / Payment methods / Verification / Privacy / Help / Settings
- Plain stacked list pages with shadcn `Card` rows, edit sheets, destructive confirm dialogs.

### 4.20 RFQ `/rfq`
- Form: title, category, qty, target price, delivery date, attachments. Submitted RFQs become threads under Messages.

### 4.21 Verticals

Each vertical follows a common shape: hero filter bar, listing grid/list, detail page with booking/CTA. Specifics:

- **Restaurants** `/restaurants`: cuisine chips, restaurant cards (rating, ETA, delivery fee), menu detail with item modal, basket → `/cart` with `kind=food`.
- **Stays** `/stays`: date-range picker, guests, location; cards with image carousel; detail with amenities grid, host card, booking sheet → `/pay/stay/:id`.
- **Auto** `/auto`: make/model/year/price filters; detail with spec table, dealer chat, finance calc.
- **Car rentals** `/car-rentals`: pickup/return date picker, vehicle class tabs, daily rate prominent.
- **Industrial** `/industrial`: MOQ, supplier tier, certifications; RFQ shortcut.
- **Agro** `/agro`: seasonal sections, bulk pricing, farm-gate badge.
- **Properties** `/properties`: rent/buy/lease tabs, map toggle, price-per-m².
- **Jobs** `/jobs`: feed `/jobs/feed`, network `/jobs/network`, profile `/jobs/me`, detail with apply CTA → chat with hirer.
- **Services** `/services`: provider cards, hourly/fixed rates, booking sheet.
- **Logistics** `/logistics`: send-a-parcel quote form, current shipments tracker, request/accept flow that lets users actually exchange requests until delivery completes (recent change).
- **Finance** `/finance`: loans, insurance, savings tiles → embedded form.
- **News** `/news` and `/news/:slug`: editorial column layout, share & save.
- **Live** & **Rides** covered above; **Driver** `/driver`: driver dashboard, accept rides, earnings.

### 4.22 Pay `/pay/:kind/:id`
- Order summary card → 5 brand tiles → on-confirm, calls relevant edge function (`paypal-create-order` / `pesepay-create-payment`) and redirects to checkout URL; result handled by `pesepay-result` / `paypal-capture-order` and reflected via wallet RPC `apply_wallet_transaction`.

---

## 5. Data Layer

### 5.1 Hooks
- `useWallet`, `useLoyalty`, `useAds`, `useRides`, `useSocial`, `useFollowing`, `useSaves`, `useVehicleSaves`, `useGroupBuy`, `useCatalog`, `useUniversalSearch`, `useChatNotifications`, `useUnreadChats`, `useUserLocation`, `useUserTier`, `useVerification`, `useTradeMode`, `useScrollDirection`, `useRequireAuth`, `useStatusBarSync`, `usePersonalizationLog`, `useUrlFilters`, `useInterests`, `useSharedTrips`.

### 5.2 Stores (Zustand)
- `store/shop.tsx`, `store/useShop.ts` — cart & catalog.
- `store/importJob.tsx` — bulk import progress.

### 5.3 Tables (Supabase, all with explicit GRANTs + RLS)
profiles, suppliers, products, product_media, categories, addresses, orders, order_items, carts, wishlists, reviews, follows, conversations, messages, attachments, notifications, rides, ride_messages, ride_ratings, pool_trips, jobs, applications, services, properties, listings (auto/industrial/agro/stays/restaurants), live_streams, ad_campaigns, ad_campaign_stats, ad_events, loyalty_points, loyalty_ledger, wallets, wallet_ledger, coupons, user_roles + `has_role()` security-definer.

### 5.4 Edge functions
- Payments: `paypal-create-order`, `paypal-capture-order`, `paypal-public-config`, `pesepay-create-payment`, `pesepay-status`, `pesepay-result`.
- AI: `tapson-chat`, `generate-ad`, `image-search`, `import-product`, `import-list`.
- Comms: `send-push`.
- Ads (per plan): `ads-serve`, `ads-track`, `ads-reward`, `ads-daily-cron`.

---

## 6. UX patterns (cross-cutting)

- **Skeletons** with shimmer on every list/detail.
- **Optimistic UI** for likes, follows, cart adds, wishlist.
- **Confirm sheets** (shadcn Drawer) for destructive actions on mobile, AlertDialog on desktop.
- **Empty states** via `EmptyState` (illustration + verb-led CTA).
- **Pull-to-refresh** on feed pages.
- **A11y**: focus rings on `--ring`, semantic headings (one H1 per page), alt text on images, prefers-reduced-motion respected.
- **SEO**: per-route title <60c, meta description <160c, JSON-LD on product and listing pages, canonical tags, responsive viewport.

---

## 7. PWA / Native

- `public/manifest.webmanifest`, `public/sw.js` for offline shell, install prompt component.
- Capacitor build via `scripts/build-android-aab.sh`.
- React Native shell mirrors palette/fonts in `react-native/src/config/theme.ts` (Cloud-White / Sora+Manrope variant) and reuses the same Supabase backend.

---

## 8. Out of scope for v1

External ad networks, real video generation, Stripe billing for ads, deep A/B testing — wallet + Pesepay/PayPal only, basic stats only.

---

This is the canonical blueprint — `.lovable/plan.md` should be updated to mirror it once approved.
