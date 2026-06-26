// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const json = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: json });
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: json });

    const body = await req.json().catch(() => ({}));
    const purpose = String(body.purpose || "generic");
    const reference = body.reference ? String(body.reference) : null;
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: json });

    let q = admin.from("whatsapp_verification_codes")
      .select("id, code, expires_at, used_at, attempts")
      .eq("user_id", user.id).eq("purpose", purpose)
      .is("used_at", null).order("created_at", { ascending: false }).limit(1);
    if (reference) q = q.eq("reference", reference);
    const { data: row } = await q.maybeSingle();
    if (!row) return new Response(JSON.stringify({ error: "No active code. Request a new one." }), { status: 400, headers: json });
    if (new Date(row.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: "Code expired" }), { status: 400, headers: json });
    if (row.attempts >= 5) return new Response(JSON.stringify({ error: "Too many attempts" }), { status: 429, headers: json });

    if (row.code !== code) {
      await admin.from("whatsapp_verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ error: "Wrong code" }), { status: 400, headers: json });
    }
    await admin.from("whatsapp_verification_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return new Response(JSON.stringify({ ok: true }), { headers: json });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal" }), { status: 500, headers: json });
  }
});
