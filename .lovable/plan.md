## Goal
Bring the Flutter `rides_screen.dart` to full parity with the web `src/pages/Rides.tsx` — same layout, same flow, same live data, same visuals adapted to mobile.

## Current gap
The current Flutter screen is a compact stub (~400 lines) with a fake "Live map" placeholder, 4 tab labels, a single request form, and a basic offers list. The web page is ~1,220 lines plus 5 supporting components (`RideMap`, `PoolPanel`, `RideChat`, `RideRating`, `ActiveRideMonitor`) with a real Leaflet map, place search, route alternatives, surge, shared trips, live radar, ratings, chat, and share.

## Scope — features to port (matches web 1:1)

**Map & geo**
- Real interactive map (`flutter_map` + OSM tiles) with pickup / dropoff / me / driver / demand pins and shared-trip markers
- Reverse-geocode + Nominatim place search (typeahead)
- 3 route alternatives (fastest / balanced / scenic) drawn as polylines, tap-to-select
- "Use my location" for pickup and dropoff, `watchPosition` while on active ride writing `rider_lat/lng`

**Ride flow (matches `rides` table + `ride_offers`)**
- Rehydrate any in-flight ride for the signed-in user on mount
- Vehicle classes: moto / economy / comfort / xl with per-class ETA, seats, gradient tone, fare multiplier
- Fare = `suggestFare(distance, class) × surge`, editable with +/−
- Surge derived from nearby driver supply
- Insert into `rides`, seed simulated offers, live-subscribe `ride_offers`
- Accept offer → update ride + reject siblings; cancel; start; complete → open rating modal
- Share trip (native share sheet), swap pickup/drop

**Tabs**
- Now (RequestPanel)
- Schedule (info banner + same request panel; stores `scheduled_for`)
- Pool (PoolPanel — nearby shared trips list + join)
- Trips (past + current rides list)

**Sections below map (same order as web)**
- Trip insight strip (Route km / ETA / CO₂ / saved $)
- Trust perks row
- Demand zones grid (static presets)
- Saved & frequent shortcuts (Home / Work / Airport / Mall / Hospital) with `localStorage`-equivalent via `shared_preferences`
- Live radar (nearby drivers list from `driver_locations` join `driver_profiles`)

**Overlays**
- Active ride panel with driver card, live driver marker on map, ETA countdown, chat, cancel/start/complete
- Ride rating modal on completion (writes `ride_ratings`)

## Technical plan

**Packages to add** (`flutter/pubspec.yaml`):
- `flutter_map`, `latlong2` (map + OSM tiles)
- `share_plus` (native share)
- `shared_preferences` (saved Home/Work)
- `http` is already indirectly available via `supabase_flutter`; use it for Nominatim

**New files**
```
flutter/lib/screens/rides/
  ride_map.dart              // flutter_map wrapper, pickup/drop/me/drivers/demand/shared/routes
  ride_request_panel.dart    // address inputs + typeahead, class picker, fare, submit
  ride_active_panel.dart     // offers list, accept, driver card, start/complete/cancel, chat button
  ride_pool_panel.dart       // shared trips near me + join sheet
  ride_trips_panel.dart      // past/current rides
  ride_rating_sheet.dart     // 1–5 star modal writing ride_ratings
  ride_chat_sheet.dart       // realtime ride_messages
  ride_data.dart             // suggestFare, haversine, buildRoutes, reverseGeocode, searchPlace
```

**Rewritten**: `flutter/lib/screens/rides_screen.dart` becomes the orchestrator — hero header, map, HUD chips (LIVE / SURGE / POOL / GPS), tab strip, panel switch, insight/perks/zones/shortcuts/radar sections, rating overlay.

**Realtime**: subscribe to `rides` (own row), `ride_offers` (by ride_id), and a `rides` broadcast for demand pins — mirroring web.

**Theming**: reuse the existing `rides-theme` palette on mobile via a local `RidesTheme` — dark glassy chips, mint accents, gradient class cards.

**Deep-link parity**: keep the existing `/rides` and `/rides/:id` routes; opening `/rides/:id` sets `activeRideId` and re-hydrates.

## Non-goals
- No new backend tables or edge functions — everything already exists (`rides`, `ride_offers`, `ride_messages`, `ride_ratings`, `shared_trips`, `driver_locations`, `driver_profiles`).
- No changes to web behavior.

## Delivery
One pass. At the end I'll list every changed/created file and note anything that requires the user to run `flutter pub get` locally.