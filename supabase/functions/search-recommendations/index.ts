import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "openai/text-embedding-3-small";
const DIMS = 1536; // matches products.search_embedding
const TTL_HOURS = 24;

async function keyFor(query: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`v1:${query.toLowerCase()}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function embed(query: string): Promise<number[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: query, dimensions: DIMS }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.data[0].embedding as number[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const queries: string[] = (Array.isArray(body.queries) ? body.queries : [body.query])
      .filter((q: unknown) => typeof q === "string" && q.trim().length >= 2)
      .map((q: string) => q.trim())
      .slice(0, 3);
    if (!queries.length) return json({ productIds: [], queries: [], source: "empty" });

    const limit = Math.min(Number(body.limit) || 12, 24);
    const perQuery = Math.max(4, Math.ceil(limit / queries.length) + 4);

    const ranked: { id: string; score: number }[] = [];
    let source = "cache";

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      const recencyWeight = 1 / (i + 1); // most recent search dominates
      const cacheKey = await keyFor(q);

      const { data: cached } = await admin
        .from("search_reco_cache")
        .select("product_ids, created_at")
        .eq("query_key", cacheKey)
        .maybeSingle();

      let ids: string[] | null = null;
      const fresh = cached && Date.now() - new Date(cached.created_at).getTime() < TTL_HOURS * 3600_000;
      if (fresh) ids = (cached!.product_ids as string[]) ?? [];

      if (!ids) {
        source = "ai";
        try {
          const vector = await embed(q);
          const { data, error } = await admin.rpc("search_products_semantic", {
            search_query: q,
            query_embedding: JSON.stringify(vector),
            result_limit: perQuery,
          });
          if (error) throw error;
          ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
        } catch (_e) {
          // Fall back to keyword search so the strip still renders.
          const { data } = await admin.rpc("search_products", { search_query: q, result_limit: perQuery });
          ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
        }
        await admin
          .from("search_reco_cache")
          .upsert({ query_key: cacheKey, query: q, product_ids: ids, created_at: new Date().toISOString() });
      }

      ids.slice(0, perQuery).forEach((id, rank) => {
        ranked.push({ id, score: recencyWeight * (perQuery - rank) });
      });
    }

    const merged = new Map<string, number>();
    for (const r of ranked) merged.set(r.id, (merged.get(r.id) ?? 0) + r.score);
    const productIds = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);

    return json({ productIds, queries, source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommendation failed";
    return json({ error: message, productIds: [] }, 500);
  }
});
