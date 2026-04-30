import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rankSearch, tokenize, type Searchable } from "@/lib/search";

/**
 * UniversalHit — a normalized row from any vertical, shaped for the
 * `rankSearch` ranker. Fields like `kind` and `href` let the UI render
 * a heterogeneous result list with proper deep-links.
 */
export type UniversalHit = Searchable & {
  kind:
    | "product"
    | "service"
    | "property"
    | "finance"
    | "logistics"
    | "vehicle"
    | "stay"
    | "industrial"
    | "news"
    | "supplier"
    | "ride";
  image?: string | null;
  href: string;
  price?: number | null;
  currency?: string | null;
  city?: string | null;
  country?: string | null;
};

const empty = <T,>(arr: T[] | null | undefined): T[] => arr ?? [];

/**
 * Loads a wide pool of listings from every vertical exactly once and
 * caches it. The actual matching/ranking happens client-side via
 * rankSearch — this is what makes the search feel "AI-like": fuzzy,
 * typo-tolerant, multi-field, no LLM in the loop.
 */
async function loadUniversalPool(): Promise<UniversalHit[]> {
  const [
    products, suppliers, services, properties, finance,
    logistics, vehicles, stays, industrial, news,
  ] = await Promise.all([
    supabase.from("products")
      .select("id,title,description,category_slug,badge,price,image,rating,review_count,sold,free_shipping,deal_ends_at,supplier_id")
      .eq("active", true).limit(400),
    supabase.from("suppliers").select("id,name,about,country,logo,verified,rating").is("mirror_of", null).limit(120),
    supabase.from("service_providers").select("id,display_name,bio,category,subcategory,skills,city,country,cover,rating,jobs_completed,hourly_rate,currency").eq("active", true).limit(200),
    supabase.from("properties").select("id,title,description,property_kind,listing_type,city,country,price,currency,cover,bedrooms,baths,featured,views").eq("active", true).limit(200),
    supabase.from("finance_products").select("id,title,kind,description,provider_name,country,city,cover,min_amount,max_amount,interest_rate,currency,featured").eq("active", true).limit(120),
    supabase.from("logistics_requests").select("id,title,description,vehicle_type,pickup_address,dropoff_address,budget,currency,status").eq("status", "open").limit(120),
    supabase.from("vehicles").select("id,title,description,kind,make,model,city,country,price,currency,cover").eq("active", true).limit(200),
    supabase.from("stays").select("id,title,description,kind,city,country,price_per_night,currency,cover,rating,review_count,superhost").eq("active", true).limit(200),
    supabase.from("industrial_listings").select("id,title,description,category,subcategory,country,price,currency,cover").eq("active", true).limit(200),
    supabase.from("news_articles").select("id,title,dek,slug,category,cover,tags,read_minutes").limit(120),
  ]);

  const hits: UniversalHit[] = [];

  for (const p of empty(products.data as any[])) {
    hits.push({
      id: `p:${p.id}`, kind: "product",
      title: p.title, category: p.category_slug ?? "products", badge: p.badge,
      description: p.description ?? "",
      image: p.image, href: `/product/${p.id}`,
      price: Number(p.price ?? 0), rating: Number(p.rating ?? 0),
      reviews: p.review_count ?? 0, sold: p.sold ?? 0,
      freeShipping: !!p.free_shipping, dealEndsAt: p.deal_ends_at,
    });
  }

  for (const s of empty(suppliers.data as any[])) {
    hits.push({
      id: `s:${s.id}`, kind: "supplier",
      title: s.name, category: "suppliers stores",
      badge: s.verified ? "Verified" : null,
      description: [s.about, s.country].filter(Boolean).join(" · "),
      image: s.logo, href: `/supplier/${s.id}`,
      rating: Number(s.rating ?? 0), reviews: 0, sold: 0,
      country: s.country,
    });
  }

  for (const sp of empty(services.data as any[])) {
    hits.push({
      id: `sv:${sp.id}`, kind: "service",
      title: sp.display_name,
      category: `services ${sp.category ?? ""} ${sp.subcategory ?? ""} jobs hire freelancer pro`,
      description: [sp.bio, ...(sp.skills ?? [])].filter(Boolean).join(" "),
      image: sp.cover, href: `/services?provider=${sp.id}`,
      price: sp.hourly_rate ? Number(sp.hourly_rate) : null,
      currency: sp.currency,
      rating: Number(sp.rating ?? 0), reviews: sp.jobs_completed ?? 0, sold: sp.jobs_completed ?? 0,
      city: sp.city, country: sp.country,
    });
  }

  for (const pr of empty(properties.data as any[])) {
    hits.push({
      id: `pr:${pr.id}`, kind: "property",
      title: pr.title,
      category: `property real estate ${pr.listing_type ?? ""} ${pr.property_kind ?? ""} ${pr.bedrooms ?? ""} bed`,
      description: pr.description ?? "",
      image: pr.cover, href: `/properties?id=${pr.id}`,
      price: Number(pr.price ?? 0), currency: pr.currency,
      rating: pr.featured ? 5 : 4, reviews: pr.views ?? 0, sold: pr.views ?? 0,
      city: pr.city, country: pr.country,
    });
  }

  for (const f of empty(finance.data as any[])) {
    hits.push({
      id: `fn:${f.id}`, kind: "finance",
      title: f.title,
      category: `finance ${f.kind ?? ""} loan credit insurance financing`,
      description: [f.provider_name, f.description].filter(Boolean).join(" · "),
      image: f.cover, href: `/finance?id=${f.id}`,
      price: f.min_amount ? Number(f.min_amount) : null,
      currency: f.currency,
      rating: f.featured ? 5 : 4, reviews: 0, sold: 0,
      country: f.country, city: f.city,
    });
  }

  for (const l of empty(logistics.data as any[])) {
    hits.push({
      id: `lg:${l.id}`, kind: "logistics",
      title: l.title,
      category: `logistics delivery courier ${l.vehicle_type ?? ""}`,
      description: [l.description, l.pickup_address, "→", l.dropoff_address].filter(Boolean).join(" "),
      image: null, href: `/logistics?id=${l.id}`,
      price: l.budget ? Number(l.budget) : null,
      currency: l.currency,
      rating: 4, reviews: 0, sold: 0,
    });
  }

  for (const v of empty(vehicles.data as any[])) {
    hits.push({
      id: `vh:${v.id}`, kind: "vehicle",
      title: v.title,
      category: `vehicle car auto ${v.kind ?? ""} ${v.brand ?? ""} ${v.model ?? ""}`,
      description: [v.description, v.brand, v.model].filter(Boolean).join(" "),
      image: v.cover, href: `/auto?id=${v.id}`,
      price: Number(v.price ?? 0), currency: v.currency,
      rating: 4.5, reviews: 0, sold: 0,
      city: v.city, country: v.country,
    });
  }

  for (const st of empty(stays.data as any[])) {
    hits.push({
      id: `st:${st.id}`, kind: "stay",
      title: st.title,
      category: `stay hotel bnb accommodation ${st.kind ?? ""}`,
      description: st.description ?? "",
      image: st.cover, href: `/stays?id=${st.id}`,
      price: Number(st.price_per_night ?? 0), currency: st.currency,
      rating: st.featured ? 5 : 4.5, reviews: 0, sold: 0,
      city: st.city, country: st.country,
    });
  }

  for (const ind of empty(industrial.data as any[])) {
    hits.push({
      id: `in:${ind.id}`, kind: "industrial",
      title: ind.title,
      category: `industrial machinery ${ind.category ?? ""} ${ind.subcategory ?? ""}`,
      description: ind.description ?? "",
      image: ind.cover, href: `/industrial?id=${ind.id}`,
      price: ind.price ? Number(ind.price) : null,
      currency: ind.currency,
      rating: 4.5, reviews: 0, sold: 0,
      country: ind.country,
    });
  }

  for (const n of empty(news.data as any[])) {
    hits.push({
      id: `nw:${n.id}`, kind: "news",
      title: n.title,
      category: `news article ${n.category ?? ""} ${(n.tags ?? []).join(" ")}`,
      description: n.dek ?? "",
      image: n.cover, href: `/news/${n.slug}`,
      rating: 4, reviews: n.read_minutes ?? 3, sold: 0,
    });
  }

  return hits;
}

export function useUniversalPool() {
  return useQuery({
    queryKey: ["universal-search-pool"],
    queryFn: loadUniversalPool,
    staleTime: 60_000,
  });
}

export function searchUniversal(pool: UniversalHit[], query: string, kindFilter?: UniversalHit["kind"] | null) {
  let list = pool;
  if (kindFilter) list = list.filter((h) => h.kind === kindFilter);
  const tokens = tokenize(query);
  if (!tokens.length) return list.slice(0, 60).map((item) => ({ item, score: 0 }));
  return rankSearch(list, query);
}
