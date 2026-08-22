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

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type AliDetail = {
  id: string;
  title: string | null;
  images: string[];
  video_url: string | null;
  description: string | null;
  specs: Record<string, string>;
  price: number | null;
  original_price: number | null;
  currency: string | null;
  rating: number | null;
  orders_count: number | null;
  brand: string | null;
  ship_from: string | null;
  variants: string[];
  url: string;
};

function normalizeImage(url: unknown): string {
  let v = absoluteUrl(url);
  if (!v) return "";
  // Strip AliExpress thumbnail suffixes (e.g. _220x220q75.jpg_.webp) to get full size
  v = v.replace(/_\d+x\d+[^/]*?(\.(jpg|jpeg|png|webp))?(_\.webp)?$/i, "");
  if (!/\.(jpg|jpeg|png|webp|avif)$/i.test(v)) v = `${v}.jpg`;
  return v;
}

function looksBlocked(html: string): boolean {
  if (!html || html.length < 20000) return true;
  return /_____tmd_____|punish\?x5secdata|rgv587_flag|captcha/i.test(html.slice(0, 4000));
}

// Omkar has a dedicated product endpoint; path naming has varied, so try a few.
async function omkarDetail(id: string, url: string): Promise<any | null> {
  const apiKey = Deno.env.get("OMKAR_API_KEY");
  if (!apiKey || (!id && !url)) return null;
  const base = "https://aliexpress-scraper-api.omkar.cloud/aliexpress";
  const candidates = [
    `${base}/product?product_id=${encodeURIComponent(id)}`,
    `${base}/product?product_id=${encodeURIComponent(id)}&country=US&currency=USD`,
  ];

  for (const c of candidates) {
    try {
      const r = await fetch(c, { headers: { "API-Key": apiKey, Accept: "application/json" } });
      const text = await r.text();
      if (!r.ok) { console.log("omkar detail miss", c.split("?")[0], r.status, text.slice(0, 160)); continue; }
      const j = JSON.parse(text);
      const node = j?.data ?? j?.product ?? j;
      if (node && typeof node === "object") return node;
    } catch (e) {
      console.log("omkar detail error", c.split("?")[0], (e as Error).message);
    }
  }
  return null;
}

// Firecrawl can render past AliExpress' anti-bot wall and give us the real HTML.
async function firecrawlHtml(url: string): Promise<string> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return "";
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, waitFor: 3000 }),
    });
    const j = await r.json();
    if (!r.ok) { console.error("firecrawl detail error", r.status, JSON.stringify(j).slice(0, 300)); return ""; }
    const root = j?.data ?? j;
    return String(root?.rawHtml || root?.html || "");
  } catch (e) {
    console.error("firecrawl detail fetch error", (e as Error).message);
    return "";
  }
}

// Collect image urls out of any nested Omkar detail payload.
function harvestImages(node: unknown, out: string[], depth = 0) {
  if (depth > 6 || out.length > 40) return;
  if (typeof node === "string") {
    if (/^(https?:)?\/\/.*(alicdn|aliexpress)\..*\.(jpg|jpeg|png|webp|avif)/i.test(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) { node.forEach((n) => harvestImages(n, out, depth + 1)); return; }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) harvestImages(v, out, depth + 1);
  }
}

async function scrapeAliExpressDetail(rawId: string, rawUrl: string): Promise<AliDetail> {
  const id = String(rawId || "").replace(/[^0-9]/g, "");
  const url = rawUrl || (id ? `https://www.aliexpress.com/item/${id}.html` : "");
  if (!url) throw new Error("id or url is required");

  // Omkar's product API is the reliable source — AliExpress blocks direct fetches
  // with a captcha wall, which is why only the search thumbnail used to survive.
  const omkarEarly = await omkarDetail(id, url);

  let html = "";
  if (!omkarEarly) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "aep_usuc_f=site=glo&c_tp=USD&region=US&b_locale=en_US",
          "User-Agent": UA,
        },
      });
      html = await r.text();
    } catch { /* fall through */ }

    if (looksBlocked(html)) {
      console.log("direct aliexpress fetch blocked, using firecrawl", id);
      const fc = await firecrawlHtml(url);
      if (fc) html = fc;
    }
  }

  const omkarSpecs: Record<string, string> = {};





  const imageSet: string[] = [];
  const pushImg = (u: unknown) => {
    const v = normalizeImage(u);
    if (v && !imageSet.includes(v)) imageSet.push(v);
  };

  // Primary gallery sources
  const imagePathList = findJsonValue(html, "imagePathList");
  if (Array.isArray(imagePathList)) imagePathList.forEach(pushImg);
  const summImagePathList = findJsonValue(html, "summImagePathList");
  if (Array.isArray(summImagePathList)) summImagePathList.forEach(pushImg);
  const imageModule = findJsonValue(html, "imageModule") as any;
  if (Array.isArray(imageModule?.imagePathList)) imageModule.imagePathList.forEach(pushImg);

  // SKU / variant images
  const skuModule = findJsonValue(html, "skuModule") as any;
  const variants: string[] = [];
  const skuProps = skuModule?.productSKUPropertyList ?? findJsonValue(html, "skuProperties");
  if (Array.isArray(skuProps)) {
    for (const prop of skuProps) {
      const values = prop?.skuPropertyValues ?? prop?.values ?? [];
      if (!Array.isArray(values)) continue;
      for (const v of values) {
        if (v?.skuPropertyImagePath) pushImg(v.skuPropertyImagePath);
        const label = String(v?.propertyValueDisplayName ?? v?.propertyValueName ?? "").trim();
        if (label && !variants.includes(label)) variants.push(label);
      }
    }
  }

  // Fallback: harvest every alicdn image on the page
  if (imageSet.length < 3) {
    const matches = html.match(/https?:\/\/[a-z0-9.\-]*alicdn\.com\/[^"'\\\s)]+\.(?:jpg|jpeg|png|webp)/gi) ?? [];
    for (const m of matches) {
      if (/(logo|icon|avatar|placeholder|sprite)/i.test(m)) continue;
      pushImg(m);
      if (imageSet.length >= 20) break;
    }
  }

  // Harvest every image the Omkar product payload contains.
  let omkar: any = omkarEarly;
  if (imageSet.length < 2 && !omkar) omkar = await omkarDetail(id, url);
  if (omkar) {
    const found: string[] = [];
    harvestImages(omkar, found);
    found.forEach(pushImg);
    // Specs from the API payload
    const apiSpecs = omkar.specs ?? omkar.specifications ?? omkar.attributes;
    if (Array.isArray(apiSpecs)) {
      for (const p of apiSpecs) {
        const k = String(p?.name ?? p?.attrName ?? p?.key ?? "").trim();
        const v = String(p?.value ?? p?.attrValue ?? "").trim();
        if (k && v) omkarSpecs[k.slice(0, 60)] = v.slice(0, 200);
      }
    } else if (apiSpecs && typeof apiSpecs === "object") {
      for (const [k, v] of Object.entries(apiSpecs)) {
        if (k && v != null) omkarSpecs[k.slice(0, 60)] = String(v).slice(0, 200);
      }
    }
  }



  // Video
  let video_url: string | null = null;
  const videoId = findJsonValue(html, "videoModule") as any;
  const vId = videoId?.videoId ?? videoId?.mediaId;
  const vUid = videoId?.videoUid ?? videoId?.uid;
  if (vId && vUid) video_url = `https://cloud.video.taobao.com/play/u/${vUid}/p/1/e/6/t/1/${vId}.mp4`;
  if (!video_url) {
    const mp4 = html.match(/https?:\/\/[^"'\\\s]+\.mp4/i);
    if (mp4) video_url = mp4[0];
  }

  // Specs
  const specs: Record<string, string> = { ...omkarSpecs };
  const specsModule = findJsonValue(html, "specsModule") as any;
  const specProps = specsModule?.props ?? findJsonValue(html, "specs");
  if (Array.isArray(specProps)) {
    for (const p of specProps) {
      const k = String(p?.attrName ?? p?.name ?? "").trim();
      const v = String(p?.attrValue ?? p?.value ?? "").trim();
      if (k && v) specs[k.slice(0, 60)] = v.slice(0, 200);
    }
  }


  // Title / price / rating
  const titleModule = findJsonValue(html, "titleModule") as any;
  const priceModule = findJsonValue(html, "priceModule") as any;
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const title = String(titleModule?.subject ?? findJsonValue(html, "subject") ?? ogTitle ?? omkar?.title ?? "").trim() || null;

  const salePrice = priceModule?.formatedActivityPrice ?? priceModule?.formatedPrice
    ?? (priceModule?.minActivityAmount ?? priceModule?.minAmount)?.value
    ?? omkar?.price ?? omkar?.sale_price;
  const origPrice = (priceModule?.maxAmount ?? priceModule?.minAmount)?.value ?? priceModule?.formatedPrice
    ?? omkar?.original_price;

  if (!video_url && typeof omkar?.video_url === "string") video_url = omkar.video_url;

  const description = [
    title,
    Object.entries(specs).slice(0, 20).map(([k, v]) => `• ${k}: ${v}`).join("\n"),
    typeof omkar?.description === "string" ? omkar.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "",
    url ? `Source: ${url}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 4000) || null;

  return {
    id: id || String(findJsonValue(html, "productId") ?? ""),
    title,
    images: imageSet.slice(0, 20),
    video_url,
    description,
    specs,
    price: toNum(salePrice),
    original_price: toNum(origPrice),
    currency: String(priceModule?.currencyCode ?? omkar?.currency ?? "USD"),
    rating: toNum((findJsonValue(html, "titleModule") as any)?.feedbackRating?.averageStar ?? omkar?.rating),
    orders_count: parseOrders(titleModule?.tradeCount ?? titleModule?.formatTradeCount ?? omkar?.orders_count),
    brand: specs["Brand Name"] ?? specs["Brand"] ?? null,
    ship_from: specs["Ships From"] ?? specs["Origin"] ?? null,
    variants: variants.slice(0, 40),
    url,
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
    const action = String(body?.action ?? "search");

    if (action === "detail") {
      try {
        const detail = await scrapeAliExpressDetail(String(body?.id ?? ""), String(body?.url ?? ""));
        return json({ detail });
      } catch (e) {
        console.error("ali detail error", e);
        return json({ error: (e as Error).message || "Detail scrape failed" }, 502);
      }
    }

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
