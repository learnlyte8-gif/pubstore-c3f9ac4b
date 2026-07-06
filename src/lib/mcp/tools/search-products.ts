import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function anonClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search PUBSTORE marketplace products by keyword. Returns id, title, price, category, and supplier for each match.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Keyword or phrase to match against product titles/descriptions."),
    category: z.string().trim().optional().describe("Optional category slug filter (e.g. 'electronics')."),
    limit: z.number().int().min(1).max(50).default(10).describe("Max results (1-50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }) => {
    const sb = anonClient();
    let q = sb
      .from("products")
      .select("id,title,price,category_slug,supplier_id,image,moq")
      .ilike("title", `%${query}%`)
      .limit(limit);
    if (category) q = q.eq("category_slug", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
