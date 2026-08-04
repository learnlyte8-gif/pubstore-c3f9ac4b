// Image search: accepts an image (data URL or URL) and returns short
// search keywords describing the visible product, using Lovable AI's
// Gemini Vision. The frontend then runs those keywords through the
// existing universal search ranker.

import { chargeAiCredits } from "../_shared/ai-credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const image: string = (body?.image || "").trim();
    if (!image || (!image.startsWith("data:image/") && !/^https?:\/\//i.test(image))) {
      return json({ error: "Provide image as data URL or http(s) URL" }, 400);
    }

    const charge = await chargeAiCredits(req, "image_search");
    if (!charge.ok) return json(charge.body, charge.status);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify products in an image for a wholesale marketplace search. Reply with 3 to 6 plain keywords (no punctuation, no brand names unless clearly visible) separated by spaces. Cover product type, color, material, and notable attributes. Reply with keywords only.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What product is this? Give search keywords only." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      console.error("AI error", r.status, j);
      const msg = j?.error?.message || `AI request failed (${r.status})`;
      return json({ error: msg }, r.status === 429 ? 429 : 502);
    }

    const text: string = (j?.choices?.[0]?.message?.content || "").trim();
    const keywords = text
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 8)
      .join(" ");

    return json({ keywords, raw: text, ai_credits_charged: charge.charged, ai_credits_balance: charge.balance });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
