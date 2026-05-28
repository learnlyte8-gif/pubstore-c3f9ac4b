# Restaurants vertical + universal media uploads

## 1. Database (one migration)

New tables in `public`:

- **`restaurants`** — `id, supplier_id, owner_user_id, name, slug, cuisine, description, cover, gallery text[], video_url, city, country, address, lat, lng, phone, whatsapp, hours jsonb, price_level int (1-4), rating, review_count, delivery_enabled bool, reservation_enabled bool, min_order numeric, delivery_fee numeric, prep_time_minutes int, active bool, featured bool, created_at, updated_at`
- **`menu_categories`** — `id, restaurant_id, name, sort_order`
- **`menu_items`** — `id, restaurant_id, category_id, name, description, price, currency, image, gallery text[], video_url, tags text[], spicy bool, vegetarian bool, available bool, sort_order`
- **`food_orders`** — `id, buyer_id, restaurant_id, items jsonb, subtotal, delivery_fee, total, currency, status (pending/accepted/preparing/out_for_delivery/delivered/cancelled), delivery_address, lat, lng, contact_phone, notes, ref_code, paid bool, paid_at, payment_tx_id, created_at, updated_at`
- **`table_reservations`** — `id, guest_id, restaurant_id, party_size, reserved_for timestamptz, contact_name, contact_phone, notes, status (pending/confirmed/declined/cancelled/completed), created_at, updated_at`

All with: `GRANT`s (anon read on public-listing tables; authenticated full on user-owned rows; service_role all), RLS enabled, policies (public read for active restaurants/menus, owner writes via `supplier_id` lookup, buyers read own orders/reservations, restaurant owner reads incoming orders/reservations and can update status).

Add: triggers for `updated_at`, notification triggers mirroring existing `notify_new_stay_booking` / `notify_stay_booking_status` patterns for both `food_orders` and `table_reservations`, plus extend `pay_service_action_with_wallet` to accept `_kind = 'food-order'`.

Storage bucket: `restaurant-media` (public).

## 2. Universal media uploader

New component **`src/components/MediaUpload.tsx`**:
- Accepts `images: string[]`, `video: string | null`, `onChange({images, video})`, `maxImages = 6`, `bucket`, `folder`.
- Drag-to-reorder thumbnails, remove button, "add more" tile (disabled at limit).
- One video slot: 60 MB cap, mp4/webm/quicktime, shows `<video>` preview with replace/remove.
- Reuses Supabase storage upload pattern from `uploadProductImages.ts`.

Wire into every create/edit form that currently has a single cover/image input:
- `PostTaskForm` (Services)
- `BecomeSupplier` / `SupplierOnboarding`
- `MyStore` product editor (already multi-image, just add video slot)
- `StoreActions` editors for: stays, vehicles, car-rentals, properties, finance, industrial, agro, jobs
- New Restaurants editor

Add `video_url text` column to every listing table that doesn't have one (stays, vehicles, car_rentals, properties, finance_products, industrial_listings, agro_listings, service_providers, service_requests, job_postings, products if missing).

## 3. Restaurants UI

- **`src/pages/Restaurants.tsx`** — list with cuisine/city filters, cards (cover, rating, price level, delivery badge).
- **`src/pages/RestaurantDetail.tsx`** — hero gallery + video, info, tabs: Menu / Reserve / Reviews. Menu grouped by category, "Add to cart" per item.
- **`src/components/restaurants/MenuItemCard.tsx`**, **`FoodCartSheet.tsx`** (slide-up cart, checkout → creates `food_orders` row → wallet pay link), **`ReservationDialog.tsx`** (date, time, party size).
- **`src/pages/StoreSection.tsx`** add "Restaurants" management section: list owner's restaurants, edit, add menu items, view incoming orders + reservations with accept/decline.
- Add route entries in `src/App.tsx`; add Restaurants tile to `CategoryGrid` / `DepartmentsBar` on Home.

## 4. Data layer

New `src/data/restaurants.ts` with `fetchRestaurants`, `fetchRestaurant`, `fetchMenu`, `createFoodOrder`, `createReservation`, owner-side fetchers.

## 5. Technical details

- Reuse existing `inquiryGate` / wallet payment flow for food order checkout (`/pay/food-order/:id` route handled by `PayAction`).
- Realtime subscription on `food_orders` for restaurant owners (mirrors driver/rides pattern).
- Image upload paths: `${user.id}/restaurants/${restaurant_id}/...`; video paths same folder, `.mp4/.webm`.
- Video display uses native `<video controls playsInline preload="metadata">`.
- All new colors via existing semantic tokens — no new palette.

## Out of scope
- Stripe/PayPal for food orders (uses existing wallet pay).
- Live courier dispatch for food (status updates only; reuse existing logistics if user wants later).
- Reviews specific to restaurants (reuse existing `reviews` table by `target_type`).
