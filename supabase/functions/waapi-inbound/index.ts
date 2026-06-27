// deno-lint-ignore-file no-explicit-any
// waapi.app inbound webhook.
// Flow:
//  1) Dedup by message sid.
//  2) Detect a 6-digit link code → pair phone↔user, confirm via WhatsApp.
//  3) Match sender to a PUBSTORE user by phone (exact or tail).
//  4) Route reply:
//      - if [ref:order_X] / [ref:inquiry_X] → counterparty conversation
//      - else → Tapson WhatsApp AI agent
import { createClient } from "@supabase/supabase-js";
import { normalizePhoneE164, parseRefTag, sendWhatsApp, APP_BRAND } from "../_shared/whatsapp.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function chatIdToE164(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  const value = String(chatId);
  // WhatsApp privacy LIDs and group IDs are not real phone numbers. Treating
  // them as E.164 breaks matching and causes replies to go to an invalid target.
  if (/@(?:lid|g\.us)$/i.test(value)) return null;
  const digits = value.split("@")[0].replace(/\D/g, "");
  if (digits.length < 8) return null;
  return "+" + digits;
}

async function findUserByPhone(phone: string): Promise<string | null> {
  const { data: exact } = await admin.from("profiles")
    .select("user_id").eq("phone", phone).maybeSingle();
  if (exact?.user_id) return exact.user_id;
  const tail = phone.replace(/\D/g, "").slice(-9);
  if (tail.length === 9) {
    const { data: byTail } = await admin.from("profiles")
      .select("user_id").ilike("phone", `%${tail}%`).limit(1).maybeSingle();
    if (byTail?.user_id) return byTail.user_id;
  }
  return null;
}

async function findUserByWhatsAppIdentity(identity: string): Promise<string | null> {
  const { data } = await admin.from("whatsapp_link_codes")
    .select("user_id")
    .eq("consumed_phone", identity)
    .not("consumed_at", "is", null)
    .order("consumed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.user_id || null;
}

async function getReplyTarget(userId: string | null, fallback: string): Promise<string> {
  // Waapi trial instances can only deliver outbound messages to the trial owner's
  // own WhatsApp number. While testing, force every reply to that number so the
  // user actually sees responses regardless of which account/LID sent the message.
  const trial = Deno.env.get("WAAPI_TRIAL_NUMBER");
  if (trial) {
    const digits = trial.replace(/\D/g, "");
    if (digits.length >= 8) return "+" + digits;
  }
  if (!userId) return fallback;
  const { data: prof } = await admin.from("profiles")
    .select("phone")
    .eq("user_id", userId)
    .maybeSingle();
  return prof?.phone || fallback;
}

async function tryConsumeLinkCode(body: string, fromIdent: string, replyTo: string): Promise<string | null> {
  const match = body.match(/\b(\d{6})\b/);
  if (!match) return null;
  const code = match[1];
  const { data: row } = await admin.from("whatsapp_link_codes")
    .select("id, user_id, expires_at, consumed_at")
    .eq("code", code).is("consumed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await admin.from("whatsapp_link_codes").update({
    consumed_at: new Date().toISOString(),
    consumed_phone: fromIdent,
  }).eq("id", row.id);
  // Only set profile.phone when we have a real E.164 (not an @lid identifier).
  const looksLikePhone = /^\+?\d{8,15}$/.test(fromIdent);
  if (looksLikePhone) {
    const { data: prof } = await admin.from("profiles").select("phone").eq("user_id", row.user_id).maybeSingle();
    if (!prof?.phone) {
      await admin.from("profiles").update({ phone: fromIdent }).eq("user_id", row.user_id);
    }
  }
  await admin.from("notification_preferences").upsert({
    user_id: row.user_id,
    whatsapp_enabled: true,
    whatsapp_sandbox_joined: true,
  }, { onConflict: "user_id" });

  // If waapi is on trial, it may only allow sending to the account's real test
  // phone, not to WhatsApp privacy LIDs. Prefer the user's saved phone when present.
  const confirmationTarget = await getReplyTarget(row.user_id, replyTo);
  await sendWhatsApp(confirmationTarget,
    `✅ ${APP_BRAND} — WhatsApp linked!\nYou can now chat with Tapson here. Try: "show my recent orders" or "find me wireless earbuds under $30".`);
  return row.user_id;
}

async function routeReplyToConversation(userId: string, ref: { kind: string; id: string }) {
  if (ref.kind === "inquiry") {
    const { data: i } = await admin.from("product_inquiries")
      .select("buyer_id, supplier_id").eq("id", ref.id).maybeSingle();
    if (i) {
      const { data: c } = await admin.from("conversations")
        .select("id").eq("buyer_id", i.buyer_id).eq("supplier_id", i.supplier_id).maybeSingle();
      if (c?.id) return c.id;
    }
  } else if (ref.kind === "order") {
    const { data: o } = await admin.from("orders")
      .select("buyer_id, supplier_id").eq("id", ref.id).maybeSingle();
    if (o) {
      const { data: c } = await admin.from("conversations")
        .select("id").eq("buyer_id", o.buyer_id).eq("supplier_id", o.supplier_id).maybeSingle();
      if (c?.id) return c.id;
    }
  }
  return null;
}

async function invokeTapson(phone: string, body: string, userId: string | null) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tapson-whatsapp`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ phone, body, user_id: userId }),
  }).catch((e) => console.error("tapson invoke failed", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });

  try {
    const payload = await req.json().catch(() => ({} as any));
    const event = payload?.event || payload?.type;
    const data = payload?.data || {};
    const msg = data?.message || data?.data?.message || data;

    if (event && !/message/i.test(String(event))) {
      return new Response(JSON.stringify({ ok: true, skipped: "event" }), { headers: jsonHeaders });
    }
    if (msg?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), { headers: jsonHeaders });
    }

    const fromChat = msg?.from || msg?.chatId || data?.from;
    const body: string = (msg?.body || msg?.text || msg?.message || "").toString().trim();
    const sid: string | null =
      msg?.id?._serialized || msg?.id || msg?.messageId || data?.id?._serialized || null;
    // Reply MUST go back to the exact chatId we received from (handles @lid privacy IDs).
    const replyTo: string | null = fromChat ? String(fromChat) : null;
    const fromE164 = String(fromChat || "").includes("@")
      ? chatIdToE164(fromChat)
      : normalizePhoneE164(fromChat);

    // Trimmed raw — keep only fields we may need for debugging. Full webhook
    // payloads are large jsonb writes and were the #1 source of slow inserts.
    const slimRaw = {
      event,
      from: fromChat,
      sid,
      type: msg?.type ?? null,
      ts: msg?.timestamp ?? null,
    };

    let reservedInbound = false;
    if (sid) {
      const { error: reserveError } = await admin.from("whatsapp_inbound_log").insert({
        twilio_sid: sid,
        from_phone: fromE164 || replyTo || String(fromChat || "unknown"),
        body,
        raw: slimRaw,
      });
      if (reserveError) {
        // waapi may retry / fan out the same webhook. Reserve by message ID before
        // doing any side effects so duplicates cannot trigger multiple replies.
        if (reserveError.code === "23505") {
          return new Response(JSON.stringify({ ok: true, dup: true }), { headers: jsonHeaders });
        }
        console.warn("waapi inbound reserve failed", reserveError.message);
      } else {
        reservedInbound = true;
      }
    }

    if (!replyTo || !body) {
      if (!reservedInbound && sid) {
        await admin.from("whatsapp_inbound_log").insert({
          twilio_sid: sid,
          from_phone: fromE164 || String(fromChat || "unknown"),
          body, ref_tag: "empty", raw: slimRaw,
        });
      }
      return new Response(JSON.stringify({ ok: true, skipped: "empty" }), { headers: jsonHeaders });
    }


    // Identifier used for phone-matching & log records.
    // For @lid senders we don't have a real phone — store the chatId itself.
    const senderKey = /@lid$/i.test(replyTo) ? replyTo : (fromE164 || replyTo);

    // 1. Try link-code pairing
    const linkedUserId = await tryConsumeLinkCode(body, senderKey, replyTo);
    let matchedUserId = linkedUserId;

    // 2. Phone match (only meaningful when we have a real E.164)
    if (!matchedUserId && fromE164) matchedUserId = await findUserByPhone(fromE164);

    // 2b. Privacy LID match: use the account pairing created by the link code.
    if (!matchedUserId) matchedUserId = await findUserByWhatsAppIdentity(replyTo);

    if (matchedUserId) {
      await admin.from("notification_preferences").upsert({
        user_id: matchedUserId, whatsapp_sandbox_joined: true,
      }, { onConflict: "user_id" });
    }

    const ref = parseRefTag(body);
    let conversationId: string | null = null;
    let handler: "tapson" | "conversation" | "link_code" | "anon_tapson" = linkedUserId ? "link_code" : "tapson";

    // 3. If message has a ref tag and user matched → route to that conversation thread
    if (matchedUserId && ref) {
      conversationId = await routeReplyToConversation(matchedUserId, ref);
      if (conversationId) {
        await admin.from("messages").insert({
          conversation_id: conversationId, sender_id: matchedUserId, body,
        });
        await admin.from("conversations").update({
          last_message: body.slice(0, 200),
          last_message_at: new Date().toISOString(),
        }).eq("id", conversationId);
        handler = "conversation";
      }
    }

    // 4. Otherwise → Tapson AI (signed-in or anonymous)
    if (handler === "tapson") {
      if (!matchedUserId) handler = "anon_tapson";
      // Fire-and-forget (Tapson sends its own WA reply). Pass the raw chatId so
      // replies route back to @lid / @c.us correctly.
      const tapsonReplyTarget = await getReplyTarget(matchedUserId, replyTo);
      await invokeTapson(tapsonReplyTarget, body, matchedUserId);
    }

    // Patch the reserved row with matching/routing metadata. Skip `raw` here —
    // it was already written on the reservation insert.
    const inboundPatch = {
      from_phone: fromE164,
      body,
      matched_user_id: matchedUserId,
      conversation_id: conversationId,
      ref_tag: ref ? `${ref.kind}_${ref.id}` : handler,
    };

    if (reservedInbound && sid) {
      await admin.from("whatsapp_inbound_log").update(inboundPatch).eq("twilio_sid", sid);
    } else if (!reservedInbound) {
      await admin.from("whatsapp_inbound_log").insert({ twilio_sid: sid, ...inboundPatch, raw: slimRaw });
    }


    return new Response(JSON.stringify({ ok: true, handler }), { headers: jsonHeaders });
  } catch (e: any) {
    console.error("waapi-inbound error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || "internal" }), {
      status: 200, headers: jsonHeaders,
    });
  }
});
