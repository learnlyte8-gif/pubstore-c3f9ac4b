import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "create_rfq",
  title: "Create RFQ",
  description:
    "Post a Request For Quote on behalf of the signed-in buyer. Suppliers will be able to quote against it.",
  inputSchema: {
    product: z.string().trim().min(1).describe("Product name or short description."),
    quantity: z.number().int().min(1).describe("Quantity required."),
    unit: z.string().trim().default("pcs").describe("Unit (pcs, kg, tons, etc)."),
    targetPrice: z.number().positive().optional().describe("Target unit price in USD."),
    destination: z.string().trim().optional().describe("Destination country/city."),
    details: z.string().trim().optional().describe("Additional requirements or notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Sign-in required to post an RFQ." }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("rfqs")
      .insert({
        buyer_id: ctx.getUserId(),
        product: input.product,
        quantity: input.quantity,
        unit: input.unit,
        target_price: input.targetPrice,
        destination: input.destination,
        details: input.details,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `RFQ created: ${data.id}` }],
      structuredContent: { rfq: data },
    };
  },
});
