// deno-lint-ignore-file no-explicit-any
// waapi.app inbound webhook.
// Configure in waapi dashboard → Webhooks. Send "message" events.
// Payload shape (simplified):
// { event: "message", instanceId: "...", data: { message: { from: "2637...@c.us", body: "...", id: { _serialized: "..." }, fromMe: false } } }
import { createClient } from "@supabase/supabase-js";
import { normalizePhoneE164, parseRefTag } from "../_shared/whatsapp.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function chatIdToE164(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  const digits = String(chatId).split("@")[0].replace(/\D/g, "");
  if (digits.length < 8) return null;
  return "+" + digits;
}

async function findOrCreatePubstoreConversation(userId: string): Promise<string | null> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("buyer_id", userId)
    .is("supplier_id", null)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await admin
    .from("conversations")
    .insert({ buyer_id: userId, supplier_id: null, title: "PUBSTORE", last_message: null })
    .select("id").single();
  if (error) { console.error("create conv failed", error); return null; }
  return created.id;
}

async function routeReplyToConversation(userId: string, ref: { kind: string; id: string } | null) {
  if (ref) {
    if (ref.kind === "inquiry") {
      const { data: i } = await admin.from("product_inquiries")
        .select("buyer_id, supplier_id").eq("id", ref.id).maybeSingle();
      if (i) {
        const { data: c } = await admin.from("conversations")
          .select("id").eq("buyer_id", i.buyer_id).eq("supplier_id", i.supplier_id).maybeSingle();
        if (c?.id) return { conversationId: c.id, senderId: userId };
      }
    } else if (ref.kind === "order") {
      const { data: o } = await admin.from("orders")
        .select("buyer_id, supplier_id").eq("id", ref.id).maybeSingle();
      if (o) {
        const { data: c } = await admin.from("conversations")
          .select("id").eq("buyer_id", o.buyer_id).eq("supplier_id", o.supplier_id).maybeSingle();
        if (c?.id) return { conversationId: c.id, senderId: userId };
      }
    }
  }
  const convId = await findOrCreatePubstoreConversation(userId);
  return { conversationId: convId, senderId: userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });

  try {
    const payload = await req.json().catch(() => ({} as any));
    const event = payload?.event || payload?.type;
    const data = payload?.data || {};
    const msg = data?.message || data?.data?.message || data;

    // Ignore outbound and non-message events
    if (event && !/message/i.test(String(event))) {
      return new Response(JSON.stringify({ ok: true, skipped: "event" }), { headers: jsonHeaders });
    }
    if (msg?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), { headers: jsonHeaders });
    }

    const fromChat = msg?.from || msg?.chatId || data?.from;
    const body: string = msg?.body || msg?.text || msg?.message || "";
    const sid: string | null =
      msg?.id?._serialized || msg?.id || msg?.messageId || data?.id?._serialized || null;
    const fromE164 = chatIdToE164(fromChat) || normalizePhoneE164(fromChat);

    if (sid) {
      const { data: dup } = await admin.from("whatsapp_inbound_log")
        .select("id").eq("twilio_sid", sid).maybeSingle();
      if (dup) return new Response(JSON.stringify({ ok: true, dup: true }), { headers: jsonHeaders });
    }

    let matchedUserId: string | null = null;
    if (fromE164) {
      const { data: byExact } = await admin.from("profiles")
        .select("user_id").eq("phone", fromE164).maybeSingle();
      if (byExact?.user_id) matchedUserId = byExact.user_id;
      else {
        const tail = fromE164.replace(/\D/g, "").slice(-9);
        if (tail.length === 9) {
          const { data: byTail } = await admin.from("profiles")
            .select("user_id, phone").ilike("phone", `%${tail}%`).limit(1).maybeSingle();
          if (byTail?.user_id) matchedUserId = byTail.user_id;
        }
      }
    }

    const ref = parseRefTag(body);
    let conversationId: string | null = null;

    if (matchedUserId) {
      await admin.from("notification_preferences").upsert({
        user_id: matchedUserId,
        whatsapp_sandbox_joined: true,
      }, { onConflict: "user_id" });

      const routed = await routeReplyToConversation(matchedUserId, ref);
      conversationId = routed.conversationId;
      if (conversationId && body) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: routed.senderId,
          body,
        });
        await admin.from("conversations").update({
          last_message: body.slice(0, 200),
          last_message_at: new Date().toISOString(),
        }).eq("id", conversationId);
      }
    }

    await admin.from("whatsapp_inbound_log").insert({
      twilio_sid: sid,
      from_phone: fromE164 || String(fromChat || "unknown"),
      to_phone: null,
      body,
      matched_user_id: matchedUserId,
      conversation_id: conversationId,
      ref_tag: ref ? `${ref.kind}_${ref.id}` : null,
      raw: payload,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (e: any) {
    console.error("waapi-inbound error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || "internal" }), {
      status: 200, headers: jsonHeaders,
    });
  }
});
