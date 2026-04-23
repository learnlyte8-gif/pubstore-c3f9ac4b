// Captures a PayPal order and credits the wallet via apply_wallet_transaction.
// Idempotent: refuses to credit twice for the same PayPal capture id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_ENV = (Deno.env.get("PAYPAL_ENV") || "live").toLowerCase();
const PAYPAL_BASE =
  PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

async function getAccessToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials not configured");

  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!r.ok) {
    console.error("paypal token error", { env: PAYPAL_ENV, base: PAYPAL_BASE, paypal: j });
    throw new Error(
      j?.error === "invalid_client"
        ? `PayPal rejected the credentials for ${PAYPAL_ENV} mode.`
        : "PayPal auth failed",
    );
  }
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userRes, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const orderID: string | undefined = body?.orderID;
    if (!orderID) return json({ error: "orderID required" }, 400);

    // 1) Capture with PayPal
    const accessToken = await getAccessToken();
    const capRes = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const capJson = await capRes.json();
    if (!capRes.ok) {
      console.error("capture failed", capJson);
      return json({ error: capJson?.message || "PayPal capture failed" }, 502);
    }

    const status = capJson?.status;
    const capture = capJson?.purchase_units?.[0]?.payments?.captures?.[0];
    if (status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") {
      return json({ error: "Payment was not completed" }, 402);
    }

    const captureId: string = capture.id;
    const amount = Number(capture.amount?.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Invalid capture amount" }, 502);
    }

    // 2) Idempotency: have we already credited this capture?
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const reference = `paypal:${captureId}`;
    const { data: existing } = await admin
      .from("wallet_transactions")
      .select("id, amount, balance_after")
      .eq("user_id", userId)
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return json({ ok: true, alreadyCredited: true, amount });
    }

    // 3) Credit via the secure RPC
    const { data: tx, error: rpcErr } = await admin.rpc("apply_wallet_transaction", {
      _user_id: userId,
      _kind: "topup",
      _amount: amount,
      _description: `PayPal top-up $${amount.toFixed(2)}`,
      _reference: reference,
    });
    if (rpcErr) {
      console.error("rpc error", rpcErr);
      return json({ error: "Could not credit wallet" }, 500);
    }

    return json({ ok: true, amount, transaction: tx });
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
