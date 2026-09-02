// Edge function: scrape a product URL (Shopify / Amazon / Alibaba / AliExpress)
// and return a normalized product payload for the supplier to review.
// Gated to a specific allow-listed email.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EMAILS = ["kukistacks8@gmail.com"];
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

type Extracted = {
  title: string;
  price: number | null;
  original_price: number | null;
  currency: string | null;
  description: string;
  images: string[];
  source: string;
  source_url: string;
  moq?: number | null;
  unit?: string | null;
  category_slug?: string | null;
};

async function fetchCategorySlugs(): Promise<string[]> {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const r = await fetch(`${url}/rest/v1/categories?select=slug&order=sort_order.asc`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows.map((x: any) => x.slug).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Cheap keyword fallback when AI doesn't return a category.
function guessCategoryFromText(text: string, slugs: string[]): string | null {
  if (!slugs.length) return null;
  const t = (text || "").toLowerCase();
  // Direct slug or slug-words match
  for (const s of slugs) {
    const tokens = s.split(/[-_]+/).filter(Boolean);
    if (tokens.every((tok) => t.includes(tok))) return s;
  }
  return null;
}

function detectSource(url: string): "shopify" | "amazon" | "alibaba" | "aliexpress" | "other" {
  const u = url.toLowerCase();
  if (u.includes("amazon.")) return "amazon";
  if (u.includes("alibaba.")) return "alibaba";
  if (u.includes("aliexpress.")) return "aliexpress";
  // crude: most Shopify stores expose /products/<handle>
  if (/\/products\/[a-z0-9-]+/i.test(url)) return "shopify";
  return "other";
}

// Try the public Shopify JSON endpoint — zero-scrape, cheapest & most reliable.
async function tryShopifyJson(url: string): Promise<Extracted | null> {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/products\/([^/?#]+)/i);
    if (!m) return null;
    const handle = m[1];
    const jsonUrl = `${u.origin}/products/${handle}.json`;
    const r = await fetch(jsonUrl, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const p = j?.product;
    if (!p) return null;
    const variant = p.variants?.[0];
    const price = variant?.price ? Number(variant.price) : null;
    const compare = variant?.compare_at_price ? Number(variant.compare_at_price) : null;
    const images: string[] = (p.images || []).map((i: any) => i.src).filter(Boolean);
    const stripHtml = (s: string) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      title: p.title || "Imported product",
      price,
      original_price: compare && compare > (price || 0) ? compare : null,
      currency: null,
      description: stripHtml(p.body_html || "").slice(0, 2000),
      images: images.slice(0, 6),
      source: "shopify",
      source_url: url,
    };
  } catch {
    return null;
  }
}

function extractMarketplaceImages(html: string): string[] {
  const hosts = ["alicdn.com", "aliexpress-media.com", "media-amazon.com", "ssl-images-amazon.com", "images-amazon.com", "sc04.alicdn.com", "ebayimg.com", "walmartimages.com", "cdn.shopify.com", "shopifycdn.com", "made-in-china.com", "dhresource.com"];
  const bad = /(logo|icon|sprite|placeholder|no-image|avatar|banner|captcha|loading)/i;
  const out: string[] = [];
  const add = (raw: string) => {
    const value = raw.replace(/\\u002f/gi, "/").replace(/\\\//g, "/").replace(/&amp;/gi, "&");
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (!hosts.some((d) => host === d || host.endsWith(`.${d}`)) || bad.test(value)) return;
      if (!/\.(jpe?g|png|webp|avif)(\?|$|_)/i.test(value)) return;
      if (!out.includes(value)) out.push(value);
    } catch { /* ignore malformed page values */ }
  };
  const re = /https?:\/\/[^"'\\\s<>]+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && out.length < 20) add(match[0].replace(/[),;]+$/, ""));
  return out;
}

async function scrapeWithFirecrawl(url: string): Promise<{ markdown: string; html: string; metadata: any; screenshot?: string } | null> {
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
      waitFor: 1500,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("firecrawl error", res.status, data);
    throw new Error(`Scrape failed [${res.status}]: ${data?.error || "unknown"}`);
  }
  // v2 returns fields directly OR under data depending on version
  const root = data?.data ?? data;
  return {
    markdown: root?.markdown || "",
    html: root?.html || root?.rawHtml || "",
    metadata: root?.metadata || {},
  };
}

// Ask Lovable AI to pull structured fields from the scraped content.
async function extractWithAI(params: {
  url: string;
  source: string;
  markdown: string;
  html: string;
  metadata: any;
  categorySlugs: string[];
}): Promise<Partial<Extracted>> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

  const trimmed = params.markdown.slice(0, 18000);
  const catList = params.categorySlugs.length
    ? `\nAllowed category slugs (pick the single best fit, or null if none clearly fit): ${params.categorySlugs.join(", ")}`
    : "";
  const system = `You extract structured product information from scraped e-commerce pages.
Return ONLY valid JSON matching the schema. Price must be a number in the listing's currency (strip symbols). If a field is unknown, use null.${catList}`;

  const user = `Source: ${params.source}
URL: ${params.url}
Page metadata: ${JSON.stringify(params.metadata).slice(0, 1500)}

Scraped markdown:
"""
${trimmed}
"""

Extract the product.`;

  const tool = {
    type: "function",
    function: {
      name: "return_product",
      description: "Return extracted product data",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          price: { type: ["number", "null"] },
          original_price: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          description: { type: "string" },
          images: { type: "array", items: { type: "string" }, maxItems: 8 },
          moq: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          category_slug: { type: ["string", "null"], description: "One of the allowed slugs from the system prompt, or null." },
        },
        required: ["title", "description", "images"],
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
      tool_choice: { type: "function", function: { name: "return_product" } },
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
    // --- auth + allow-list ---
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }
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
    const categorySlugs = await fetchCategorySlugs();

    // 1) Shopify shortcut
    if (source === "shopify") {
      const direct = await tryShopifyJson(url);
      if (direct && direct.title) {
        // Best-effort category guess from title for Shopify too.
        const guess = guessCategoryFromText(`${direct.title} ${direct.description}`, categorySlugs);
        return json({ product: { ...direct, category_slug: guess } });
      }
    }

    // 2) Firecrawl + AI extraction for everything else
    const scraped = await scrapeWithFirecrawl(url);
    if (!scraped) return json({ error: "Could not load that page." }, 502);

    const extracted = await extractWithAI({
      url,
      source,
      markdown: scraped.markdown,
      html: scraped.html,
      metadata: scraped.metadata,
      categorySlugs,
    });

    const aiCat = typeof extracted.category_slug === "string" && categorySlugs.includes(extracted.category_slug)
      ? extracted.category_slug
      : guessCategoryFromText(`${extracted.title ?? ""} ${extracted.description ?? ""}`, categorySlugs);

    const product: Extracted = {
      title: String(extracted.title || scraped.metadata?.title || "Imported product").slice(0, 200),
      price: typeof extracted.price === "number" ? extracted.price : null,
      original_price: typeof extracted.original_price === "number" ? extracted.original_price : null,
      currency: extracted.currency ?? null,
      description: String(extracted.description || "").slice(0, 4000),
      images: Array.from(new Set([
        ...(Array.isArray(extracted.images) ? extracted.images.filter(Boolean) : []),
        ...extractMarketplaceImages(scraped.html),
      ])).slice(0, 20),
      source,
      source_url: url,
      moq: extracted.moq ?? null,
      unit: extracted.unit ?? null,
      category_slug: aiCat,
    };

    return json({ product });
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
