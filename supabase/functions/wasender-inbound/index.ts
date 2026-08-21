// deno-lint-ignore-file no-explicit-any
// wasenderapi.com inbound webhook.
// Normalizes the Baileys-style payload from WasenderAPI into the shape the
// existing routing brain (waapi-inbound) understands, then forwards it.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function extractText(message: any): string {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    ""
  ).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({} as any));

    // Optional shared-secret check (Wasender sends the configured webhook secret).
    const expected = Deno.env.get("WASENDER_WEBHOOK_SECRET");
    if (expected) {
      const got =
        req.headers.get("x-webhook-signature") ||
        req.headers.get("x-wasender-signature") ||
        req.headers.get("x-webhook-secret") ||
        "";
      if (got !== expected) {
        return new Response(JSON.stringify({ ok: false, error: "bad signature" }), {
          status: 401,
          headers: jsonHeaders,
        });
      }
    }

    const event = payload?.event || payload?.type || "messages.upsert";
    if (!/message/i.test(String(event))) {
      return new Response(JSON.stringify({ ok: true, skipped: "event" }), { headers: jsonHeaders });
    }

    const data = payload?.data ?? {};
    const raw = data?.messages ?? data?.message ?? data;
    const m = Array.isArray(raw) ? raw[0] : raw;
    const key = m?.key ?? {};

    const from: string | null = key?.remoteJid || m?.from || m?.chatId || null;
    const sid: string | null = key?.id || m?.id || m?.messageId || null;
    const body = extractText(m?.message).trim();
    const fromMe = Boolean(key?.fromMe ?? m?.fromMe);

    if (fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), { headers: jsonHeaders });
    }
    if (!from || !body) {
      return new Response(JSON.stringify({ ok: true, skipped: "empty" }), { headers: jsonHeaders });
    }

    const forwarded = {
      event: "message",
      data: {
        message: {
          from,
          chatId: from,
          body,
          id: sid,
          type: "chat",
          timestamp: payload?.timestamp ?? m?.messageTimestamp ?? null,
          fromMe: false,
        },
      },
    };

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/waapi-inbound`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(forwarded),
    });
    const out = await res.text();

    return new Response(JSON.stringify({ ok: true, routed: out.slice(0, 300) }), {
      headers: jsonHeaders,
    });
  } catch (e: any) {
    console.error("wasender-inbound error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || "internal" }), {
      status: 200,
      headers: jsonHeaders,
    });
  }
});
