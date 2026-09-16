# Mirror Suppliers — Mobile Porting Guide

How the mirror-store system works on the web, and exactly what the mobile apps
must implement for parity. Read this before building supplier/store screens.

## 1. The concept

A **mirror supplier** is a virtual storefront: a second row in `public.suppliers`
whose `mirror_of` column points back to a **master store** row. Mirrors exist so
products can appear in more countries and under more storefront names without
duplicating the underlying product rows.

- `suppliers.mirror_of` — nullable `uuid` FK → `suppliers(id)` (the master store).
  `NULL` = a real store. Non-null = a mirror.
- Every mirror duplicates the master's `categories` and `about`, but has its own
  `name`, `country` (Zimbabwe, Botswana, Zambia, South Africa, …) and an
  auto-generated `logo_url` (transparent 1024×1024 PNGs stored in
  `supplier-certs/mirror-logos/`).
- Products are never duplicated. A mirror sells **the master's catalog**.

## 2. The three rules (non-negotiable)

Every mobile screen that touches suppliers or products must apply all three:

### Rule 1 — Resolve mirror → master before loading products

When a user opens any supplier/store screen, first load the supplier row. If
`mirror_of` is not null, load the master row and use **its** id for the product
query. The mirror's own id has no products.

```ts
const { data: sup } = await supabase.from("suppliers").select("*").eq("id", id).single();
const masterId = sup.mirror_of ?? sup.id;
const { data: products } = await supabase.from("products")
  .select("*").eq("supplier_id", masterId);
```

- Product cards must still show **the mirror's** name, logo and country (that is
  the point of the mirror), but inventory, stock, prices and order routing all
  come from the master.

### Rule 2 — Filter `mirror_of IS NULL` on supplier lists and search

Supplier directories, search results, category browsing, "top stores" rails,
etc. must exclude mirrors or users see hundreds of look-alike storefronts:

```ts
supabase.from("suppliers").select("*").is("mirror_of", null)
```

Exception: product search may *surface* products through mirror stores (that's
how reach works), but each mirrored listing still renders as one product card
with the mirror's branding — the three rules just decide which store row you
display and which id you query.

### Rule 3 — Always use the master store in "My store" management

If the signed-in user's supplier row has `mirror_of` set (shouldn't normally
happen, but defensive), resolve to the master before any read/write of
products, settings, onboarding or verification. Publishing, collection-point
setup and wallet/balance screens always operate on the master row.

## 3. Data shape (web reference)

`suppliers` columns used by this system:

| Column | Mirror value | Master value |
|---|---|---|
| `id` | own uuid | own uuid |
| `mirror_of` | master uuid | `NULL` |
| `name` | unique storefront name | original name |
| `country` | ZW / BW / ZM / ZA | original |
| `logo_url` | generated PNG in `supplier-certs/mirror-logos/` | uploaded logo |
| `categories` | copy of master's | source of truth |
| `about` | copy of master's | source of truth |
| `user_id` | same owner as master | owner |
| `onboarding_completed_at`, verification, etc. | same as master | source of truth |

## 4. Screen-by-screen parity checklist

| Screen | Web behavior | Mobile must do |
|---|---|---|
| Store page (`/store/:id`) | resolve mirror → master, load master products, show mirror branding | identical |
| Supplier directory / lists | `is("mirror_of", null)` | identical |
| Supplier search | exclude mirrors from store results | identical |
| Product cards inside a mirror store | mirror name/logo, master prices/stock | identical |
| "My store" / dashboard | operate on master row | identical |
| Onboarding / verification | never triggered for mirrors (they inherit master's state) | identical |
| Checkout | order items reference the product id (master-owned); no mirror id needed | identical |

## 5. Edge cases to test on mobile

1. Open a store whose id has `mirror_of` set → catalog shows products, branding
   shows the mirror, not an empty store.
2. Supplier list on a fresh install → no mirror duplicates.
3. Search "store" → mirrors absent from results; products found via mirrors
   appear once with mirror branding.
4. Tap a product card from a mirror store → product page loads (master data).
5. Owner opens "My store" → sees master store, even if a deep link pointed at
   the mirror id (resolve first, then render).
6. Offline/poor network: mirror→master is one extra round trip; cache the
   resolved master id with the supplier row so the product list loads in one
   shot on retry.

## 6. API usage summary

```ts
// single store screen — resolve once
async function loadStore(supplierId: string) {
  const { data: sup } = await supabase
    .from("suppliers").select("*").eq("id", supplierId).single();
  const isMirror = !!sup.mirror_of;
  const masterId = sup.mirror_of ?? sup.id;
  const [master, products] = await Promise.all([
    isMirror
      ? supabase.from("suppliers").select("*").eq("id", masterId).single()
      : Promise.resolve({ data: sup }),
    supabase.from("products").select("*").eq("supplier_id", masterId),
  ]);
  return { display: sup /* mirror branding */, master: master.data, products: products.data };
}

// lists — mirrors out
supabase.from("suppliers").select("*").is("mirror_of", null).eq("country", "ZW");
```

No new backend work is required — this is pure client-side filtering/resolution
against the existing schema and RLS.
