// Polls Pesepay for the latest status of a transaction by referenceNumber
// (Pesepay's id) and applies the side-effects idempotently:
//   - "wallet_topup_*"  -> credit the wallet exactly once
//   - "order_*"         -> mark matching orders paid
//
// Called from the client when the user returns from Pesepay's hosted checkout.
// The webhook (pesepay-result) does the same work server-to-server, so this is
// just a "no-wait" confirmation path for the UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolvePesepayApiBase(): string {
  const configured = (Deno.env.get("PESEPAY_BASE_URL") || "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  const env = (Deno.env.get("PESEPAY_ENV") || "sandbox").trim().toLowerCase();
  return env === "live"
    ? "https://api.pesepay.com/api/payments-engine"
    : "https://api.test.sandbox.pesepay.com/payments-engine";
}

const PESEPAY_CHECK = `${resolvePesepayApiBase()}/v1/payments/check-payment`;

function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
async function decryptPayload(b64: string, encryptionKey: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(encryptionKey).slice(0, 32);
  const iv = keyBytes.slice(0, 16);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, b64decode(b64));
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const integrationKeyRaw = Deno.env.get("PESEPAY_INTEGRATION_KEY");
    const encryptionKeyRaw = Deno.env.get("PESEPAY_ENCRYPTION_KEY");
    if (!integrationKeyRaw || !encryptionKeyRaw) return json({ error: "Pesepay not configured" }, 500);
    const integrationKey = integrationKeyRaw.replace(/[^\x21-\x7E]/g, "");
    const encryptionKey = encryptionKeyRaw.replace(/^[\s"']+|[\s"']+$/g, "");

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
    const reference: string = body?.reference || "";
    const pesepayReference: string = body?.pesepayReference || "";
    if (!pesepayReference) return json({ error: "pesepayReference required" }, 400);

    const url = `${PESEPAY_CHECK}?referenceNumber=${encodeURIComponent(pesepayReference)}`;
    const checkRes = await fetch(url, {
      method: "GET",
      headers: { "authorization": integrationKey, "Content-Type": "application/json" },
    });
    const checkJson = await checkRes.json().catch(() => ({}));
    if (!checkRes.ok) {
      console.error("pesepay check failed", checkRes.status, checkJson);
      return json({ error: checkJson?.message || "Pesepay check failed" }, 502);
    }

    let inner: any = checkJson;
    if (typeof checkJson?.payload === "string") {
      try {
        inner = JSON.parse(await decryptPayload(checkJson.payload, encryptionKey));
      } catch (e) { console.error("decrypt failed", e); }
    }

    const status: string = String(inner.transactionStatus || inner.status || "").toUpperCase();
    const paid = status === "SUCCESS" || status === "PAID" || status === "AUTHORIZED";
    const amount = Number(inner.amount || inner?.amountDetails?.amount || 0);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (paid && reference.startsWith("wallet_topup_")) {
      const internalRef = `pesepay:${pesepayReference}`;
      const { data: existing } = await admin
        .from("wallet_transactions")
        .select("id")
        .eq("reference", internalRef)
        .maybeSingle();
      if (!existing && amount > 0) {
        await admin.rpc("apply_wallet_transaction", {
          _user_id: userId,
          _kind: "topup",
          _amount: amount,
          _description: `Pesepay top-up $${amount.toFixed(2)}`,
          _reference: internalRef,
        });
      }
    }

    if (paid && reference.startsWith("order_")) {
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: pesepayReference || reference,
          status: "placed",
        })
        .eq("payment_reference", reference);
    }

    if (!paid && reference.startsWith("order_") && (status === "CANCELLED" || status === "FAILED")) {
      await admin
        .from("orders")
        .update({ payment_status: status === "CANCELLED" ? "cancelled" : "failed" })
        .eq("payment_reference", reference);
    }

    return json({ ok: true, paid, status, amount });
  } catch (e) {
    console.error("pesepay-status error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
