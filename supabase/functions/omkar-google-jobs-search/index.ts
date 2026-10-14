import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  const t = s.trim();
  return t ? t : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: ue } = await sb.auth.getUser();
    if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim().slice(0, 200);
    const page = Math.max(1, Math.min(10, Number(body?.page) || 1));
    if (!query) return json({ error: "query is required" }, 400);

    const apiKey = (Deno.env.get("OMKAR_GOOGLE_JOBS_API_KEY") || Deno.env.get("OMKAR_API_KEY") || Deno.env.get("OMKAR_SHEIN_API_KEY"))?.trim();
    if (!apiKey) return json({ error: "Google Jobs API key not configured" }, 500);

    const url = new URL("https://google-jobs-scraper.omkar.cloud/search");
    url.searchParams.set("query", query);
    // Zimbabwean results
    url.searchParams.set("country", "ZW");
    url.searchParams.set("language", "en");
    url.searchParams.set("page", String(page));
    url.searchParams.set("num_pages", "1");

    const r = await fetch(url, { headers: { "API-Key": apiKey } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.message || data?.error || `Google Jobs search failed (${r.status})` }, 502);

    const raw: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data?.jobs) ? data.jobs : [];
    const items = raw.map((j: any) => {
      const salary = str(j?.salary ?? j?.salary_text ?? j?.compensation);
      const link = str(j?.link ?? j?.url ?? j?.apply_link ?? j?.job_url);
      return {
        id: String(j?.id ?? j?.job_id ?? crypto.randomUUID()),
        title: str(j?.title ?? j?.job_title) ?? "Job",
        company: str(j?.company ?? j?.company_name ?? j?.employer),
        location: str(j?.location ?? j?.place ?? j?.city),
        salary,
        description: str(j?.description ?? j?.snippet)?.slice(0, 600) ?? null,
        posted_at: str(j?.posted_at ?? j?.date ?? j?.listed_at),
        job_type: str(j?.job_type ?? j?.employment_type ?? j?.schedule),
        url: link,
        source: "google_jobs" as const,
      };
    }).filter((j) => j.url);

    return json({ items, page });
  } catch (e) {
    console.error("google jobs search error", e);
    return json({ error: e instanceof Error ? e.message : "Search failed" }, 500);
  }
});
