import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AliItem = {
  id: string;
  title: string;
  image: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  rating: number | null;
  orders_count: number | null;
  url: string;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("OMKAR_API_KEY");
    if (!apiKey) return json({ error: "OMKAR_API_KEY not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim();
    const page = Math.max(1, parseInt(String(body?.page ?? 1), 10) || 1);
    if (!query) return json({ error: "query is required" }, 400);

    const url = new URL("https://aliexpress-scraper-api.omkar.cloud/aliexpress/search");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "API-Key": apiKey,
        "Accept": "application/json",
      },
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("omkar error", r.status, text.slice(0, 500));
      return json(
        { error: `Search failed [${r.status}]`, details: text.slice(0, 400) },
        r.status,
      );
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Failed to parse JSON:", text.slice(0, 500));
      return json({ error: "Invalid response from scraper vendor" }, 502);
    }

    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const items: AliItem[] = results.map((p) => {
      const id = String(p?.id ?? "");
      return {
        id,
        title: String(p?.title ?? ""),
        image: String(p?.image_url ?? ""),
        price: toNum(p?.price),
        original_price: toNum(p?.original_price),
        currency: String(p?.currency ?? "USD"),
        rating: toNum(p?.rating),
        orders_count: toNum(p?.orders_count),
        url: id
          ? `https://www.aliexpress.com/item/${id}.html`
          : "",
      };
    });

    return json({
      items,
      count: data?.count ?? items.length,
      per_page: data?.per_page ?? items.length,
      current_page: data?.current_page ?? page,
      total_pages: data?.total_pages ?? 1,
      has_next: !!data?.next,
    });
  } catch (e) {
    console.error("omkar-aliexpress-search error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
