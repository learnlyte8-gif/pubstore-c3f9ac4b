import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

const bigImg = (u: string) => u.replace(/_thumbnail_\d+x\d+/, "");

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

    const apiKey = (Deno.env.get("OMKAR_SHEIN_API_KEY") || Deno.env.get("OMKAR_API_KEY"))?.trim();
    if (!apiKey) return json({ error: "SHEIN API key not configured" }, 500);

    const url = new URL("https://shein-scraper.omkar.cloud/search/products");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    const r = await fetch(url, { headers: { "API-Key": apiKey } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.message || data?.error || `SHEIN search failed (${r.status})` }, 502);

    const items = (Array.isArray(data?.results) ? data.results : []).map((p: any) => {
      const sale = num(p?.pricing?.sale_price?.amount_usd ?? p?.pricing?.sale_price?.amount);
      const retail = num(p?.pricing?.retail_price?.amount_usd ?? p?.pricing?.retail_price?.amount);
      const images: string[] = Array.from(new Set(
        [p?.image, ...(Array.isArray(p?.images) ? p.images : [])].filter(Boolean).map((x: string) => bigImg(String(x))),
      ));
      return {
        id: String(p?.goods_id ?? p?.sku ?? crypto.randomUUID()),
        title: String(p?.name ?? "SHEIN product"),
        image: images[0] ?? null,
        images,
        price: sale ?? retail,
        original_price: retail,
        currency: "USD",
        rating: num(p?.rating),
        orders_count: num(p?.reviews_count),
        url: p?.link ?? null,
        category: p?.category?.name ?? null,
      };
    });

    return json({ items, page: data?.current_page ?? page, total_pages: data?.total_pages ?? null });
  } catch (e) {
    console.error("shein search error", e);
    return json({ error: e instanceof Error ? e.message : "Search failed" }, 500);
  }
});
