// Edge function: scrape an Airbnb (or similar) stay URL and return a normalized
// stay payload for the supplier to review before saving. Same allow-list as
// import-product.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EMAILS = ["kukistacks8@gmail.com"];
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

type ExtractedStay = {
  title: string;
  kind: string; // b&b | hotel | apartment | factory_tour | retreat
  description: string;
  images: string[];
  city: string | null;
  country: string | null;
  price_per_night: number | null;
  currency: string | null;
  bedrooms: number | null;
  beds: number | null;
  baths: number | null;
  guests: number | null;
  amenities: string[];
  rating: number | null;
  review_count: number | null;
  superhost: boolean;
  source: string;
  source_url: string;
  source_id: string | null;
};

function detectSource(url: string): "airbnb" | "booking" | "vrbo" | "other" {
  const u = url.toLowerCase();
  if (u.includes("airbnb.")) return "airbnb";
  if (u.includes("booking.com")) return "booking";
  if (u.includes("vrbo.com")) return "vrbo";
  return "other";
}

function parseSourceId(url: string, source: string): string | null {
  try {
    if (source === "airbnb") {
      const m = url.match(/\/rooms\/(?:plus\/)?(\d+)/i);
      return m?.[1] ?? null;
    }
    if (source === "booking") {
      const m = url.match(/\/hotel\/[a-z]{2}\/([a-z0-9-]+)/i);
      return m?.[1] ?? null;
    }
    if (source === "vrbo") {
      const m = url.match(/\/(\d{6,})/);
      return m?.[1] ?? null;
    }
  } catch {
    /* noop */
  }
  return null;
}

async function scrapeWithFirecrawl(url: string) {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html"],
      onlyMainContent: true,
      waitFor: 2000,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("firecrawl error", res.status, data);
    throw new Error(`Scrape failed [${res.status}]: ${data?.error || "unknown"}`);
  }
  const root = data?.data ?? data;
  return {
    markdown: (root?.markdown as string) || "",
    html: (root?.html as string) || (root?.rawHtml as string) || "",
    metadata: root?.metadata || {},
  };
}

async function extractWithAI(params: {
  url: string;
  source: string;
  markdown: string;
  metadata: any;
}): Promise<Partial<ExtractedStay>> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

  const trimmed = params.markdown.slice(0, 18000);
  const system = `You extract structured stay/accommodation information from scraped Airbnb-style listing pages.
Return ONLY valid JSON matching the schema. Prices must be a number in the listing's currency (strip symbols).
"kind" must be one of: b&b, hotel, apartment, factory_tour, retreat. Choose the closest match.
If a field is unknown, use null (or an empty array for images/amenities).`;

  const user = `Source: ${params.source}
URL: ${params.url}
Page metadata: ${JSON.stringify(params.metadata).slice(0, 1500)}

Scraped markdown:
"""
${trimmed}
"""

Extract the stay listing.`;

  const tool = {
    type: "function",
    function: {
      name: "return_stay",
      description: "Return extracted stay data",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["b&b", "hotel", "apartment", "factory_tour", "retreat"] },
          description: { type: "string" },
          images: { type: "array", items: { type: "string" }, maxItems: 12 },
          city: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          price_per_night: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          bedrooms: { type: ["number", "null"] },
          beds: { type: ["number", "null"] },
          baths: { type: ["number", "null"] },
          guests: { type: ["number", "null"] },
          amenities: { type: "array", items: { type: "string" }, maxItems: 30 },
          rating: { type: ["number", "null"] },
          review_count: { type: ["number", "null"] },
          superhost: { type: "boolean" },
        },
        required: ["title", "kind", "description", "images", "amenities", "superhost"],
      },
    },
  };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "return_stay" } },
    }),
  });

  const j = await r.json();
  if (!r.ok) {
    console.error("AI extract error", r.status, j);
    throw new Error(`AI extraction failed [${r.status}]`);
  }
  const call = j?.choices?.[0]?.message?.tool_calls?.[0];
  const args = call?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  try {
    return JSON.parse(args);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const email = (userRes.user.email || "").toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      return json({ error: "This feature is in private beta." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const url: string = (body?.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return json({ error: "Please provide a valid http(s) URL." }, 400);
    }

    const source = detectSource(url);
    const source_id = parseSourceId(url, source);

    let stay: ExtractedStay | null = null;

    // Prefer omkar.cloud's Airbnb Scraper API for Airbnb URLs — real-time,
    // structured data without AI extraction guesswork.
    if (source === "airbnb" && source_id) {
      const omkarKey = Deno.env.get("OMKAR_API_KEY");
      if (!omkarKey) return json({ error: "OMKAR_API_KEY not configured" }, 500);

      const detailsUrl = new URL("https://airbnb-scraper-api.omkar.cloud/airbnb/listings/details");
      detailsUrl.searchParams.set("stay_id", source_id);
      detailsUrl.searchParams.set("currency_code", "USD");

      const r = await fetch(detailsUrl.toString(), {
        headers: { "API-Key": omkarKey, Accept: "application/json" },
      });
      const text = await r.text();
      if (!r.ok) {
        console.error("omkar airbnb error", r.status, text.slice(0, 500));
        return json({ error: `Airbnb fetch failed (${r.status})` }, 502);
      }
      let d: any;
      try { d = JSON.parse(text); } catch { return json({ error: "Invalid Airbnb response" }, 502); }

      const loc = String(d?.location ?? "");
      const parts = loc.split(",").map((s: string) => s.trim()).filter(Boolean);
      const city = parts[0] ?? null;
      const country = parts.length > 1 ? parts[parts.length - 1] : null;
      const rate = typeof d?.pricing?.rate === "number" ? d.pricing.rate : null;
      const total = typeof d?.pricing?.total === "number" ? d.pricing.total : null;
      const nights = (() => {
        const q = String(d?.pricing?.qualifier ?? "");
        const m = q.match(/(\d+)\s*night/i);
        return m ? parseInt(m[1], 10) : null;
      })();
      const nightly = nights && total ? Math.round((total / nights) * 100) / 100 : rate;

      const propType = String(d?.property_type ?? "").toLowerCase();
      const kind: ExtractedStay["kind"] =
        propType.includes("hotel") ? "hotel" :
        propType.includes("b&b") || propType.includes("bed and breakfast") ? "b&b" :
        "apartment";

      const highlights: string[] = Array.isArray(d?.highlights) ? d.highlights : [];
      const guests = typeof d?.guest_capacity === "number" ? d.guest_capacity : null;
      const bedsMatch = highlights.map((h) => h.match(/(\d+)\s*bed(?!room)/i)).find(Boolean);
      const bathMatch = highlights.map((h) => h.match(/(\d+)\s*bath/i)).find(Boolean);
      const bedroomMatch = highlights.map((h) => h.match(/(\d+)\s*bedroom/i)).find(Boolean);

      stay = {
        title: String(d?.title || "Airbnb stay").slice(0, 200),
        kind,
        description: [d?.tagline, ...(highlights || [])].filter(Boolean).join("\n").slice(0, 4000),
        images: Array.isArray(d?.photos) ? d.photos.filter(Boolean).slice(0, 12) : [],
        city,
        country,
        price_per_night: nightly ?? null,
        currency: String(d?.pricing?.currency ?? "USD"),
        bedrooms: bedroomMatch ? parseInt(bedroomMatch[1], 10) : null,
        beds: bedsMatch ? parseInt(bedsMatch[1], 10) : null,
        baths: bathMatch ? parseInt(bathMatch[1], 10) : null,
        guests,
        amenities: highlights.slice(0, 30),
        rating: typeof d?.overall_rating === "number" ? d.overall_rating : null,
        review_count: typeof d?.review_count === "number" ? d.review_count : null,
        superhost: d?.is_superhost === true,
        source,
        source_url: url,
        source_id,
      };
    } else {
      // Fallback: Firecrawl + AI extraction for booking / vrbo / other.
      const scraped = await scrapeWithFirecrawl(url);
      if (!scraped) return json({ error: "Could not load that page." }, 502);

      const extracted = await extractWithAI({
        url,
        source,
        markdown: scraped.markdown,
        metadata: scraped.metadata,
      });

      stay = {
        title: String(extracted.title || scraped.metadata?.title || "Imported stay").slice(0, 200),
        kind: (extracted.kind as string) || "apartment",
        description: String(extracted.description || "").slice(0, 4000),
        images: Array.isArray(extracted.images) ? extracted.images.filter(Boolean).slice(0, 12) : [],
        city: extracted.city ?? null,
        country: extracted.country ?? null,
        price_per_night:
          typeof extracted.price_per_night === "number" ? extracted.price_per_night : null,
        currency: extracted.currency ?? null,
        bedrooms: typeof extracted.bedrooms === "number" ? extracted.bedrooms : null,
        beds: typeof extracted.beds === "number" ? extracted.beds : null,
        baths: typeof extracted.baths === "number" ? extracted.baths : null,
        guests: typeof extracted.guests === "number" ? extracted.guests : null,
        amenities: Array.isArray(extracted.amenities) ? extracted.amenities.filter(Boolean).slice(0, 30) : [],
        rating: typeof extracted.rating === "number" ? extracted.rating : null,
        review_count: typeof extracted.review_count === "number" ? extracted.review_count : null,
        superhost: extracted.superhost === true,
        source,
        source_url: url,
        source_id,
      };
    }

    return json({ stay });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json({ error: msg }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
