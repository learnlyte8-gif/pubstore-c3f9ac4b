// Polls Paynow for the status of a pending transaction. The frontend calls
// this after the buyer is redirected back from the hosted checkout, or after
// the EcoCash/OneMoney mobile prompt. Updates orders/wallet on success.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parsePaynowResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = decodeURIComponent(line.slice(idx + 1).trim().replace(/\+/g, " "));
    if (k) out[k] = v;
  }
  return out;
}

async function sha512Upper(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function verifyHash(fields: Record<string, string>, key: string): Promise<boolean> {
  const sent = (fields.hash || "").toUpperCase();
  if (!sent) return false;
  const { hash: _omit, ...rest } = fields;
  const concat = Object.values(rest).join("") + key;
  const expected = await sha512Upper(concat);
  return expected === sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get("PAYNOW_INTEGRATION_KEY");
    if (!key) return json({ error: "misconfigured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userRes } = await sb.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const pollUrl: string = body?.pollUrl;
    const reference: string = body?.reference;
    if (!pollUrl) return json({ error: "pollUrl required" }, 400);

    const r = await fetch(pollUrl, { method: "POST" });
    const parsed = parsePaynowResponse(await r.text());
    if (!verifyHash(parsed, key)) return json({ error: "bad hash" }, 400);

    const status = (parsed.status || "").toLowerCase();
    const amount = Number(parsed.amount || "0");
    const paynowRef = parsed.paynowreference || "";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isPaid = status === "paid" || status === "awaiting delivery" || status === "delivered";

    if (isPaid && reference?.startsWith("order_")) {
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: paynowRef || reference,
          status: "placed",
        })
        .eq("payment_reference", reference);
    }

    if (isPaid && reference?.startsWith("wallet_topup_")) {
      const internalRef = `paynow:${paynowRef || reference}`;
      const { data: existing } = await admin
        .from("wallet_transactions")
        .select("id")
        .eq("reference", internalRef)
        .maybeSingle();
      if (!existing && Number.isFinite(amount) && amount > 0) {
        await admin.rpc("apply_wallet_transaction", {
          _user_id: userId,
          _kind: "topup",
          _amount: amount,
          _description: `Paynow top-up $${amount.toFixed(2)}`,
          _reference: internalRef,
        });
      }
    }

    return json({ status, amount, paid: isPaid, paynowReference: paynowRef });
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
