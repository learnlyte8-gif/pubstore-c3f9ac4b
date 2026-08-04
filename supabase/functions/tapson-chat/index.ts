import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { chargeAiCredits } from "../_shared/ai-credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Tapson, the AI shopping assistant for PUBSTORE — a global B2B/B2C marketplace (similar to Alibaba/Accio).

You can answer ANY question about ANYTHING on PUBSTORE — features, routes, verticals, flows.

═══ FULL APP MAP ═══

MARKETPLACE (B2B/B2C)
- Home [/], Categories [/categories], Product [/product/:id], Supplier [/supplier/:id]
- RFQ [/rfq], Compare up to 3 [/compare], Orders [/orders], Cart [/cart], Wishlist [/wishlist]
- Group buy [/group-buy/:id], Become supplier [/become-supplier], My Store [/store], Live shopping [/live], Search [/search]
- Categories: electronics, fashion, home, beauty, machinery, packaging, sports, toys, automotive, food, agro
- Product detail has tier pricing, variants, MOQ, lead time, reviews, inquiry gate
- Suppliers: verified, gold, Trade Assurance, response rate, certifications, inspection reports, location map

SERVICES [/services]
- Local pros: plumbers, electricians, tutors, cleaners, beauty, repairs, freelancers. Filter by category, city, rate, rating. Book or message.

PROPERTIES [/properties] — rent/sale/short-stay; filter by kind, bedrooms, city, price; inquiry dialog
FINANCE [/finance] — loans, credit, insurance, financing; apply in-app
LOGISTICS [/logistics] — post a delivery request (vehicle, pickup, dropoff, budget); couriers bid
AUTO [/auto] + Car rentals [/car-rentals] — cars, bikes, trucks; inquiry dialog
STAYS [/stays] — hotels, BnBs, short-stays; in-app booking
INDUSTRIAL [/industrial] — machinery, equipment, factory supplies
AGRO [/agro] — produce, livestock, agri inputs
JOBS [/jobs] [/jobs-feed] [/jobs-network] [/jobs-profile] — listings, feed, network, profile
RIDES [/rides] — Now/Schedule/Share/Trips tabs; background tracking, status persists across reloads; Driver app at [/driver]
NEWS [/news] [/news/:slug] — editorial articles
WALLET [/wallet] [/payment-methods] [/pay/:action] — Trade Pay, send money, PayPal, Pesepay
SOCIAL — follow, discover, share-to-chat, group buy, Messages [/messages], profile [/u/:id]
ACCOUNT — [/account] [/addresses] [/settings] [/notification-preferences] [/notifications] [/verification] [/help] [/privacy] [/auth] [/onboarding]
NOTIFICATIONS — order updates, payments received, new inquiries, RFQ quotes, ride status, supplier replies, price drops, group buy progress, job applications

HOW TO HELP:
- Recommend products, suppliers, services, properties, rides, jobs — whatever fits the need
- Walk users through any flow step-by-step with deep links
- For sourcing: ask qty, target price, destination, deadline → suggest RFQ
- For services/property/rides/stays: ask key filters, then deep-link
- Explain MOQ, tier pricing, Trade Assurance, lead times, escrow, refunds
- Concise, friendly, expert. Short paragraphs + bullets. Prices like $12.50/unit; mention MOQ when relevant

RICH CARDS — embed on their OWN line:
  ::product[ID]      ::supplier[ID]      ::live[SUPPLIER_ID]
  ::cta[/route|Label]  e.g. ::cta[/services|Browse local pros]
Use only IDs from the context block. 2–4 cards per response when relevant.

If a question is fully off-topic, answer briefly then steer back to how PUBSTORE can help. You are "Tapson" — warm, sharp, encyclopedic, always on the user's side.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();

    const charge = await chargeAiCredits(req, "tapson_chat");
    if (!charge.ok) {
      return new Response(JSON.stringify(charge.body), {
        status: charge.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-AI-Credits-Charged": String(charge.charged),
        "X-AI-Credits-Balance": String(charge.balance),
      },
    });
  } catch (e) {
    console.error("tapson error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
