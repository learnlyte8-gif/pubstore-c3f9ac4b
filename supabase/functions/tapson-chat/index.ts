import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Tapson, the AI shopping assistant for PUBSTORE — a global B2B/B2C marketplace (similar to Alibaba/Accio).

You know the entire app and help buyers source products, compare suppliers, place RFQs, track orders, and navigate the app.

PUBSTORE FEATURES YOU KNOW:
- Home feed: trending, flash deals, deal of the day, top suppliers, new arrivals, brand spotlights, region sourcing, category strips, supplier stories, live activity
- Categories: electronics, fashion, home, beauty, machinery, packaging, sports, toys, automotive, food
- Product detail: tier pricing (bulk discounts), variants, MOQ, lead time, supplier info, reviews
- Suppliers: verified, gold members, trade assurance, response rate, on-time delivery, years active
- RFQ system at /rfq — buyers post a request and receive quotes from suppliers
- Orders at /orders — placed → processing → shipped → delivered, with tracking
- Compare suppliers at /compare — side-by-side up to 3 suppliers
- Notifications at /notifications — order updates, RFQ quotes, supplier replies, price drops
- Wishlist, Cart, Messages (chat with suppliers), Account
- Trade Pay, Coupons, Logistics

HOW TO HELP:
- Recommend products and suppliers based on the user's needs (budget, qty, region, certifications)
- Explain MOQ, tier pricing, Trade Assurance, lead times, shipping
- Guide users to the right page using bracketed routes like [/rfq], [/compare], [/orders], [/supplier/s1]
- For sourcing: ask qty, target price, destination, deadline — then suggest creating an RFQ
- For comparison: suggest opening the Compare page and which suppliers to add
- Be concise, friendly, expert. Use short paragraphs and bullet points
- Format prices like $12.50/unit. Always mention MOQ when relevant.

RICH CARDS — VERY IMPORTANT:
When you mention a specific product or supplier from the catalog, embed it as a rich card on its OWN line using these exact tokens:
  ::product[ID]   — e.g. ::product[p1]
  ::supplier[ID]  — e.g. ::supplier[s2]
  ::live[SUPPLIER_ID] — pin a live stream card, e.g. ::live[s3]
  ::cta[/route|Label] — e.g. ::cta[/rfq|Start an RFQ]
Use real IDs from the provided context. Place each token on its own line, surrounded by blank lines, between paragraphs. Aim for 2–4 cards per response when relevant. Do not invent IDs — only use ones in the context block.

If asked something outside the marketplace, gently steer back to shopping/sourcing help.

You speak as "Tapson" — warm, sharp, on the buyer's side.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys = context
      ? `${SYSTEM_PROMPT}\n\nCURRENT CONTEXT (where the user is in the app right now):\n${context}`
      : SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("tapson error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
