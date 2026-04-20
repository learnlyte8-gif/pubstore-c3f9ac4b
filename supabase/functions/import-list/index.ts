// Edge function: given a Shopify collection URL or an Alibaba/AliExpress seller URL,
// return a list of product URLs + minimal preview (title, image, price) so the client
// can show a bulk-import checklist. Gated to an allow-list.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EMAILS = ["kukistacks8@gmail.com"];
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

type Candidate = {
  url: string;
  title: string;
  image: string | null;
  price: number | null;
  source: "shopify" | "alibaba" | "aliexpress" | "amazon" | "other";
};

function detectSource(url: string): Candidate["source"] {
  const u = url.toLowerCase();
  if (u.includes("alibaba.")) return "alibaba";
  if (u.includes("aliexpress.")) return "aliexpress";
  if (u.includes("amazon.")) return "amazon";
  // Shopify-like paths
  return "shopify";
}

// --- Shopify: list products via /collections/<handle>/products.json ---
async function listShopifyCollection(url: string, limit = 50): Promise<Candidate[]> {
  const u = new URL(url);
  const m = u.pathname.match(/\/collections\/([^/?#]+)/i);
  const results: Candidate[] = [];

  async function fetchPage(endpoint: string) {
    const r = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const items = (j?.products || []) as any[];
    return items.map((p) => {
      const handle = p.handle;
      const variant = p.variants?.[0];
      const image = p.images?.[0]?.src || null;
      return {
        url: `${u.origin}/products/${handle}`,
        title: p.title || handle,
        image,
        price: variant?.price ? Number(variant.price) : null,
        source: "shopify" as const,
      };
    });
  }

  if (m) {
    const handle = m[1];
    let page = 1;
    while (results.length < limit && page <= 10) {
      const endpoint = `${u.origin}/collections/${handle}/products.json?limit=50&page=${page}`;
      const batch = await fetchPage(endpoint);
      if (batch.length === 0) break;
      results.push(...batch);
      if (batch.length < 50) break;
      page++;
    }
  } else {
    // store root: fall back to /products.json
    let page = 1;
    while (results.length < limit && page <= 10) {
      const endpoint = `${u.origin}/products.json?limit=50&page=${page}`;
      const batch = await fetchPage(endpoint);
      if (batch.length === 0) break;
      results.push(...batch);
      if (batch.length < 50) break;
      page++;
    }
  }

  return results.slice(0, limit);
}

// --- Generic: scrape links via Firecrawl, then filter to product URLs ---
async function firecrawlScrape(url: string): Promise<{ markdown: string; html: string; links: string[] }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");
  const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: false,
      waitFor: 2000,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Scrape failed [${r.status}]: ${j?.error || "unknown"}`);
  const root = j?.data ?? j;
  return {
    markdown: root?.markdown || "",
    html: root?.html || "",
    links: Array.isArray(root?.links) ? root.links : [],
  };
}

function productLinksFor(source: Candidate["source"], links: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const patterns: Record<string, RegExp> = {
    alibaba: /alibaba\.com\/product-detail\//i,
    aliexpress: /aliexpress\.(com|us)\/item\//i,
    amazon: /amazon\.[^/]+\/(dp|gp\/product)\//i,
    shopify: /\/products\/[a-z0-9-]+/i,
    other: /\/product[s]?\/[a-z0-9-]+/i,
  };
  const pat = patterns[source] || patterns.other;
  for (const l of links) {
    if (!pat.test(l)) continue;
    const clean = l.split("#")[0].split("?")[0];
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

async function extractListWithAI(markdown: string, candidates: string[]): Promise<Record<string, { title?: string; image?: string; price?: number | null }>> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return {};
  if (candidates.length === 0) return {};

  const urlList = candidates.slice(0, 40);
  const tool = {
    type: "function",
    function: {
      name: "return_items",
      description: "Return preview metadata for each product url",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                url: { type: "string" },
                title: { type: "string" },
                image: { type: ["string", "null"] },
                price: { type: ["number", "null"] },
              },
              required: ["url", "title"],
            },
          },
        },
        required: ["items"],
      },
    },
  };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Extract a short list of products (title, first image URL, price as a number) matching the provided URLs from the scraped catalog page." },
        {
          role: "user",
          content: `URLs to preview:\n${urlList.join("\n")}\n\nScraped markdown:\n"""\n${markdown.slice(0, 16000)}\n"""`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "return_items" } },
    }),
  });
  const j = await r.json();
  if (!r.ok) return {};
  const call = j?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return {};
  try {
    const parsed = JSON.parse(call.function.arguments);
    const map: Record<string, any> = {};
    for (const it of parsed.items || []) {
      if (it?.url) map[it.url] = { title: it.title, image: it.image, price: it.price };
    }
    return map;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await sb.auth.getUser();
    const email = (userRes?.user?.email || "").toLowerCase();
    if (!email || !ALLOWED_EMAILS.includes(email)) return json({ error: "This feature is in private beta." }, 403);

    const body = await req.json().catch(() => ({}));
    const url: string = (body?.url || "").trim();
    const limit: number = Math.min(50, Math.max(5, Number(body?.limit) || 25));
    if (!url || !/^https?:\/\//i.test(url)) return json({ error: "Please provide a valid http(s) URL." }, 400);

    const source = detectSource(url);

    // Shopify fast-path (no Firecrawl needed)
    if (source === "shopify") {
      const items = await listShopifyCollection(url, limit);
      if (items.length > 0) return json({ items, source });
    }

    // Generic: scrape the listing page and pull product links out
    const scraped = await firecrawlScrape(url);
    const productUrls = productLinksFor(source, scraped.links).slice(0, limit);
    if (productUrls.length === 0) {
      return json({ error: "Couldn't find any product links on that page.", items: [] }, 200);
    }
    const meta = await extractListWithAI(scraped.markdown, productUrls);
    const items: Candidate[] = productUrls.map((u) => {
      const m = meta[u] || {};
      return {
        url: u,
        title: m.title || u.split("/").filter(Boolean).slice(-1)[0]?.replace(/[-_]/g, " ") || "Product",
        image: m.image || null,
        price: typeof m.price === "number" ? m.price : null,
        source,
      };
    });

    return json({ items, source });
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
