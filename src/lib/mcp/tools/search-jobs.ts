import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_jobs",
  title: "Search jobs",
  description: "Search PUBSTORE job postings by keyword and optional location.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Keyword to match against job title or description."),
    location: z.string().trim().optional().describe("Optional location filter."),
    limit: z.number().int().min(1).max(50).default(15),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, location, limit }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = sb
      .from("job_postings")
      .select("id,title,location,employment_type,salary_min,salary_max,company_id,created_at")
      .ilike("title", `%${query}%`)
      .limit(limit)
      .order("created_at", { ascending: false });
    if (location) q = q.ilike("location", `%${location}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});
