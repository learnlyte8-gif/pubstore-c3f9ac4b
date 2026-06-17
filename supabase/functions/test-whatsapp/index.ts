// deno-lint-ignore-file no-explicit-any
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp, normalizePhoneE164 } from "../_shared/whatsapp.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prof } = await admin.from("profiles").select("phone").eq("user_id", user.id).maybeSingle();
    const phone = normalizePhoneE164((prof as any)?.phone);
    if (!phone) {
      return new Response(JSON.stringify({ error: "No phone number on profile" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = `👋 PUBSTORE test\n\nThis is a test message. If you're reading this, WhatsApp is working! 🎉`;
    const result = await sendWhatsApp(phone, body);

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error, code: (result as any).code }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("whatsapp_send_log").insert({
      user_id: user.id,
      event: "test",
      to_phone: phone,
      body,
      status: "sent",
      twilio_sid: result.sid,
    });

    return new Response(JSON.stringify({ ok: true, sid: result.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("test-whatsapp error", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
