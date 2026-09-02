// Product image search: takes product titles and returns up to N image URLs per title.
// image URLs per title. Uses Openverse (no key required) with a Wikimedia
// Commons fallback. Used by the Excel import screen to auto-fill product images.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOP = new Set([
  "the", "and", "for", "with", "new", "hot", "sale", "free", "shipping", "pcs",
  "pieces", "set", "high", "quality", "wholesale", "original", "best", "pro",
]);

function cleanQuery(title: string): string {
  return String(title || "")
    .replace(/[|/\\_()\[\]{}#*"'`~]+/g, " ")
    .replace(/\b\d+(\.\d+)?(mm|cm|ml|g|kg|pcs?|x)\b/gi, " ")
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
    .slice(0, 6)
    .join(" ")
    .trim();
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } finally {
    clearTimeout(timer);
  }
}

async function openverse(q: string, limit: number): Promise<string[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${limit * 2}&mature=false`;
  const j = await fetchJson(url, { "User-Agent": "pubstore-image-search/1.0" });
  const items: any[] = Array.isArray(j?.results) ? j.results : [];
  return items
    .map((it) => it?.url || it?.thumbnail)
    .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u));
}

async function wikimedia(q: string, limit: number): Promise<string[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent("filetype:bitmap " + q)}` +
    `&gsrlimit=${limit * 2}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800`;
  const j = await fetchJson(url, { "User-Agent": "pubstore-image-search/1.0" });
  const pages = j?.query?.pages ? Object.values<any>(j.query.pages) : [];
  return pages
    .map((p) => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url)
    .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u));
}

async function findImages(title: string, limit: number): Promise<string[]> {
  const q = cleanQuery(title) || String(title || "").slice(0, 60);
  const out: string[] = [];
  for (const fn of [openverse, wikimedia]) {
    if (out.length >= limit) break;
    try {
      const found = await fn(q, limit);
      for (const u of found) {
        if (out.length >= limit) break;
        if (!out.includes(u)) out.push(u);
      }
    } catch (_) { /* try next source */ }
  }
  return out.slice(0, limit);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.queries) ? body.queries : [body?.query];
    const queries = raw
      .map((q: unknown) => String(q ?? "").trim())
      .filter(Boolean)
      .slice(0, 40);
    if (!queries.length) return json({ error: "Provide queries: string[]" }, 400);

    const limit = Math.min(Math.max(Number(body?.limit) || 3, 1), 6);

    const results: { query: string; images: string[] }[] = [];
    // Small batches keep upstream APIs happy.
    for (let i = 0; i < queries.length; i += 5) {
      const chunk = queries.slice(i, i + 5);
      const settled = await Promise.all(
        chunk.map(async (query: string) => ({ query, images: await findImages(query, limit) }))
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
