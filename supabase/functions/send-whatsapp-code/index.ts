// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsApp, normalizePhoneE164, APP_BRAND } from "../_shared/whatsapp.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const json = { ...corsHeaders, "Content-Type": "application/json" };

const PURPOSE_LABELS: Record<string, string> = {
  twofa: "Your 2FA code",
  order_delivery: "Your delivery confirmation code",
  withdrawal: "Your withdrawal confirmation code",
  generic: "Your verification code",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: json });
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: json });

    const body = await req.json().catch(() => ({}));
    const purpose = (body.purpose || "generic") as string;
    if (!["twofa", "order_delivery", "withdrawal", "generic"].includes(purpose)) {
      return new Response(JSON.stringify({ error: "invalid purpose" }), { status: 400, headers: json });
    }
    const reference = body.reference ? String(body.reference).slice(0, 120) : null;
    const overridePhone = body.phone ? normalizePhoneE164(String(body.phone)) : null;

    const { data: prof } = await admin.from("profiles").select("phone").eq("user_id", user.id).maybeSingle();
    const phone = overridePhone || normalizePhoneE164((prof as any)?.phone);
    if (!phone) return new Response(JSON.stringify({ error: "No phone on profile" }), { status: 400, headers: json });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await admin.from("whatsapp_verification_codes").insert({
      user_id: user.id, purpose, reference, code, expires_at: expires,
    });

    const msg = `🔐 ${APP_BRAND}\n${PURPOSE_LABELS[purpose]}: *${code}*\nExpires in 10 minutes. Never share this code.`;
    const result = await sendWhatsApp(phone, msg);
    await admin.from("whatsapp_send_log").insert({
      user_id: user.id, event: `code_${purpose}`, to_phone: phone, body: msg,
      status: result.ok ? "sent" : "failed",
      twilio_sid: result.ok ? result.sid : null,
      error: !result.ok ? result.error : null,
    });
    if (!result.ok) return new Response(JSON.stringify({ error: result.error }), { status: 502, headers: json });
    return new Response(JSON.stringify({ ok: true, phone_tail: phone.slice(-4) }), { headers: json });
  } catch (e: any) {
    console.error("send-whatsapp-code", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), { status: 500, headers: json });
  }
});
