// Pesepay webhook (resultUrl). Called server-to-server after payment completes.
// The body MUST be a JSON object with an encrypted `payload` field — we refuse
// requests that don't include one so an attacker can't forge a plain-JSON
// callback marking their own orders as paid.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { interpretPesepay } from "../_shared/pesepay-status.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const encryptionKey = Deno.env.get("PESEPAY_ENCRYPTION_KEY");
    if (!encryptionKey) return new Response("misconfigured", { status: 500 });

    const raw = await req.text();
    let body: any = {};
    try { body = JSON.parse(raw); } catch { body = {}; }

    // SECURITY: only trust encrypted-payload callbacks. Anything else is
    // treated as forged and rejected — never fall back to raw JSON.
    if (!body || typeof body.payload !== "string" || body.payload.length === 0) {
      console.warn("pesepay-result: rejected request without encrypted payload");
      return new Response("bad payload", { status: 400 });
    }

    let inner: any;
    try {
      inner = JSON.parse(await decryptPayload(body.payload, encryptionKey));
    } catch (e) {
      console.error("pesepay-result decrypt", e);
      return new Response("bad payload", { status: 400 });
    }

    const outcome = interpretPesepay(inner);
    const merchantReference = outcome.merchantReference || outcome.referenceNumber;
    const pesepayReference = outcome.referenceNumber;
    const status = outcome.status;
    const amount = outcome.amount;
    console.log("pesepay-result outcome", { merchantReference, pesepayReference, status, paid: outcome.paid, amount });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const paid = outcome.paid;

    if (!paid) {
      // Only mark terminal outcomes — a PROCESSING/PENDING callback must not
      // flip the order to failed.
      if (merchantReference.startsWith("order_") && (outcome.cancelled || outcome.failed)) {
        await admin
          .from("orders")
          .update({ payment_status: outcome.cancelled ? "cancelled" : "failed" })
          .eq("payment_reference", merchantReference);
      }
      return new Response("ok", { status: 200 });
    }

    if (merchantReference.startsWith("wallet_topup_")) {
      const internalRef = `pesepay:${pesepayReference || merchantReference}`;
      const { data: existing } = await admin
        .from("wallet_transactions")
        .select("id")
        .eq("reference", internalRef)
        .maybeSingle();
      if (existing) return new Response("ok", { status: 200 });

      const userPrefix = merchantReference.split("_")[2];
      const { data: candidates } = await admin
        .from("profiles")
        .select("user_id")
        .ilike("user_id", `${userPrefix}%`)
        .limit(1);
      const uid = candidates?.[0]?.user_id;
      if (!uid) return new Response("user not found", { status: 200 });

      await admin.rpc("apply_wallet_transaction", {
        _user_id: uid,
        _kind: "topup",
        _amount: amount,
        _description: `Pesepay top-up $${amount.toFixed(2)}`,
        _reference: internalRef,
      });
      return new Response("ok", { status: 200 });
    }

    if (merchantReference.startsWith("order_")) {
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: pesepayReference || merchantReference,
          status: "placed",
        })
        .eq("payment_reference", merchantReference);
      return new Response("ok", { status: 200 });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("pesepay-result error", e);
    return new Response("err", { status: 500 });
  }
});
