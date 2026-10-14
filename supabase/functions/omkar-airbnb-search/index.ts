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

// Nightly rate from the total: "5 nights x $145.60" breakdown, else total / nights.
function nightlyRate(p: any): number | null {
  const breakdown = Array.isArray(p?.breakdown) ? p.breakdown : [];
  for (const b of breakdown) {
    const m = String(b?.description ?? "").match(/(\d+)\s+nights?\s+x\s+\$?([\d.,]+)/i);
    if (m) {
      const n = parseFloat(m[2].replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  const total = toNum(p?.amount);
  const q = String(p?.qualifier ?? "");
  const nights = q.match(/(\d+)\s+nights?/i);
  if (total !== null && nights) {
    const n = parseInt(nights[1], 10);
    if (n > 0) return Math.round((total / n) * 100) / 100;
  }
  return total;
}

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

    const apiKey = (
      Deno.env.get("OMKAR_AIRBNB_API_KEY") ||
      Deno.env.get("OMKAR_API_KEY") ||
      Deno.env.get("OMKAR_SHEIN_API_KEY")
    )?.trim();
    if (!apiKey) return json({ error: "Airbnb API key not configured" }, 500);

    const requestUrl = new URL(req.url);
    const destination = String(requestUrl.searchParams.get("destination_query") ?? requestUrl.searchParams.get("destination") ?? requestUrl.searchParams.get("query") ?? "").trim();
    const page = Math.max(1, Math.min(50, parseInt(String(requestUrl.searchParams.get("page_number") ?? requestUrl.searchParams.get("page") ?? 1), 10) || 1));
    if (!destination) return json({ error: "destination is required" }, 400);

    const url = new URL("https://airbnb-scraper-api.omkar.cloud/airbnb/rooms/search");
    url.searchParams.set("query", destination);
    const placeId = requestUrl.searchParams.get("place_id");
    if (placeId) url.searchParams.set("place_id", placeId);
    if (page > 1) url.searchParams.set("page", String(page));

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: { "API-Key": apiKey, "Accept": "application/json" },
    });
    const text = await r.text();
    if (!r.ok) {
      console.error("omkar airbnb search error", r.status, text.slice(0, 500));
      return json({
        error: r.status >= 500
          ? "Airbnb API is returning a server error for this API key. Please check the omkar.cloud key or try again later."
          : `Airbnb search failed (${r.status})`,
        details: text.slice(0, 500),
      }, r.status >= 500 ? 502 : r.status);
    }

    let data: any;
    try { data = JSON.parse(text); } catch { return json({ error: "Invalid Airbnb response" }, 502); }

    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const items: StayItem[] = results.map((l) => {
      const photos: string[] = Array.isArray(l?.images) ? l.images.filter(Boolean).map(String) : [];
      const titleParts = String(l?.title ?? "").split(" in ");
      return {
        id: String(l?.id ?? ""),
        title: String(l?.name ?? l?.title ?? ""),
        image: photos[0] ?? null,
        images: photos.slice(0, 12),
        price: nightlyRate(l?.price),
        currency: String(l?.price?.currency ?? data?.currency ?? "USD"),
        city: titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : null,
        country: null,
        full_address: null,
        latitude: toNum(l?.coordinates?.latitude),
        longitude: toNum(l?.coordinates?.longitude),
        property_type: l?.title ?? null,
        bedrooms: toNum(l?.bedrooms),
        beds: toNum(l?.beds),
        baths: toNum(l?.bathrooms),
        guests: null,
        rating: toNum(l?.rating),
        review_count: toNum(l?.reviews_count),
        superhost: l?.is_superhost === true,
        url: String(l?.link ?? (l?.id ? `https://www.airbnb.com/rooms/${l.id}` : "")),
      };
    }).filter((it) => it.id && it.title);

    return json({
      items,
      total_results: data?.count ?? items.length,
      total_pages: data?.total_pages ?? null,
      page: data?.current_page ?? page,
    });
  } catch (e) {
    console.error("omkar-airbnb-search error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
