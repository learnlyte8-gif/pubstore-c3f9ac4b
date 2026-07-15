// Semantic product search: embeds the query with Lovable AI and calls the
// `search_products_semantic` Postgres function which blends keyword + vector.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!lovableKey || !supabaseUrl || !serviceKey) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const query: string = String(body?.query || "").trim();
    const limit: number = Math.min(Math.max(Number(body?.limit) || 40, 1), 100);
    if (!query) return json({ error: "query is required" }, 400);

    // Embed the query. search_products_semantic expects vector(1536).
    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: query,
        dimensions: 1536,
      }),
    });
    const embJson = await embRes.json();
    if (!embRes.ok) {
      console.error("embedding error", embRes.status, embJson);
      const msg = embJson?.error?.message || `Embedding failed (${embRes.status})`;
      return json({ error: msg }, embRes.status === 429 ? 429 : 502);
    }
    const embedding: number[] = embJson?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) return json({ error: "No embedding returned" }, 502);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.rpc("search_products_semantic", {
      search_query: query,
      query_embedding: embedding as unknown as string,
      result_limit: limit,
    });

    if (error) {
      console.error("rpc error", error);
      return json({ error: error.message }, 500);
    }

    return json({ results: data ?? [] });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
