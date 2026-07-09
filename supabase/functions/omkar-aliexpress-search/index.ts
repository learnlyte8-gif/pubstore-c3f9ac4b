// Proxy to omkar.cloud AliExpress Scraper API — protects the API key
// and lets the client search AliExpress by keyword.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EMAILS = ["kukistacks8@gmail.com"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const email = (userRes.user.email || "").toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      return json({ error: "This feature is in private beta." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || "").trim();
    const page = Math.max(1, Math.min(50, Number(body?.page) || 1));
    if (!query) return json({ error: "Please provide a search query." }, 400);

    const apiKey = Deno.env.get("OMKAR_API_KEY");
    if (!apiKey) return json({ error: "OMKAR_API_KEY is not configured." }, 500);

    const url = new URL("https://aliexpress-scraper-api.omkar.cloud/aliexpress/search");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));

    const r = await fetch(url.toString(), { headers: { "API-Key": apiKey } });
    const text = await r.text();
    if (!r.ok) {
      console.error("omkar error", r.status, text.slice(0, 500));
      return json({ error: `Search failed [${r.status}]`, details: text.slice(0, 400) }, r.status);
    }
    const data = JSON.parse(text);
    const results = Array.isArray(data?.results) ? data.results : [];
    const items = results.map((p: any) => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? "Untitled"),
      image: p.image_url ?? null,
      price: p.price != null ? Number(p.price) : null,
      original_price: p.original_price != null ? Number(p.original_price) : null,
      currency: p.currency ?? "USD",
      rating: p.rating ?? null,
      orders_count: p.orders_count ?? null,
      url: p.id ? `https://www.aliexpress.com/item/${p.id}.html` : null,
    }));

    return json({
      items,
      page: data?.current_page ?? page,
      total_pages: data?.total_pages ?? 1,
      count: data?.count ?? items.length,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
