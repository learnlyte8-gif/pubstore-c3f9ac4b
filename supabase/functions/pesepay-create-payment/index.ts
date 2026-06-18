// Initiates a Pesepay hosted-checkout transaction for either:
//   - "wallet_topup": amount goes to wallet on success
//   - "order": pays one or more orders (marked awaiting_payment)
//
// Pesepay docs: https://documenter.getpostman.com/view/8395054/UVRHiNne
// We use the "Initiate Transaction" hosted-checkout endpoint, which returns
// a `redirectUrl` we hop the user to. On completion Pesepay calls our
// resultUrl webhook (pesepay-result) and we credit the wallet / mark orders paid.
//
// All Pesepay request payloads must be AES-256-CBC encrypted using the
// encryption key (32 bytes used as both KEY and IV per Pesepay's spec) and
// the resulting ciphertext base64-encoded into a single `payload` field.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pesepayRequest } from "../_shared/pesepay-http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolvePesepayApiBase(): string {
  const configured = (Deno.env.get("PESEPAY_BASE_URL") || "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  const env = (Deno.env.get("PESEPAY_ENV") || "live").trim().toLowerCase();
  return env === "sandbox"
    ? "https://api.test.sandbox.pesepay.com/payments-engine"
    : "https://api.pesepay.com/api/payments-engine";
}

const PESEPAY_INITIATE = `${resolvePesepayApiBase()}/v1/payments/initiate`;

/** Keep only printable ASCII (0x21-0x7E). Header values must be valid HTTP token chars. */
function cleanHeader(v: string): string {
  return v.replace(/[^\x21-\x7E]/g, "");
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Pad to AES block (PKCS7) and encrypt with AES-256-CBC. Key/IV are first 32/16 bytes of the encryption key. */
async function encryptPayload(plain: string, encryptionKey: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(encryptionKey).slice(0, 32);
  const iv = keyBytes.slice(0, 16);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    new TextEncoder().encode(plain),
  );
  return b64encode(new Uint8Array(cipher));
}

async function decryptPayload(b64: string, encryptionKey: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(encryptionKey).slice(0, 32);
  const iv = keyBytes.slice(0, 16);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    b64decode(b64),
  );
  return new TextDecoder().decode(plain);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const integrationKeyRaw = Deno.env.get("PESEPAY_INTEGRATION_KEY");
    const encryptionKeyRaw = Deno.env.get("PESEPAY_ENCRYPTION_KEY");
    if (!integrationKeyRaw || !encryptionKeyRaw) return json({ error: "Pesepay not configured" }, 500);
    const integrationKey = cleanHeader(integrationKeyRaw);
    const encryptionKey = encryptionKeyRaw.replace(/^[\s"']+|[\s"']+$/g, "");
    console.log("pesepay key lens", {
      intRaw: integrationKeyRaw.length,
      intClean: integrationKey.length,
      encRaw: encryptionKeyRaw.length,
      encClean: encryptionKey.length,
      baseUrl: resolvePesepayApiBase(),
    });

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
    const purpose: "wallet_topup" | "order" = body?.purpose;
    const email: string = body?.email ?? userRes.user.email ?? "buyer@pubstore.world";
    const returnUrl: string = body?.returnUrl;
    const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds : [];
    let amount = Number(body?.amount);

    if (purpose !== "wallet_topup" && purpose !== "order") {
      return json({ error: "purpose is required" }, 400);
    }
    if (!returnUrl) return json({ error: "returnUrl required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (purpose === "order") {
      if (!orderIds.length) return json({ error: "orderIds required" }, 400);
      const { data: orders, error: ordErr } = await admin
        .from("orders")
        .select("id, total, buyer_id, payment_status")
        .in("id", orderIds);
      if (ordErr || !orders) return json({ error: "Could not load orders" }, 500);
      if (orders.some((o) => o.buyer_id !== userId)) return json({ error: "Forbidden" }, 403);
      if (orders.some((o) => o.payment_status === "paid")) {
        return json({ error: "One or more orders are already paid" }, 400);
      }
      amount = orders.reduce((s, o) => s + Number(o.total), 0);
    }
    if (!Number.isFinite(amount) || amount < 1) return json({ error: "Invalid amount" }, 400);

    // Internal merchant reference. Pesepay echoes this back in the webhook.
    const merchantReference = `${purpose}_${userId.slice(0, 8)}_${Date.now()}`;
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const resultUrl = `${projectUrl}/functions/v1/pesepay-result`;

    const description = purpose === "wallet_topup"
      ? "PUBSTORE Pay top-up"
      : `PUBSTORE order(s) ${orderIds.join(",")}`;

    // Pesepay "Initiate Transaction" payload. Currency USD by default for Zim merchants.
    const innerPayload = {
      amountDetails: { amount: Number(amount.toFixed(2)), currencyCode: "USD" },
      reasonForPayment: description,
      resultUrl,
      returnUrl,
      merchantReference,
      customer: { email },
    };

    const encrypted = await encryptPayload(JSON.stringify(innerPayload), encryptionKey);

    const initRes = await fetch(PESEPAY_INITIATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": integrationKey,
      },
      body: JSON.stringify({ payload: encrypted }),
    });
    const initJson = await initRes.json().catch(() => ({}));
    if (!initRes.ok) {
      console.error("pesepay initiate failed", initRes.status, initJson);
      return json({ error: initJson?.message || "Pesepay rejected the request" }, 502);
    }

    // Response is again an encrypted payload field.
    let responseInner: any = initJson;
    if (typeof initJson?.payload === "string") {
      try {
        const decoded = await decryptPayload(initJson.payload, encryptionKey);
        responseInner = JSON.parse(decoded);
      } catch (e) {
        console.error("pesepay decrypt failed", e);
        return json({ error: "Could not decode Pesepay response" }, 502);
      }
    }

    const redirectUrl: string | undefined = responseInner.redirectUrl || initJson.redirectUrl;
    const referenceNumber: string | undefined = responseInner.referenceNumber || initJson.referenceNumber;

    if (!redirectUrl) {
      console.error("pesepay missing redirectUrl", responseInner);
      return json({ error: "Pesepay did not return a redirect URL" }, 502);
    }

    if (purpose === "order") {
      await admin
        .from("orders")
        .update({
          payment_method: "pesepay",
          payment_status: "pending",
          payment_reference: merchantReference,
          status: "awaiting_payment",
        })
        .in("id", orderIds);
    }

    return json({
      ok: true,
      reference: merchantReference,
      pesepayReference: referenceNumber,
      redirectUrl,
      amount: amount.toFixed(2),
    });
  } catch (e) {
    console.error("pesepay-create-payment error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
