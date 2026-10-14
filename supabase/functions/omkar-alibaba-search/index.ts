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

const SORTS = new Set(["best_match", "price_low_to_high", "price_high_to_low", "orders", "newest"]);

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
    const supplierSlug = String(body?.supplier ?? "").trim().slice(0, 120);
    const page = Math.max(1, Math.min(50, Number(body?.page) || 1));
    if (!query && !supplierSlug) return json({ error: "query or supplier is required" }, 400);
    const f = body?.filters ?? {};

    const apiKey = (Deno.env.get("OMKAR_ALIBABA_API_KEY") || Deno.env.get("OMKAR_SHEIN_API_KEY") || Deno.env.get("OMKAR_API_KEY"))?.trim();
    if (!apiKey) return json({ error: "Alibaba API key not configured" }, 500);

    const url = new URL(
      supplierSlug
        ? "https://alibaba-scraper.omkar.cloud/suppliers/products"
        : "https://alibaba-scraper.omkar.cloud/products/search",
    );
    if (supplierSlug) {
      url.searchParams.set("supplier", supplierSlug);
      url.searchParams.set("page", String(page));
    } else {
      url.searchParams.set("query", query);
      url.searchParams.set("page", String(page));
      url.searchParams.set("currency", "USD");
      url.searchParams.set("sort_by", SORTS.has(f.sort_by) ? f.sort_by : "best_match");
      for (const k of ["trade_assurance", "verified_supplier", "verified_pro", "alibaba_guaranteed"]) {
        if (f[k] === true) url.searchParams.set(k, "true");
      }
      const dd = Number(f.delivery_days);
      if (Number.isFinite(dd) && dd > 0 && dd <= 60) url.searchParams.set("delivery_days", String(Math.round(dd)));
    }

    const r = await fetch(url, { headers: { "API-Key": apiKey } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.message || data?.error || `Alibaba search failed (${r.status})` }, 502);

    const items = (Array.isArray(data?.results) ? data.results : []).map((p: any) => {
      const images: string[] = Array.from(new Set([p?.image, ...(Array.isArray(p?.images) ? p.images : [])].filter(Boolean).map(String)));
      const min = num(p?.promotion_price?.min ?? p?.price?.min);
      const max = num(p?.price?.max);
      return {
        id: String(p?.id ?? crypto.randomUUID()),
        title: String(p?.title ?? "Alibaba product"),
        image: images[0] ?? null,
        images,
        price: min,
        original_price: max,
        currency: p?.price?.currency ?? "USD",
        rating: num(p?.rating?.product_score ?? p?.rating?.review_score ?? p?.review_score),
        orders_count: num(p?.sold_count ?? p?.sold_count_180d ?? p?.order_count),
        url: p?.link ?? null,
        moq: Math.max(1, Math.round(num(p?.moq?.quantity) ?? 1)),
        unit: p?.moq?.unit ?? "piece",
        supplier_name: p?.supplier?.name ?? null,
        ship_from: p?.supplier?.country_code ?? null,
      };
    });

    return json({ items, page: data?.current_page ?? page, total_pages: data?.total_pages ?? null });
  } catch (e) {
    console.error("alibaba search error", e);
    return json({ error: e instanceof Error ? e.message : "Search failed" }, 500);
  }
});
