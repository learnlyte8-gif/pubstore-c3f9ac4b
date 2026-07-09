import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" },
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
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function absoluteUrl(url: unknown): string {
  const value = String(url ?? "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function parseOrders(value: unknown): number | null {
  const text = String(value ?? "").toLowerCase();
  if (!text) return null;
  const match = text.match(/[\d.,]+/);
  if (!match) return null;
  const base = toNum(match[0]);
  if (base == null) return null;
  return Math.round(base * (text.includes("k") ? 1000 : 1));
}

function findJsonValue(source: string, key: string): unknown | null {
  const keyIndex = source.indexOf(`"${key}"`);
  if (keyIndex < 0) return null;
  const colonIndex = source.indexOf(":", keyIndex);
  if (colonIndex < 0) return null;

  let start = colonIndex + 1;
  while (/\s/.test(source[start] ?? "")) start++;

  const opener = source[start];
  const closer = opener === "{" ? "}" : opener === "[" ? "]" : "";
  if (!closer) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      const last = stack.pop();
      if ((ch === "}" && last !== "{") || (ch === "]" && last !== "[")) return null;
      if (stack.length === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function normalizeOmkarItems(data: any, page: number): { items: AliItem[]; meta: Record<string, unknown> } {
  const results: any[] = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return {
    items: results.map((p) => {
      const id = String(p?.id ?? p?.product_id ?? p?.productId ?? "");
      const price = toNum(p?.price ?? p?.sale_price ?? p?.salePrice ?? p?.min_price);
      return {
        id,
        title: String(p?.title ?? p?.name ?? ""),
        image: absoluteUrl(p?.image_url ?? p?.image ?? p?.img_url),
        price,
        original_price: toNum(p?.original_price ?? p?.originalPrice),
        currency: String(p?.currency ?? p?.currencyCode ?? "USD"),
        rating: toNum(p?.rating ?? p?.star_rating),
        orders_count: toNum(p?.orders_count ?? p?.orders) ?? parseOrders(p?.tradeDesc),
        url: String(p?.url ?? p?.product_url ?? (id ? `https://www.aliexpress.com/item/${id}.html` : "")),
      };
    }).filter((item) => item.id && item.title),
    meta: {
      count: data?.count,
      per_page: data?.per_page,
      current_page: data?.current_page ?? data?.page ?? page,
      total_pages: data?.total_pages,
      has_next: !!(data?.next ?? data?.has_next),
    },
  };
}

async function scrapeAliExpressSearch(query: string, page: number): Promise<{ items: AliItem[]; meta: Record<string, unknown> }> {
  const slug = encodeURIComponent(query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || query);
  const url = new URL(`https://www.aliexpress.com/w/wholesale-${slug}.html`);
  url.searchParams.set("SearchText", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("g", "y");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": "aep_usuc_f=site=glo&c_tp=USD&region=US&b_locale=en_US",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  const html = await response.text();
  if (!response.ok) throw new Error(`AliExpress fallback failed (${response.status})`);

  const itemList = findJsonValue(html, "itemList") as { content?: any[] } | null;
  const content = Array.isArray(itemList?.content) ? itemList.content : [];
  const searchResult = findJsonValue(html, "searchResult") as Record<string, unknown> | null;

  const items: AliItem[] = content.map((p) => {
    const id = String(p?.productId ?? p?.redirectedId ?? "");
    const sale = p?.prices?.salePrice;
    const original = p?.prices?.originalPrice;
    return {
      id,
      title: String(p?.title?.displayTitle ?? p?.title?.seoTitle ?? ""),
      image: absoluteUrl(p?.image?.imgUrl ?? p?.images?.[0]?.imgUrl),
      price: toNum(sale?.minPrice ?? sale?.formattedPrice),
      original_price: toNum(original?.minPrice ?? original?.formattedPrice),
      currency: String(sale?.currencyCode ?? original?.currencyCode ?? "USD"),
      rating: toNum(p?.evaluation?.starRating),
      orders_count: parseOrders(p?.trade?.tradeDesc),
      url: id ? `https://www.aliexpress.com/item/${id}.html` : "",
    };
  }).filter((item) => item.id && item.title);

  return {
    items,
    meta: {
      count: searchResult?.totalResults ?? items.length,
      per_page: searchResult?.pageSize ?? items.length,
      current_page: searchResult?.page ?? page,
      total_pages: searchResult?.totalResults && searchResult?.pageSize
        ? Math.ceil(Number(searchResult.totalResults) / Number(searchResult.pageSize))
        : undefined,
      has_next: items.length > 0,
      source: "aliexpress-fallback",
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" } });

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

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim();
    const page = Math.max(1, parseInt(String(body?.page ?? 1), 10) || 1);
    if (!query) return json({ error: "query is required" }, 400);

    let data: any;
    const apiKey = Deno.env.get("OMKAR_API_KEY");
    if (apiKey) {
      const url = new URL("https://aliexpress-scraper-api.omkar.cloud/aliexpress/search");
      url.searchParams.set("query", query);
      url.searchParams.set("page", String(page));

      try {
        const r = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "API-Key": apiKey,
            "Accept": "application/json",
          },
        });

        const text = await r.text();
        if (r.ok) {
          try {
            data = JSON.parse(text);
          } catch {
            console.error("Failed to parse Omkar JSON:", text.slice(0, 500));
          }
        } else {
          console.error("omkar error", r.status, text.slice(0, 500));
        }
      } catch (omkarFetchError) {
        console.error("omkar fetch error", omkarFetchError);
      }
    } else {
      console.error("OMKAR_API_KEY not configured; using AliExpress fallback");
    }

    let { items, meta } = data ? normalizeOmkarItems(data, page) : { items: [] as AliItem[], meta: {} as Record<string, unknown> };
    if (items.length === 0) {
      try {
        const fallback = await scrapeAliExpressSearch(query, page);
        items = fallback.items;
        meta = fallback.meta;
      } catch (fallbackError) {
        console.error("aliexpress fallback error", fallbackError);
      }
    }

    if (items.length === 0) {
      return json({ error: "Search failed — no products returned" }, 502);
    }

    return json({
      items,
      count: meta.count ?? items.length,
      per_page: meta.per_page ?? items.length,
      current_page: meta.current_page ?? page,
      page: meta.current_page ?? page,
      total_pages: meta.total_pages ?? 1,
      has_next: meta.has_next ?? true,
      source: meta.source ?? "omkar",
    });
  } catch (e) {
    console.error("omkar-aliexpress-search error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
