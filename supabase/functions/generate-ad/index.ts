// AI Ad generator: rewrites a product's marketing copy and flags it as a
// "reel-ready" product. First 3 generations per supplier are free; after that
// the supplier's wallet is charged AD_FEE (in USD) per generation.

import { createClient } from "npm:@supabase/supabase-js@2";
import { chargeAiCredits, refundAiCredits } from "../_shared/ai-credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_TRIALS = 3; // legacy supplier counter, kept for reporting

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI is not configured" }, 500);
    }

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const productId = String(body?.productId ?? "").trim();
    if (!productId) return json({ error: "productId required" }, 400);

    // Load product + supplier (admin to bypass RLS once we've verified ownership)
    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("id, title, description, supplier_id, image, gallery")
      .eq("id", productId)
      .maybeSingle();
    if (prodErr || !product) return json({ error: "Product not found" }, 404);

    const { data: supplier } = await admin
      .from("suppliers")
      .select("id, owner_id, ad_credits_used, ad_pro")
      .eq("id", product.supplier_id)
      .maybeSingle();
    if (!supplier || supplier.owner_id !== user.id) {
      return json({ error: "Not your product" }, 403);
    }

    const used = Number(supplier.ad_credits_used ?? 0);
    const isPro = !!supplier.ad_pro;

    // Charge AI credits up-front so we never pay for a failed generation later
    let charged = 0;
    if (!isPro) {
      const charge = await chargeAiCredits(req, "generate_ad", { reference: `ad:${product.id}` });
      if (!charge.ok) return json(charge.body, charge.status);
      charged = charge.charged;
    }
    const needsPayment = charged > 0;

    // Generate marketing copy via Lovable AI
    const prompt = `You are a top-tier ecommerce copywriter. Rewrite this product to maximize click-through and conversions on a marketplace feed. Keep it honest — no fake claims.

Product title: ${product.title}
Current description: ${product.description ?? "(none)"}

Return STRICT JSON with keys:
- "title": punchy, 60 chars max, benefit-led
- "description": 2–3 short paragraphs, scannable, ends with a soft CTA
- "ad_headline": 6 words max, hook
- "ad_tagline": 10 words max, the promise`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return only valid minified JSON. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      await refundAiCredits(user.id, "generate_ad", charged, `ad:${product.id}`);
      const text = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) return json({ error: "AI is busy, try again in a moment." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      console.error("AI error", aiRes.status, text);
      return json({ error: "AI failed to generate ad" }, 502);
    }
    const aiJson = await aiRes.json();
    const raw: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: { title?: string; description?: string; ad_headline?: string; ad_tagline?: string } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    const newTitle = (parsed.title || product.title).slice(0, 120);
    const newDesc = parsed.description || product.description || "";
    const adHeadline = (parsed.ad_headline || "").slice(0, 80);
    const adTagline = (parsed.ad_tagline || "").slice(0, 140);

    const { error: updErr } = await admin
      .from("products")
      .update({
        title: newTitle,
        description: newDesc,
        ad_headline: adHeadline || null,
        ad_tagline: adTagline || null,
        ad_has_reel: true,
        ad_generated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (updErr) {
      console.error("update product failed", updErr);
      return json({ error: "Could not save ad" }, 500);
    }

    // Bump credits used (only when free trial was consumed)
    if (!needsPayment) {
      await admin
        .from("suppliers")
        .update({ ad_credits_used: used + 1 })
        .eq("id", supplier.id);
    }

    const newUsed = needsPayment ? used : used + 1;
    return json({
      ok: true,
      paid: needsPayment,
      ai_credits_charged: charged,
      credits_used: newUsed,
      free_trials: FREE_TRIALS,
      remaining_free: Math.max(0, FREE_TRIALS - newUsed),
      product: {
        id: product.id,
        title: newTitle,
        description: newDesc,
        ad_headline: adHeadline,
        ad_tagline: adTagline,
      },
    });
  } catch (e) {
    console.error("generate-ad fatal", e);
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
