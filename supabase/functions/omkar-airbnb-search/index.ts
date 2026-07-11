import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type StayItem = {
  id: string;
  title: string;
  image: string | null;
  images: string[];
  price: number | null;
  currency: string;
  city: string | null;
  country: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  bedrooms: number | null;
  beds: number | null;
  baths: number | null;
  guests: number | null;
  rating: number | null;
  review_count: number | null;
  superhost: boolean;
  url: string;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Use GET for Airbnb search" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("OMKAR_API_KEY");
    if (!apiKey) return json({ error: "OMKAR_API_KEY not configured" }, 500);

    const requestUrl = new URL(req.url);
    const destination = String(requestUrl.searchParams.get("destination") ?? "").trim();
    const page = Math.max(1, parseInt(String(requestUrl.searchParams.get("page") ?? 1), 10) || 1);
    if (!destination) return json({ error: "destination is required" }, 400);

    const url = new URL("https://airbnb-scraper-api.omkar.cloud/airbnb/listings/search");
    url.searchParams.set("destination_query", destination);
    url.searchParams.set("page_number", String(page));
    const arrivalDate = requestUrl.searchParams.get("arrival_date");
    const departureDate = requestUrl.searchParams.get("departure_date");
    const adultGuests = requestUrl.searchParams.get("adult_guests");
    if (arrivalDate) url.searchParams.set("arrival_date", arrivalDate);
    if (departureDate) url.searchParams.set("departure_date", departureDate);
    if (adultGuests) url.searchParams.set("adult_guests", adultGuests);

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: { "API-Key": apiKey, Accept: "application/json" },
    });
    const text = await r.text();
    if (!r.ok) {
      console.error("omkar airbnb search error", r.status, text.slice(0, 500));
      return json({ error: `Airbnb search failed (${r.status})`, details: text.slice(0, 500) }, r.status);
    }

    let data: any;
    try { data = JSON.parse(text); } catch { return json({ error: "Invalid Airbnb response" }, 502); }

    const listings: any[] = Array.isArray(data?.listings) ? data.listings : [];
    const items: StayItem[] = listings.map((l) => {
      const photos: string[] = Array.isArray(l?.photos) ? l.photos.filter(Boolean) : [];
      const addr = String(l?.full_address ?? "");
      const parts = addr.split(",").map((s: string) => s.trim()).filter(Boolean);
      const country = parts.length > 1 ? parts[parts.length - 1] : null;
      return {
        id: String(l?.listing_id ?? ""),
        title: String(l?.title ?? ""),
        image: photos[0] ?? null,
        images: photos.slice(0, 12),
        price: toNum(l?.pricing?.nightly_rate),
        currency: String(l?.pricing?.currency ?? "USD"),
        city: l?.city ?? (parts[0] ?? null),
        country,
        full_address: addr || null,
        latitude: toNum(l?.latitude),
        longitude: toNum(l?.longitude),
        property_type: l?.property_type ?? null,
        bedrooms: toNum(l?.bedroom_count),
        beds: toNum(l?.bed_count),
        baths: toNum(l?.bathroom_count),
        guests: toNum(l?.guest_capacity),
        rating: toNum(l?.overall_rating),
        review_count: toNum(l?.review_count),
        superhost: l?.is_superhost === true,
        url: String(l?.listing_url ?? (l?.listing_id ? `https://www.airbnb.com/rooms/${l.listing_id}` : "")),
      };
    }).filter((it) => it.id && it.title);

    return json({
      items,
      total_results: data?.total_results ?? items.length,
      page,
    });
  } catch (e) {
    console.error("omkar-airbnb-search error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
