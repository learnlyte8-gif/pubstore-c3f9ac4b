import { supabase } from "@/integrations/supabase/client";

// =================== NEWS ===================
export type NewsArticle = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  body: string | null;
  cover: string | null;
  category: string;
  tags: string[];
  author: string | null;
  source: string | null;
  source_url: string | null;
  published_at: string;
  read_minutes: number;
  featured: boolean;
  views: number;
};

export async function fetchNews(opts: { category?: string; limit?: number; featured?: boolean } = {}): Promise<NewsArticle[]> {
  let q = supabase.from("news_articles").select("*").order("published_at", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.featured) q = q.eq("featured", true);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as NewsArticle[];
}

export async function fetchNewsArticle(slug: string): Promise<NewsArticle | null> {
  const { data } = await supabase.from("news_articles").select("*").eq("slug", slug).maybeSingle();
  return (data as NewsArticle) ?? null;
}

// =================== STAYS ===================
export type Stay = {
  id: string;
  title: string;
  kind: string;
  city: string | null;
  country: string | null;
  country_code: string | null;
  cover: string | null;
  gallery: string[];
  description: string | null;
  amenities: string[];
  bedrooms: number;
  beds: number;
  baths: number;
  guests: number;
  price_per_night: number;
  currency: string;
  rating: number;
  review_count: number;
  superhost: boolean;
};

export async function fetchStays(opts: { kind?: string; limit?: number } = {}): Promise<Stay[]> {
  let q = supabase.from("stays").select("*").eq("active", true).order("rating", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as Stay[];
}

export async function fetchStay(id: string): Promise<Stay | null> {
  const { data } = await supabase.from("stays").select("*").eq("id", id).maybeSingle();
  return (data as Stay) ?? null;
}

// =================== VEHICLES ===================
export type Vehicle = {
  id: string;
  title: string;
  kind: string;
  make: string | null;
  model: string | null;
  year: number | null;
  condition: string;
  fuel: string | null;
  transmission: string | null;
  mileage_km: number | null;
  body_type: string | null;
  drivetrain: string | null;
  power_hp: number | null;
  cover: string | null;
  gallery: string[];
  description: string | null;
  features: string[];
  city: string | null;
  country: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  badge: string | null;
};

export async function fetchVehicles(opts: { kind?: string; limit?: number } = {}): Promise<Vehicle[]> {
  let q = supabase.from("vehicles").select("*").eq("active", true).order("created_at", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as Vehicle[];
}

export async function fetchVehicle(id: string): Promise<Vehicle | null> {
  const { data } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  return (data as Vehicle) ?? null;
}

// =================== INDUSTRIAL ===================
export type IndustrialListing = {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  cover: string | null;
  gallery: string[];
  description: string | null;
  spec: Record<string, string>;
  moq: number | null;
  unit: string | null;
  price: number | null;
  currency: string;
  lead_time: string | null;
  capacity: string | null;
  certifications: string[];
  ship_from: string | null;
  country: string | null;
};

export async function fetchIndustrial(opts: { category?: string; limit?: number } = {}): Promise<IndustrialListing[]> {
  let q = supabase.from("industrial_listings").select("*").eq("active", true).order("created_at", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as IndustrialListing[];
}

export async function fetchIndustrialItem(id: string): Promise<IndustrialListing | null> {
  const { data } = await supabase.from("industrial_listings").select("*").eq("id", id).maybeSingle();
  return (data as IndustrialListing) ?? null;
}
