// Catalog data layer — DB-backed.
// Keeps the legacy `Product` / `Supplier` / `Category` shape so existing
// components (ProductCard, SupplierCard, etc.) keep working without changes.
import type { LucideIcon } from "lucide-react";
import {
  Smartphone,
  Shirt,
  Home as HomeIcon,
  Sparkles,
  Dumbbell,
  ToyBrick,
  Car,
  Factory,
  Sprout,
  Package,
  Briefcase,
  HeartPulse,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------
export type Category = { id: string; name: string; icon: LucideIcon };
export type TierPrice = { minQty: number; price: number };
export type Variant = { id: string; name: string; image?: string };
export type VariantGroup = { name: string; options: Variant[] };

export type Supplier = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  yearsActive: number;
  responseRate: number;
  responseTime: string;
  onTimeDelivery: number;
  rating: number;
  verified: boolean;
  gold: boolean;
  tradeAssurance: boolean;
  logo: string;
  banner: string;
  about: string;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  /** When set, this supplier is a "mirror" of another store and shares its products. */
  mirrorOf: string | null;
  // Supplier onboarding fields
  businessType: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categories: string[];
  onboardingCompletedAt: string | null;
  tradeType: "retail" | "wholesale" | "both";
  exportCountries: string[];
};

export type Review = {
  id: string;
  user: string;
  country: string;
  rating: number;
  date: string;
  text: string;
  variant?: string;
};

export type Product = {
  id: string;
  title: string;
  image: string;
  gallery?: string[];
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  sold: number;
  category: string;
  badge?: "Hot" | "New" | "Deal" | "Top";
  freeShipping?: boolean;
  supplierId: string;
  /** Lightweight supplier fields embedded for cards (verified badge, etc.) */
  supplierVerified?: boolean;
  supplierGold?: boolean;
  supplierName?: string;
  supplierLocation?: string | null;
  supplierLat?: number | null;
  supplierLng?: number | null;
  moq: number;
  unit: string;
  /** Derived: 'wholesale' if moq > 1, otherwise 'retail'. */
  tradeType: "retail" | "wholesale";
  /** The supplier's declared trade type (retail / wholesale / both). */
  supplierTradeType?: "retail" | "wholesale" | "both";
  leadTime: string;
  shipFrom: string;
  tierPrices?: TierPrice[];
  variants?: VariantGroup[];
  specs?: { label: string; value: string }[];
  description?: string;
  reviewList?: Review[];
  dealEndsAt?: string | null;
  /** AI-generated ad reel + copy (see generate-ad edge function). */
  adHasReel?: boolean;
  adHeadline?: string | null;
  adTagline?: string | null;
};


// ---------- Categories ----------
const ICON_MAP: Record<string, LucideIcon> = {
  Smartphone, Shirt, Home: HomeIcon, Sparkles, Dumbbell, ToyBrick,
  Car, Factory, Sprout, Package, Briefcase, HeartPulse,
};
const fallbackIcon = ShoppingBag;

export const CATEGORIES: Category[] = [
  { id: "electronics", name: "Electronics", icon: Smartphone },
  { id: "fashion", name: "Fashion", icon: Shirt },
  { id: "home", name: "Home & Garden", icon: HomeIcon },
  { id: "beauty", name: "Beauty", icon: Sparkles },
  { id: "sports", name: "Sports", icon: Dumbbell },
  { id: "toys", name: "Toys", icon: ToyBrick },
  { id: "automotive", name: "Automotive", icon: Car },
  { id: "industrial", name: "Industrial", icon: Factory },
  { id: "agriculture", name: "Agriculture", icon: Sprout },
  { id: "packaging", name: "Packaging", icon: Package },
  { id: "office", name: "Office", icon: Briefcase },
  { id: "health", name: "Health", icon: HeartPulse },
];

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  if (!data?.length) return CATEGORIES;
  return data.map((c) => ({
    id: c.slug,
    name: c.name,
    icon: ICON_MAP[c.icon ?? ""] ?? fallbackIcon,
  }));
}

// ---------- Mappers ----------
type DbSupplier = {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  years_active: number | null;
  response_rate: number | null;
  response_time: string | null;
  on_time_delivery: number | null;
  rating: number | null;
  verified: boolean | null;
  gold: boolean | null;
  trade_assurance: boolean | null;
  logo: string | null;
  banner: string | null;
  about: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_address?: string | null;
  mirror_of?: string | null;
  business_type?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  categories?: string[] | null;
  onboarding_completed_at?: string | null;
  trade_type?: string | null;
  export_countries?: string[] | null;
};

type DbProduct = {
  id: string;
  supplier_id: string;
  title: string;
  description: string | null;
  image: string | null;
  gallery: string[] | null;
  price: number;
  original_price: number | null;
  category_slug: string | null;
  badge: string | null;
  free_shipping: boolean | null;
  moq: number | null;
  unit: string | null;
  lead_time: string | null;
  ship_from: string | null;
  specs: unknown;
  rating: number | null;
  review_count: number | null;
  sold: number | null;
  deal_ends_at?: string | null;
};

const PLACEHOLDER_IMG = "/placeholder.svg";

export const mapSupplier = (s: DbSupplier): Supplier => ({
  id: s.id,
  name: s.name,
  country: s.country ?? "",
  countryCode: s.country_code ?? "",
  yearsActive: s.years_active ?? 0,
  responseRate: s.response_rate ?? 0,
  responseTime: s.response_time ?? "—",
  onTimeDelivery: s.on_time_delivery ?? 0,
  rating: Number(s.rating ?? 0),
  verified: !!s.verified,
  gold: !!s.gold,
  tradeAssurance: !!s.trade_assurance,
  logo: s.logo ?? PLACEHOLDER_IMG,
  banner: s.banner ?? PLACEHOLDER_IMG,
  about: s.about ?? "",
  latitude: s.latitude != null ? Number(s.latitude) : null,
  longitude: s.longitude != null ? Number(s.longitude) : null,
  locationAddress: s.location_address ?? null,
  mirrorOf: s.mirror_of ?? null,
  businessType: s.business_type ?? null,
  phone: s.phone ?? null,
  email: s.email ?? null,
  website: s.website ?? null,
  categories: (s.categories ?? []) as string[],
  onboardingCompletedAt: s.onboarding_completed_at ?? null,
  tradeType: ((s.trade_type as Supplier["tradeType"]) ?? "both"),
  exportCountries: (s.export_countries ?? []) as string[],
});

type DbProductWithSupplier = DbProduct & {
  suppliers?: {
    name: string | null;
    verified: boolean | null;
    gold: boolean | null;
    country: string | null;
    location_address: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    trade_type?: string | null;
  } | null;
};

export const mapProduct = (p: DbProduct | DbProductWithSupplier): Product => {
  const sup = (p as DbProductWithSupplier).suppliers ?? null;
  const supLat = sup?.latitude != null ? Number(sup.latitude) : null;
  const supLng = sup?.longitude != null ? Number(sup.longitude) : null;
  return {
    id: p.id,
    title: p.title,
    image: p.image ?? PLACEHOLDER_IMG,
    gallery: p.gallery?.length ? p.gallery : [p.image ?? PLACEHOLDER_IMG],
    price: Number(p.price),
    originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
    rating: Number(p.rating ?? 0),
    reviews: p.review_count ?? 0,
    sold: p.sold ?? 0,
    category: p.category_slug ?? "",
    badge: (p.badge as Product["badge"]) ?? undefined,
    freeShipping: !!p.free_shipping,
    supplierId: p.supplier_id,
    supplierVerified: sup ? !!sup.verified : undefined,
    supplierGold: sup ? !!sup.gold : undefined,
    supplierName: sup?.name ?? undefined,
    supplierLocation: sup?.location_address ?? sup?.country ?? null,
    supplierLat: Number.isFinite(supLat as number) ? (supLat as number) : null,
    supplierLng: Number.isFinite(supLng as number) ? (supLng as number) : null,
    moq: p.moq ?? 1,
    unit: p.unit ?? "piece",
    tradeType: (p.moq ?? 1) > 1 ? "wholesale" : "retail",
    supplierTradeType: (sup?.trade_type as Product["supplierTradeType"]) ?? "both",
    leadTime: p.lead_time ?? "—",
    shipFrom: p.ship_from ?? "—",
    specs: Array.isArray(p.specs) ? (p.specs as { label: string; value: string }[]) : [],
    description: p.description ?? "",
    dealEndsAt: p.deal_ends_at ?? null,
  };
};

// ---------- Mirror helpers ----------
const masterCache = new Map<string, string>();

/**
 * Resolve a (possibly mirrored) supplier id to the master supplier id that
 * actually owns the products / receives orders / messages / quotes.
 * Mirror suppliers are virtual storefronts that share their master's catalog.
 */
export async function resolveMasterSupplierId(supplierId: string): Promise<string> {
  if (!supplierId) return supplierId;
  const cached = masterCache.get(supplierId);
  if (cached) return cached;
  const { data } = await supabase
    .from("suppliers")
    .select("id, mirror_of")
    .eq("id", supplierId)
    .maybeSingle();
  const master = (data?.mirror_of as string | null) ?? data?.id ?? supplierId;
  masterCache.set(supplierId, master);
  return master;
}

// Hard caps so a single query never tries to pull thousands of rows over the
// wire. Supabase has a default 1000-row ceiling; we tighten further for UX.
const DEFAULT_PRODUCT_LIMIT = 60;
const MAX_PRODUCT_LIMIT = 200;
const DEFAULT_SUPPLIER_LIMIT = 60;
const MAX_SUPPLIER_LIMIT = 200;

export async function fetchProducts(opts: {
  category?: string;
  supplierId?: string;
  search?: string;
  limit?: number;
  sortBy?: "newest" | "sold" | "price_asc" | "price_desc" | "rating";
  /** "retail" → moq <= 1, "wholesale" → moq > 1, "all" → no filter */
  tradeMode?: "all" | "retail" | "wholesale";
} = {}): Promise<Product[]> {
  // If filtering by a mirror store, swap to master so we show its catalog.
  let supplierId = opts.supplierId;
  if (supplierId) supplierId = await resolveMasterSupplierId(supplierId);

  let q = supabase
    .from("products")
    // Narrow the column set so we never pull large `description`/`specs` blobs
    // for list views — list cards only need a handful of fields.
    .select(
      "id, supplier_id, title, image, gallery, price, original_price, category_slug, badge, free_shipping, moq, unit, lead_time, ship_from, rating, review_count, sold, deal_ends_at, suppliers!inner(name, verified, gold, country, location_address, latitude, longitude, trade_type)"
    )
    .eq("active", true);
  if (opts.category) q = q.eq("category_slug", opts.category);
  if (supplierId) q = q.eq("supplier_id", supplierId);
  if (opts.tradeMode === "wholesale") q = q.gt("moq", 1);
  if (opts.tradeMode === "retail") q = q.lte("moq", 1);
  if (opts.search) {
    const term = opts.search.replace(/[%,]/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      // Drop `description.ilike` from the OR — full-text scan on a long text
      // column is the slowest part of catalog search. Title/category/badge
      // cover real-world queries and stay index-friendly.
      q = q.or(
        `title.ilike.${like},category_slug.ilike.${like},badge.ilike.${like}`,
      );
    }
  }
  switch (opts.sortBy) {
    case "sold": q = q.order("sold", { ascending: false }); break;
    case "price_asc": q = q.order("price", { ascending: true }); break;
    case "price_desc": q = q.order("price", { ascending: false }); break;
    case "rating": q = q.order("rating", { ascending: false }); break;
    default: q = q.order("created_at", { ascending: false });
  }
  const limit = Math.min(opts.limit ?? DEFAULT_PRODUCT_LIMIT, MAX_PRODUCT_LIMIT);
  q = q.limit(limit);
  const { data, error } = await q;
  // Throw so React Query can retry + surface a real error instead of an
  // infinite "Loading…" state.
  if (error) throw error;
  return ((data ?? []) as unknown as DbProductWithSupplier[]).map(mapProduct);
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*, suppliers!inner(name, verified, gold, country, location_address, latitude, longitude)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as DbProductWithSupplier) : null;
}

export async function fetchSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapSupplier(data as DbSupplier) : null;
}

export async function fetchSuppliers(opts: { limit?: number; verifiedOnly?: boolean; includeMirrors?: boolean } = {}): Promise<Supplier[]> {
  let q = supabase.from("suppliers").select("*").order("rating", { ascending: false });
  if (opts.verifiedOnly) q = q.eq("verified", true);
  // By default exclude mirrors from "top suppliers" / global lists so the
  // master store keeps its identity. Pages that explicitly want mirrors
  // (e.g. directory) can opt in.
  if (!opts.includeMirrors) q = q.is("mirror_of", null);
  const limit = Math.min(opts.limit ?? DEFAULT_SUPPLIER_LIMIT, MAX_SUPPLIER_LIMIT);
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as DbSupplier[]).map(mapSupplier);
}

export async function fetchMySupplier(): Promise<Supplier | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // An owner can have many stores (the "master" + many mirrors). Always
  // return the master store (mirror_of IS NULL) for management views.
  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .eq("owner_id", user.id)
    .is("mirror_of", null)
    .maybeSingle();
  return data ? mapSupplier(data as DbSupplier) : null;
}

export async function fetchProductTierPrices(productId: string): Promise<TierPrice[]> {
  const { data } = await supabase
    .from("product_tier_prices").select("*").eq("product_id", productId).order("min_qty");
  return (data ?? []).map((t) => ({ minQty: t.min_qty, price: Number(t.price) }));
}

export async function fetchProductReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews").select("*").eq("product_id", productId)
    .order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => ({
    id: r.id,
    user: "Buyer",
    country: r.country ?? "",
    rating: r.rating,
    date: new Date(r.created_at).toLocaleDateString(),
    text: r.text ?? "",
    variant: r.variant ?? undefined,
  }));
}

// ---------- Helpers (still synchronous, work on a Product instance) ----------
export const discountPct = (p: Product) =>
  p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;

export const tierPriceFor = (p: Product, qty: number): number => {
  if (!p.tierPrices?.length) return p.price;
  const sorted = [...p.tierPrices].sort((a, b) => a.minQty - b.minQty);
  let price = sorted[0].price;
  for (const tier of sorted) if (qty >= tier.minQty) price = tier.price;
  return price;
};

// ---------- Legacy exports (now empty, kept for compatibility) ----------
// These exports are referenced in places we haven't refactored yet (Live, RFQ,
// Orders, Notifications, Messages, etc.). Returning empty arrays keeps the app
// from crashing while we migrate those pages to live data in later phases.
export const PRODUCTS: Product[] = [];
export const SUPPLIERS: Supplier[] = [];
export const FLASH_DEALS: Product[] = [];
export const TRENDING: Product[] = [];

// Sync helpers used by old code paths — return undefined/empty.
export const getProduct = (_id: string): Product | undefined => undefined;
export const getSupplier = (_id: string): Supplier | undefined => undefined;
export const getProductsBySupplier = (_id: string): Product[] => [];
export const getRelated = (_p: Product, _limit = 6): Product[] => [];
export const getRecommended = (_interests: string[] = []): Product[] => [];
