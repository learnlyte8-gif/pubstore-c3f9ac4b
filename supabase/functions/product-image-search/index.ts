// Product image search: takes product titles and returns real e-commerce
// product photos (AliExpress / Alibaba / Amazon / eBay / Shopify CDNs, etc).
//
// Strategy, in order, until enough images are found per title:
//   1. Bing Images HTML (murl extraction) — biased to marketplace domains
//   2. DuckDuckGo Images JSON API (vqd token flow)
//   3. Google Shopping / Bing shopping-ish HTML fallback
//   4. Firecrawl search → scrape the top marketplace product page for images
//
// Only URLs hosted on known product-image CDNs are returned, so we do not
// fall back to generic stock/illustrative photos.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Hosts that serve real marketplace product photography.
const PRODUCT_CDN = [
  "alicdn.com",
  "aliexpress-media.com",
  "media-amazon.com",
  "ssl-images-amazon.com",
  "images-amazon.com",
  "ebayimg.com",
  "walmartimages.com",
  "etsystatic.com",
  "cdn.shopify.com",
  "shopifycdn.com",
  "susercontent.com", // Shopee
  "made-in-china.com",
  "dhresource.com", // DHgate
  "global-b2b-contents.com",
  "temu.com",
  "kwcdn.com", // Temu CDN
  "target.scene7.com",
  "assets.adidas.com",
  "static.nike.com",
  "cloudfront.net",
  "img.joomcdn.net",
];

const BAD_HINTS = [
  "logo",
  "sprite",
  "icon",
  "placeholder",
  "no-image",
  "noimage",
  "loading",
  "blank",
  "avatar",
  "banner",
  "captcha",
];

const STOP = new Set([
  "the", "and", "for", "with", "new", "hot", "sale", "free", "shipping", "pcs",
  "pieces", "set", "high", "quality", "wholesale", "original", "best", "pro",
]);

function isProductImage(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  let host = "";
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!PRODUCT_CDN.some((d) => host === d || host.endsWith("." + d))) return false;
  const low = u.toLowerCase();
  if (BAD_HINTS.some((b) => low.includes(b))) return false;
  if (!/\.(jpe?g|png|webp|avif)(\?|$|_)/i.test(low) && !low.includes("/images/")) {
    // AliExpress/Amazon URLs almost always carry an extension; allow amazon _AC_ style
    if (!/\.(jpe?g|png|webp)/i.test(low)) return false;
  }
  return true;
}

// Upgrade thumbnails to full-size where the CDN pattern is known.
function upgrade(u: string): string {
  let out = u;
  // AliExpress: strip _220x220.jpg_.webp style suffixes
  out = out.replace(/_\d+x\d+(q\d+)?(\.jpg|\.png|\.webp)?(_\.webp)?$/i, "");
  out = out.replace(/\.jpg_\d+x\d+.*$/i, ".jpg");
  // Amazon: normalise size modifiers to a large render
  out = out.replace(/\._[A-Z0-9_,]+_\.(jpe?g|png)$/i, ".$1");
  if (!/\.(jpe?g|png|webp|avif)/i.test(out)) out = u;
  return out;
}

function cleanQuery(title: string): string {
  return String(title || "")
    .replace(/[|/\\_()\[\]{}#*"'`~]+/g, " ")
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
    .slice(0, 9)
    .join(" ")
    .trim();
}

function decodeUrl(raw: string): string {
  return raw
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .trim();
}

function extractImageUrls(text: string, limit: number): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const decoded = decodeUrl(value);
    if (isProductImage(decoded) && !out.includes(decoded)) out.push(upgrade(decoded));
  };
  const meta = /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = meta.exec(text)) && out.length < limit) add(m[1]);
  const urls = /(?:https?:)?\\?\/\/[^"'\\\s<>]+/gi;
  while ((m = urls.exec(text)) && out.length < limit * 4) {
    const raw = m[0].startsWith("//") ? `https:${m[0]}` : m[0];
    add(raw.replace(/[),;]+$/, ""));
  }
  return out.slice(0, limit);
}

async function getText(url: string, headers: Record<string, string> = {}, ms = 9000): Promise<string | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...headers },
      signal: c.signal,
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function exactListingImages(sourceUrl: string, limit: number): Promise<string[]> {
  if (!/^https?:\/\//i.test(sourceUrl)) return [];
  const direct = await getText(sourceUrl, {}, 12000);
  if (direct) {
    const found = extractImageUrls(direct, limit);
    if (found.length >= Math.min(2, limit)) return found;
  }

  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return direct ? extractImageUrls(direct, limit) : [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl, formats: ["rawHtml"], onlyMainContent: false, waitFor: 2500 }),
    });
    if (!r.ok) return direct ? extractImageUrls(direct, limit) : [];
    const j = await r.json();
    const root = j?.data ?? j;
    return extractImageUrls(String(root?.rawHtml || root?.html || ""), limit);
  } catch {
    return direct ? extractImageUrls(direct, limit) : [];
  }
}

/** 1. Bing Images */
async function bingImages(q: string, limit: number): Promise<string[]> {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`;
  const html = await getText(url);
  if (!html) return [];
  const out: string[] = [];
  const re = /"murl":"(.*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].replace(/\\u002f/gi, "/").replace(/\\\//g, "/");
    if (isProductImage(raw)) {
      const u = upgrade(raw);
      if (!out.includes(u)) out.push(u);
    }
    if (out.length >= limit * 3) break;
  }
  return out;
}

/** 2. DuckDuckGo Images */
async function ddgImages(q: string, limit: number): Promise<string[]> {
  const seed = await getText(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`);
  const vqd = seed?.match(/vqd=["']?([\d-]+)["']?/)?.[1];
  if (!vqd) return [];
  const api =
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}` +
    `&vqd=${vqd}&f=,,,&p=1`;
  const body = await getText(api, { Referer: "https://duckduckgo.com/", Accept: "application/json" });
  if (!body) return [];
  let j: any = null;
  try { j = JSON.parse(body); } catch { return []; }
  const items: any[] = Array.isArray(j?.results) ? j.results : [];
  const out: string[] = [];
  for (const it of items) {
    const raw = it?.image || it?.thumbnail;
    if (typeof raw === "string" && isProductImage(raw)) {
      const u = upgrade(raw);
      if (!out.includes(u)) out.push(u);
    }
    if (out.length >= limit * 3) break;
  }
  return out;
}

/** 3. Direct marketplace listing pages (AliExpress / Amazon search HTML) */
async function marketplaceHtml(q: string, limit: number): Promise<string[]> {
  const targets = [
    `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(q.replace(/\s+/g, "-"))}.html`,
    `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  ];
  const out: string[] = [];
  for (const t of targets) {
    if (out.length >= limit * 2) break;
    const html = await getText(t);
    if (!html) continue;
    const re = /https?:\\?\/\\?\/[^"'\\\s)]+?\.(?:jpe?g|png|webp)/gi;
    const found = html.match(re) || [];
    for (const raw of found) {
      const u0 = raw.replace(/\\\//g, "/");
      if (!isProductImage(u0)) continue;
      const u = upgrade(u0);
      if (!out.includes(u)) out.push(u);
      if (out.length >= limit * 3) break;
    }
  }
  return out;
}

/** 4. Firecrawl: search marketplaces, scrape the best product page for images */
async function firecrawl(q: string, limit: number): Promise<string[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${q} (site:aliexpress.com OR site:alibaba.com OR site:amazon.com)`,
        limit: 2,
        scrapeOptions: { formats: ["html"] },
      }),
    });
    if (!r.ok) {
      console.error("firecrawl search failed", r.status, await r.text());
      return [];
    }
    const j = await r.json();
    const results: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.web) ? j.web : [];
    const out: string[] = [];
    for (const res of results) {
      const html: string = res?.html || res?.rawHtml || "";
      const found = html.match(/https?:\/\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi) || [];
      for (const raw of found) {
        if (!isProductImage(raw)) continue;
        const u = upgrade(raw);
        if (!out.includes(u)) out.push(u);
        if (out.length >= limit * 3) break;
      }
      if (out.length >= limit * 3) break;
    }
    return out;
  } catch (e) {
    console.error("firecrawl error", e);
    return [];
  }
}

type ImageQuery = { query: string; sourceUrl?: string | null; source?: string | null };

async function findImages(input: ImageQuery, limit: number): Promise<string[]> {
  const title = input.query;
  const base = cleanQuery(title) || String(title || "").slice(0, 80);
  const out: string[] = [];
  const push = (arr: string[]) => {
    for (const u of arr) {
      if (out.length >= limit) return;
      if (!out.includes(u)) out.push(u);
    }
  };

  // An exact source listing always wins: it is the only reliable way to
  // guarantee that the image belongs to this exact product, not a lookalike.
  if (input.sourceUrl) {
    push(await exactListingImages(input.sourceUrl, limit));
  }

  // Marketplace-biased queries are only a fallback when no exact listing was supplied.
  const source = String(input.source || "").toLowerCase();
  const preferred = source === "amazon" ? "amazon product" : source === "alibaba" ? "alibaba product" : source === "aliexpress" ? "aliexpress product" : "product";
  const queries = [`${base} ${preferred}`, `${base} wholesale product`, base];

  for (const q of queries) {
    if (out.length >= limit) break;
    try { push(await bingImages(q, limit)); } catch { /* next */ }
  }
  if (out.length < limit) {
    try { push(await ddgImages(`${base} aliexpress`, limit)); } catch { /* next */ }
  }
  if (out.length < limit) {
    try { push(await marketplaceHtml(base, limit)); } catch { /* next */ }
  }
  if (out.length < limit) {
    try { push(await firecrawl(base, limit)); } catch { /* next */ }
  }
  return out.slice(0, limit);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.queries) ? body.queries : [body?.query];
    const queries: ImageQuery[] = raw
      .map((q: unknown) => typeof q === "string" ? { query: q.trim() } : {
        query: String((q as Record<string, unknown>)?.query ?? (q as Record<string, unknown>)?.title ?? "").trim(),
        sourceUrl: typeof (q as Record<string, unknown>)?.sourceUrl === "string" ? (q as Record<string, unknown>).sourceUrl as string : null,
        source: typeof (q as Record<string, unknown>)?.source === "string" ? (q as Record<string, unknown>).source as string : null,
      })
      .filter((q) => Boolean(q.query))
      .slice(0, 40);
    if (!queries.length) return json({ error: "Provide queries: string[]" }, 400);

    const limit = Math.min(Math.max(Number(body?.limit) || 3, 1), 8);

    const results: { query: string; images: string[] }[] = [];
    // Small batches keep upstream sources happy.
    for (let i = 0; i < queries.length; i += 4) {
      const chunk = queries.slice(i, i + 4);
      const settled = await Promise.all(
        chunk.map(async (query: ImageQuery) => ({ query: query.query, images: await findImages(query, limit) }))
      );
      results.push(...settled);
    }

    return json({ results });
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
