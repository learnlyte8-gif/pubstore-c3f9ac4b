// deno-lint-ignore-file no-explicit-any
// Twilio WhatsApp inbound webhook.
// Twilio posts application/x-www-form-urlencoded with fields like:
//   From=whatsapp:+15551234567, To=whatsapp:+14155238886, Body=..., MessageSid=...
import { createClient } from "@supabase/supabase-js";
import { normalizePhoneE164, parseRefTag } from "../_shared/whatsapp.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const TWIML_OK = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
const twimlHeaders = { "Content-Type": "text/xml; charset=utf-8" };

function stripWa(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/^whatsapp:/i, "");
}

async function findOrCreatePubstoreConversation(userId: string): Promise<string | null> {
  // Use a system "PUBSTORE" conversation: we reuse conversations table with kind='support'
  // by selecting an existing one for this user where supplier_id IS NULL.
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
    .select("id")
    .single();
  if (error) {
    console.error("create system conversation failed", error);
    return null;
  }
  return created.id;
}

async function routeReplyToConversation(userId: string, ref: { kind: string; id: string } | null): Promise<{
  conversationId: string | null; senderId: string;
}> {
  // For inquiry/order replies, route into the buyer↔supplier conversation when possible.
  if (ref) {
    if (ref.kind === "inquiry") {
      const { data: i } = await admin.from("product_inquiries")
        .select("buyer_id, supplier_id").eq("id", ref.id).maybeSingle();
      if (i) {
        // If the user sending is the buyer, target conv with that supplier.
        // If the user is the supplier owner, we still need the buyer-supplier conv.
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
  if (req.method !== "POST") {
    return new Response(TWIML_OK, { headers: twimlHeaders });
  }
  try {
    const ct = req.headers.get("content-type") || "";
    let form: URLSearchParams;
    if (ct.includes("application/x-www-form-urlencoded")) {
      form = new URLSearchParams(await req.text());
    } else {
      // Twilio always sends form-encoded; fall back to empty.
      form = new URLSearchParams(await req.text());
    }

    const from = stripWa(form.get("From"));
    const to = stripWa(form.get("To"));
    const body = form.get("Body") || "";
    const sid = form.get("MessageSid") || form.get("SmsMessageSid") || null;
    const fromE164 = normalizePhoneE164(from);

    // Idempotency: skip if SID already logged.
    if (sid) {
      const { data: dup } = await admin.from("whatsapp_inbound_log")
        .select("id").eq("twilio_sid", sid).maybeSingle();
      if (dup) return new Response(TWIML_OK, { headers: twimlHeaders });
    }

    // Match user by profile phone
    let matchedUserId: string | null = null;
    if (fromE164) {
      // Try exact match first, then trailing-digits match for stored variations.
      const { data: byExact } = await admin.from("profiles")
        .select("user_id").eq("phone", fromE164).maybeSingle();
      if (byExact?.user_id) {
        matchedUserId = byExact.user_id;
      } else {
        // Last-9-digits fallback (handles stored numbers without country code)
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
      // Mark sandbox as joined on first inbound
      await admin.from("notification_preferences").upsert({
        user_id: matchedUserId,
        whatsapp_sandbox_joined: true,
      }, { onConflict: "user_id" });

      // Route into a conversation and insert the message so it shows up in the in-app Messages page.
      const routed = await routeReplyToConversation(matchedUserId, ref);
      conversationId = routed.conversationId;
      if (conversationId) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          sender_id: routed.senderId,
          body: body,
        });
        await admin.from("conversations").update({
          last_message: body.slice(0, 200),
          last_message_at: new Date().toISOString(),
        }).eq("id", conversationId);
      }
    }

    await admin.from("whatsapp_inbound_log").insert({
      twilio_sid: sid,
      from_phone: fromE164 || from || "unknown",
      to_phone: to,
      body,
      matched_user_id: matchedUserId,
      conversation_id: conversationId,
      ref_tag: ref ? `${ref.kind}_${ref.id}` : null,
      raw: Object.fromEntries(form.entries()),
    });

    return new Response(TWIML_OK, { headers: twimlHeaders });
  } catch (e: any) {
    console.error("twilio-whatsapp-inbound error", e);
    // Always 200 with empty TwiML so Twilio doesn't retry-storm.
    return new Response(TWIML_OK, { headers: twimlHeaders });
  }
});
