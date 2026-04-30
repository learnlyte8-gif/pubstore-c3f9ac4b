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

async function getExistingPaymentState(
  admin: ReturnType<typeof createClient>,
  merchantReference: string,
  pesepayReference: string,
) {
  const [{ data: credited }, { data: latest }] = await Promise.all([
    admin
      .from("payment_status_history")
      .select("status, amount, gateway_reference, details, created_at")
      .eq("provider", "pesepay")
      .eq("merchant_reference", merchantReference)
      .eq("status", "credited")
      .maybeSingle(),
    admin
      .from("payment_status_history")
      .select("status, amount, gateway_reference, details, created_at")
      .eq("provider", "pesepay")
      .eq("merchant_reference", merchantReference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (credited) {
    return {
      paid: true,
      status: "SUCCESS",
      amount: Number(credited.amount ?? latest?.amount ?? 0),
      referenceNumber: credited.gateway_reference || pesepayReference || "",
      source: "history",
    };
  }

  if (latest) {
    return {
      paid: false,
      status: String(latest.status || "PENDING").toUpperCase(),
      amount: Number(latest.amount ?? 0),
      referenceNumber: latest.gateway_reference || pesepayReference || "",
      source: "history",
    };
  }

  return null;
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
    let pesepayReference: string = body?.pesepayReference || "";
    let pollUrlRaw: string = body?.pollUrl || "";
    if (!reference && !pesepayReference && !pollUrlRaw) {
      return json({ error: "reference, pesepayReference or pollUrl required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // If we only have the merchantReference, look up the gateway reference / pollUrl from history
    if (!pesepayReference && !pollUrlRaw && reference) {
      const { data: hist } = await admin
        .from("payment_status_history")
        .select("gateway_reference, details")
        .eq("provider", "pesepay")
        .eq("merchant_reference", reference)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hist?.gateway_reference) pesepayReference = hist.gateway_reference;
      const detailsPoll = (hist?.details as any)?.pollUrl;
      if (detailsPoll) pollUrlRaw = detailsPoll;
    }

    const existingState = await getExistingPaymentState(admin, reference, pesepayReference);
    if (existingState?.paid) {
      return json({ ok: true, ...existingState });
    }

    if (!pesepayReference && !pollUrlRaw) {
      // Nothing to poll yet — return whatever history we have (likely pending)
      if (existingState) return json({ ok: true, ...existingState });
      return json({ ok: true, paid: false, status: "PENDING", amount: 0, referenceNumber: "" });
    }

    const url = pollUrlRaw || `${PESEPAY_CHECK}?referenceNumber=${encodeURIComponent(pesepayReference)}`;
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
    let decryptFailed = false;
    if (typeof checkJson?.payload === "string") {
      try {
        inner = JSON.parse(await decryptPayload(checkJson.payload, encryptionKey));
      } catch (e) {
        decryptFailed = true;
        console.error("decrypt failed", e);
        console.log("pesepay check raw response", JSON.stringify(checkJson));
      }
    }

    const status: string = String(inner.transactionStatus || inner.status || checkJson?.transactionStatus || checkJson?.status || "").toUpperCase();
    const amount = Number(inner.amount || inner?.amountDetails?.amount || checkJson?.amount || checkJson?.amountDetails?.amount || 0);
    const gatewayReference = String(inner.referenceNumber || inner.applicationCode || checkJson?.referenceNumber || pesepayReference || "");
    const paid = status === "SUCCESS" || status === "PAID" || status === "AUTHORIZED";
    const failed = status === "FAILED" || status === "CANCELLED" || status === "DECLINED";

    if (decryptFailed && existingState) {
      return json({ ok: true, ...existingState, source: "history-fallback" });
    }

    await logPaymentStatus(admin, {
      userId,
      purpose: reference.startsWith("order_") ? "order" : "wallet_topup",
      merchantReference: reference,
      gatewayReference,
      status: paid ? "confirming" : failed ? "failed" : "pending",
      amount,
      details: { gatewayStatus: status, pollUrl: pollUrlRaw || null, decryptFailed },
    });

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

      await logPaymentStatus(admin, {
        userId,
        purpose: "wallet_topup",
        merchantReference: reference,
        gatewayReference,
        status: "credited",
        amount,
        details: { gatewayStatus: status, internalReference: internalRef },
      });
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

    if (!paid && reference.startsWith("order_") && failed) {
      await admin
        .from("orders")
        .update({ payment_status: status === "CANCELLED" ? "cancelled" : "failed" })
        .eq("payment_reference", reference);
    }

    const historyState = await getExistingPaymentState(admin, reference, gatewayReference || pesepayReference);
    if (!paid && decryptFailed && historyState) {
      return json({ ok: true, ...historyState, source: "history-after-poll" });
    }

    return json({ ok: true, paid, status, amount, referenceNumber: gatewayReference, decryptFailed });
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
