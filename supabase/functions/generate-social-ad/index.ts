// Generates social-ad copy (headline, subhead, caption, hashtags, CTA) for a
// product, using a chosen template's style guidance. Admin only.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured" }, 500);

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Sign in to use AI features.", code: "auth_required" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const productIds: string[] = Array.isArray(body?.productIds)
      ? body.productIds.filter((v: unknown) => typeof v === "string").slice(0, 10)
      : [];
    const templateId = typeof body?.templateId === "string" ? body.templateId : null;
    const platforms: string[] = Array.isArray(body?.platforms) ? body.platforms.slice(0, 6) : ["tiktok", "instagram"];
    if (productIds.length === 0) return json({ error: "productIds required" }, 400);

    const { data: template } = templateId
      ? await admin.from("ad_templates").select("*").eq("id", templateId).maybeSingle()
      : { data: null };

    const { data: products } = await admin
      .from("products")
      .select("id, title, description, price, original_price, image, gallery, video_url, badge, free_shipping, category_slug")
      .in("id", productIds);
    if (!products || products.length === 0) return json({ error: "Products not found" }, 404);

    const results: any[] = [];

    for (const p of products) {
      const discount =
        p.original_price && Number(p.original_price) > Number(p.price)
          ? Math.round((1 - Number(p.price) / Number(p.original_price)) * 100)
          : 0;

      const prompt = `Write a social media ad for this marketplace product.

Platforms: ${platforms.join(", ")}
Template style: ${template?.name ?? "generic"} — ${template?.description ?? ""}
Copy guidance: ${template?.caption_prompt ?? "Punchy, honest, benefit-led."}

Product: ${p.title}
Price: $${Number(p.price ?? 0).toFixed(2)}${discount ? ` (was $${Number(p.original_price).toFixed(2)}, ${discount}% off)` : ""}
Description: ${(p.description ?? "").slice(0, 700) || "(none)"}
Free shipping: ${p.free_shipping ? "yes" : "no"}

Return STRICT minified JSON with keys:
- "headline": max 40 characters, hook, no emoji
- "subhead": max 60 characters, the benefit
- "badge": max 14 characters, e.g. "50% OFF" or "NEW"
- "caption": 2-4 short lines for the post body, may use 1-2 emoji, ends with a soft CTA
- "cta": max 22 characters button text
- "hashtags": array of 6-10 lowercase hashtags without the # symbol
No fake claims, no invented specs.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return only valid minified JSON. No markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        const text = await aiRes.text().catch(() => "");
        console.error("AI error", aiRes.status, text);
        if (aiRes.status === 429) return json({ error: "AI is busy, try again in a moment." }, 429);
        if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
        return json({ error: "AI failed to write the ad" }, 502);
      }

      const aiJson = await aiRes.json();
      const raw: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      let parsed: any = {};
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
      }

      const hashtags: string[] = Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((h: string) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 12)
        : [];

      const row = {
        product_id: p.id,
        template_id: template?.id ?? null,
        format: template?.format ?? "square",
        status: "draft",
        headline: String(parsed.headline ?? p.title).slice(0, 80),
        subhead: String(parsed.subhead ?? "").slice(0, 120),
        badge: String(parsed.badge ?? (discount ? `${discount}% OFF` : "")).slice(0, 20) || null,
        caption: String(parsed.caption ?? "").slice(0, 1200),
        cta: String(parsed.cta ?? "Shop now").slice(0, 40),
        hashtags,
        image_url: p.image ?? (Array.isArray(p.gallery) ? p.gallery[0] : null) ?? null,
        video_url: p.video_url ?? null,
        platforms,
        created_by: user.id,
      };

      const { data: inserted, error } = await admin.from("social_ads").insert(row).select("*").maybeSingle();
      if (error) {
        console.error("insert social ad failed", error);
        return json({ error: "Could not save the generated ad" }, 500);
      }
      results.push(inserted);
    }

    return json({ ok: true, ads: results });
  } catch (e) {
    console.error("generate-social-ad fatal", e);
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});
