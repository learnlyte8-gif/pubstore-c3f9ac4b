import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_properties",
  title: "List properties",
  description: "List PUBSTORE property listings filtered by kind, city, or bedrooms.",
  inputSchema: {
    kind: z.enum(["rent", "sale", "short_stay"]).optional().describe("Listing kind."),
    city: z.string().trim().optional().describe("City filter."),
    minBedrooms: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, city, minBedrooms, limit }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = sb.from("properties").select("*").limit(limit);
    if (kind) q = q.eq("kind", kind);
    if (city) q = q.ilike("city", `%${city}%`);
    if (typeof minBedrooms === "number") q = q.gte("bedrooms", minBedrooms);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { properties: data ?? [] },
    };
  },
});
