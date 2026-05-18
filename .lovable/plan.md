## Goal
Remove every reference to `src/data/*` mock files across the app, replace with live Supabase queries to the existing tables, and show a friendly empty state when there is no data. No DB seeding — production-ready shells.

## Scope (full sweep)
~50 files import from `@/data/*`. Every vertical already has a real table, so each rail/page can be wired to Supabase 1:1.

## Approach

### 1. Create reusable primitives (new)
- `src/components/common/EmptyState.tsx` — icon + title + subtitle + optional CTA. Used everywhere a list/rail is empty.
- `src/hooks/useSupabaseList.ts` — small wrapper that returns `{ data, loading, error }` for a table query, so rails don't each reimplement loading.

### 2. Home rails — convert from static arrays to live queries
For each rail under `src/components/marketplace/`, replace mock import with a Supabase query, render skeletons while loading, render `EmptyState` (or hide) when empty:
- `FlashDeals`, `NewArrivals`, `DealOfTheDay` → `products` (filters: discount, created_at, featured)
- `TopSuppliers` → `suppliers` order by rating
- `CategoryStrip` → `categories`
- `JobsRail` → `job_postings`
- `PropertiesRail` → `properties`
- `StaysRail` → `stays`
- `CarRentalsRail` → `car_rentals`
- `AutoRail` → `vehicles`
- `FinanceRail` → `finance_products`
- `NewsRail` → `news_articles`
- `ServicesRail` → `service_providers`
- `IndustrialRail` → `industrial_listings`
- `AgroRail` → `agro_listings`
- `PromoTile` → keep as static marketing (no mock data dependency) or hide if it references mock
- `VerticalFeed` → live feed from `live_streams`

### 3. Vertical pages — convert each list page
- `Jobs.tsx`, `JobsFeed.tsx`, `JobsNetwork.tsx`, `JobsProfile.tsx` → `job_postings`, `job_posts`, `job_connections`, `job_seeker_profiles`
- `Properties.tsx` → `properties`
- `Stays.tsx` → `stays`
- `CarRentals.tsx` → `car_rentals`
- `Auto.tsx` → `vehicles`
- `Finance.tsx` → `finance_products` / `finance_applications`
- `News.tsx` → `news_articles`
- `Services.tsx` → `service_providers` / `service_requests`
- `Logistics.tsx` → `logistics_requests` / `logistics_bids`
- `Industrial.tsx` → `industrial_listings`
- `Agro.tsx` → `agro_listings`
- `Live.tsx` → `live_streams`
- `Messages.tsx` → already partially live; remove any remaining mock fallbacks
- `ProductDetail.tsx`, `Wishlist.tsx`, `Compare.tsx`, `MyStore.tsx`, `StoreSection.tsx` → use existing `products` queries via shop store

### 4. Core store + hooks
- `src/store/shop.tsx`, `src/store/importJob.tsx`, `src/hooks/useCatalog.ts`, `src/hooks/useFollowing.ts` → drop mock imports, fetch from Supabase only. Keep cart/wishlist/follow mutations as-is (they already write to DB).
- `src/lib/subcategories.ts` → if it only enumerates categories from mock data, replace with categories table.
- `src/components/RotatingHint.tsx`, `SupplierOnboarding.tsx`, `TapsonAssistant.tsx`, `ProductCard.tsx`, `SupplierCard.tsx`, `VehicleInquiryDialog.tsx`, `StayBookingDialog.tsx` → strip any `import … from "@/data/…"`. If they only used a type, move the type into `src/types/` instead.

### 5. Types
Extract the TypeScript interfaces currently exported from `src/data/products.ts` etc. into `src/types/marketplace.ts` so components keep their type safety after we delete the data files.

### 6. Delete mock files (last step, after nothing imports them)
- `src/data/products.ts`
- `src/data/jobs.ts`
- `src/data/verticals.ts`
- `src/data/newVerticals.ts`
- `src/data/interests.ts`

### 7. Auth gating
Protected pages (Cart, Orders, Messages, Wishlist, Account, MyStore, Wallet, NotificationPreferences, Verification) — if not logged in, `navigate('/auth')`. Most already do; verify and add where missing.

## Technical details
- Queries use `supabase.from('table').select('...').limit(N)` with appropriate filters. Rails: limit 8–12.
- All queries wrapped in try/catch; on error log + show empty state.
- Loading state = 3–4 skeleton cards using existing skeleton patterns.
- Empty state copy is contextual ("No properties listed yet — be the first to list one.") with a CTA where it makes sense ("List a property", "Post a job", etc.).
- RLS already in place on all tables; public read where appropriate.
- No business-logic changes to checkout, payments, auth, or chat.

## Out of scope
- Building "create listing" forms that don't already exist
- Modifying RLS policies
- Seeding any starter content
- Visual redesigns

## Deliverable
After this passes:
- `rg "from ['\"]@/data/" src/` returns zero matches
- `src/data/` directory is deleted
- Every page either shows real DB data, a skeleton while loading, or a friendly empty state
- App is safe to ship to production users

This is a large change touching ~50 files. Reply "go" to proceed, or tell me to narrow the scope (e.g. "core commerce first, verticals later").