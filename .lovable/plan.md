# Airbnb-Style Redesign for All Vertical Screens

Give every vertical screen a full Airbnb-clone feel with a shared set of primitives, so Stays, Restaurants, Services, Rides, CarRentals, Properties, Auto, Jobs, Agro, Industrial, Finance, and Logistics all look and behave like independent BnB-style mini-apps.

## What "Airbnb feel" means here

- Sticky search pill at the top ("Where · When · Who" style, adapted per vertical)
- Horizontal category icon rail directly under the search pill (scrollable, active underline)
- Card grid with rounded image carousels, heart save, rating pill, price line
- Floating "Map" toggle pill that flips the list to a map view
- Filters bottom sheet
- Cereal-style display type via `@fontsource/cereal` fallback (`Sora` already loaded — we'll keep it, tightened tracking) with `Manrope` body

## Shared primitives (new)

```
src/components/bnb/
  BnbSearchBar.tsx        // sticky top pill; opens an expanded search sheet
  BnbSearchSheet.tsx      // Where + Dates + Guests (adapts labels per vertical)
  BnbCategoryRail.tsx     // icon + label chips, horizontal scroll, active underline
  BnbListingCard.tsx      // image carousel + heart + rating + price line
  BnbMapToggle.tsx        // floating "Map"/"List" pill (bottom-center)
  BnbMapView.tsx          // Google Maps + price-pin markers (uses existing connector)
  BnbFiltersSheet.tsx     // shared filters shell; each vertical passes its schema
  useBnbSearch.ts         // query-state hook (where, dates, guests, category, filters)
```

The Dates+Guests picker uses shadcn `Calendar` + `Popover` (range mode). "Guests" adapts:
- Stays → guests
- Restaurants → party size + date/time
- Rides / CarRentals → pickup + return date, passengers
- Properties → move-in date, occupants
- Jobs → start date, seats (n/a hidden)
- Agro / Industrial / Finance / Logistics / Auto / Services → dates optional, "quantity"/"seats" hidden when irrelevant

## Map view

Uses the existing Google Maps connector. `BnbMapView` renders `google.maps.Map` with price-pin markers per listing. Each vertical passes `{ id, lat, lng, priceLabel, title, image }`. Prohibited-territory + missing-key states show a graceful fallback ("Map unavailable — showing list").

## Per-vertical pages (rewrite the page shells, keep data hooks)

For every page listed below, the shell becomes:

```
<BnbSearchBar vertical="..." />
<BnbCategoryRail categories={...} />
<Grid> {items.map(i => <BnbListingCard ... />)} </Grid>
<BnbMapToggle /> → <BnbMapView />
<BnbFiltersSheet schema={...} />
```

Pages touched:
- `src/pages/Stays.tsx` (closest to native fit)
- `src/pages/Restaurants.tsx`
- `src/pages/Services.tsx`
- `src/pages/Rides.tsx`
- `src/pages/CarRentals.tsx`
- `src/pages/Properties.tsx`
- `src/pages/Auto.tsx`
- `src/pages/Jobs.tsx`
- `src/pages/Agro.tsx`
- `src/pages/Industrial.tsx`
- `src/pages/Finance.tsx`
- `src/pages/Logistics.tsx`

Each keeps its existing data hook (`fetchStays`, `fetchServiceProviders`, etc.) — only the presentation layer changes. Category rails come from each vertical's existing category list (e.g. Agro's `_kinds`, Stays' `KIND_LABEL`).

## Functional additions

- **Dates + guests picker** wired into the query hook of each vertical. For verticals whose data source doesn't accept dates yet, the values are held in URL state and passed through as filter params so search still returns results (no backend change required this pass).
- **Category icon rail** filters by the vertical's existing `kind`/`category` field.
- **Map toggle** available on every vertical; falls back to list if no lat/lng in the data.
- **Heart save** uses existing `SaveHeart` with per-vertical `kind`.

## Design tokens

Add Airbnb-inspired accents to `src/index.css` without breaking current palette:

```css
--bnb-rausch: 350 84% 55%;       /* Airbnb red for hearts + price accents */
--bnb-foggy: 220 9% 46%;
--bnb-hof: 0 0% 13%;
--radius-bnb: 14px;
--shadow-bnb: 0 6px 20px -8px hsl(0 0% 0% / .18);
```

No hardcoded colors in components — everything via tokens.

## Out of scope this pass

- Detail pages (`/stays/:id`, etc.) keep their current layouts.
- Home rails (`StaysRail`, `ServicesRail`) untouched.
- No schema changes; no new edge functions.

## Rollout order

1. Build `src/components/bnb/*` primitives + tokens.
2. Migrate `Stays.tsx` first (best fit) and verify visually.
3. Roll the same shell through the remaining 11 pages, adapting each vertical's category list + card meta.
4. Wire map toggle + dates/guests state per vertical.

Reply "go" to build, or tell me which screens to prioritize.
