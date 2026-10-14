import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: ue } = await sb.auth.getUser();
    if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim().slice(0, 200);
    const page = Math.max(1, Math.min(50, Number(body?.page) || 1));
    if (!query) return json({ error: "query is required" }, 400);

    const apiKey = (Deno.env.get("OMKAR_GOOGLE_SHOPPING_API_KEY") || Deno.env.get("OMKAR_API_KEY") || Deno.env.get("OMKAR_SHEIN_API_KEY"))?.trim();
    if (!apiKey) return json({ error: "Google Shopping API key not configured" }, 500);

    const url = new URL("https://google-shopping-scraper.omkar.cloud/search");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    // Zimbabwean results
    url.searchParams.set("gl", "zw");
    url.searchParams.set("hl", "en");

    const r = await fetch(url, { headers: { "API-Key": apiKey } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.message || data?.error || `Google Shopping search failed (${r.status})` }, 502);

    const raw: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data?.products) ? data.products : [];
    const items = raw.map((p: any) => {
      const images: string[] = Array.from(new Set(
        [p?.image, p?.thumbnail, ...(Array.isArray(p?.images) ? p.images : [])].filter(Boolean).map(String),
      ));
      const price = num(p?.price?.amount ?? p?.price ?? p?.extracted_price ?? p?.sale_price);
      const original = num(p?.original_price?.amount ?? p?.original_price ?? p?.compare_at_price);
      return {
        id: String(p?.id ?? p?.product_id ?? p?.position ?? crypto.randomUUID()),
        title: String(p?.title ?? p?.name ?? "Google Shopping product"),
        image: images[0] ?? null,
        images,
        price,
        original_price: original && price && original > price ? original : null,
        currency: p?.price?.currency ?? p?.currency ?? "USD",
        rating: num(p?.rating),
        orders_count: num(p?.reviews ?? p?.reviews_count),
        url: p?.link ?? p?.url ?? null,
        moq: 1,
        unit: "piece",
        supplier_name: p?.seller ?? p?.store ?? p?.merchant ?? null,
        ship_from: p?.seller_location ?? "Zimbabwe",
        delivery: p?.delivery ?? p?.shipping ?? null,
      };
    });

    return json({ items, page: data?.current_page ?? page, total_pages: data?.total_pages ?? null });
  } catch (e) {
    console.error("google shopping search error", e);
    return json({ error: e instanceof Error ? e.message : "Search failed" }, 500);
  }
});
