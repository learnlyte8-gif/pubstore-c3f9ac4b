import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_suppliers",
  title: "List suppliers",
  description: "List PUBSTORE suppliers, optionally filtered by country or verified status.",
  inputSchema: {
    country: z.string().trim().optional().describe("Country name filter."),
    verifiedOnly: z.boolean().default(false).describe("Only return verified suppliers."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ country, verifiedOnly, limit }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = sb.from("suppliers").select("id,name,country,verified,rating,response_rate").limit(limit);
    if (country) q = q.ilike("country", `%${country}%`);
    if (verifiedOnly) q = q.eq("verified", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { suppliers: data ?? [] },
    };
  },
});
