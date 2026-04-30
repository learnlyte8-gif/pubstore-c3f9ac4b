// Pesepay webhook (resultUrl). Called server-to-server after payment completes.
// Body is JSON with an encrypted `payload` field. We decrypt, then either credit
// the wallet or mark the matching orders as paid — idempotently.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logPaymentStatus(
  admin: ReturnType<typeof createClient>,
  {
    userId,
    purpose,
    merchantReference,
    gatewayReference,
    status,
    amount,
    details = {},
  }: {
    userId: string;
    purpose: string;
    merchantReference: string;
    gatewayReference?: string;
    status: string;
    amount?: number;
    details?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("payment_status_history").upsert({
    user_id: userId,
    provider: "pesepay",
    purpose,
    merchant_reference: merchantReference,
    gateway_reference: gatewayReference ?? null,
    status,
    amount: amount ?? null,
    currency: "USD",
    details,
  }, {
    onConflict: "provider,merchant_reference,status",
    ignoreDuplicates: true,
  });

  if (error) console.error("payment history log failed", error);
}

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

    let inner: any = body;
    if (typeof body?.payload === "string") {
      try { inner = JSON.parse(await decryptPayload(body.payload, encryptionKey)); }
      catch (e) { console.error("pesepay-result decrypt", e); return new Response("bad payload", { status: 400 }); }
    }

    const merchantReference: string = inner.merchantReference || inner.referenceNumber || "";
    const pesepayReference: string = inner.referenceNumber || inner.applicationCode || "";
    const status: string = String(inner.transactionStatus || inner.status || "").toUpperCase();
    const amount = Number(inner.amount || inner?.amountDetails?.amount || 0);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const purpose = merchantReference.startsWith("order_") ? "order" : "wallet_topup";

    const paid = status === "SUCCESS" || status === "PAID" || status === "AUTHORIZED";

    if (!paid) {
      if (merchantReference.startsWith("wallet_topup_")) {
        const userPrefix = merchantReference.split("_")[2];
        const { data: candidates } = await admin
          .from("profiles")
          .select("user_id")
          .ilike("user_id", `${userPrefix}%`)
          .limit(1);
        const uid = candidates?.[0]?.user_id;
        if (uid) {
          await logPaymentStatus(admin, {
            userId: uid,
            purpose,
            merchantReference,
            gatewayReference: pesepayReference,
            status: "pending",
            amount,
            details: { gatewayStatus: status },
          });
        }
      }

      if (merchantReference.startsWith("order_")) {
        await admin
          .from("orders")
          .update({ payment_status: status === "CANCELLED" ? "cancelled" : "failed" })
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

       await logPaymentStatus(admin, {
        userId: uid,
        purpose,
        merchantReference,
        gatewayReference: pesepayReference,
        status: "confirming",
        amount,
        details: { gatewayStatus: status },
      });

      await admin.rpc("apply_wallet_transaction", {
        _user_id: uid,
        _kind: "topup",
        _amount: amount,
        _description: `Pesepay top-up $${amount.toFixed(2)}`,
        _reference: internalRef,
      });

      await logPaymentStatus(admin, {
        userId: uid,
        purpose,
        merchantReference,
        gatewayReference: pesepayReference,
        status: "credited",
        amount,
        details: { gatewayStatus: status, internalReference: internalRef },
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
