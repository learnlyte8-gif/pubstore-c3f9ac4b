// Creates a PayPal Live order for either a wallet top-up or paying real
// PUBSTORE order(s). Returns { orderID, approveUrl } so the frontend can
// redirect the buyer to PayPal's hosted checkout.

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
    console.error("paypal token error", { env: PAYPAL_ENV, paypal: j });
    throw new Error(
      j?.error === "invalid_client"
        ? `PayPal rejected the credentials for ${PAYPAL_ENV} mode.`
        : "Could not authenticate with PayPal",
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

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userRes, error: uErr } = await sb.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const purpose: "wallet_topup" | "order" = body?.purpose ?? "wallet_topup";
    const returnUrl: string | undefined = body?.returnUrl;
    const cancelUrl: string | undefined = body?.cancelUrl;
    const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds : [];
    let amount = Number(body?.amount);

    if (!returnUrl || !cancelUrl) return json({ error: "returnUrl and cancelUrl are required" }, 400);

    // Validate amount against the actual orders to prevent client-side tampering
    if (purpose === "order") {
      if (!orderIds.length) return json({ error: "orderIds required" }, 400);
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: orders } = await admin
        .from("orders")
        .select("id, total, buyer_id, payment_status")
        .in("id", orderIds);
      if (!orders) return json({ error: "Could not load orders" }, 500);
      if (orders.some((o) => o.buyer_id !== userId)) return json({ error: "Forbidden" }, 403);
      if (orders.some((o) => o.payment_status === "paid")) {
        return json({ error: "One or more orders are already paid" }, 400);
      }
      amount = orders.reduce((s, o) => s + Number(o.total), 0);
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      return json({ error: "Amount must be between $1 and $10000" }, 400);
    }
    const value = amount.toFixed(2);
    const reference = purpose === "order"
      ? `pubstore_order_${orderIds.join(",")}_${userId.slice(0, 8)}`
      : `wallet_topup_${userId}`;
    const description = purpose === "order"
      ? `PUBSTORE order${orderIds.length > 1 ? "s" : ""}`
      : "PUBSTORE Pay top-up";
    const noShipping = purpose === "wallet_topup";

    const accessToken = await getAccessToken();
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: reference,
            description,
            custom_id: orderIds.join(",") || undefined,
            amount: { currency_code: "USD", value },
          },
        ],
        application_context: {
          brand_name: "PUBSTORE",
          shipping_preference: noShipping ? "NO_SHIPPING" : "GET_FROM_FILE",
          user_action: "PAY_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });
    const orderJson = await orderRes.json();
    if (!orderRes.ok) {
      console.error("paypal order error", orderJson);
      return json({ error: orderJson?.message || "Could not create PayPal order" }, 502);
    }

    // Persist pending payment for orders
    if (purpose === "order") {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await admin
        .from("orders")
        .update({
          payment_method: "paypal",
          payment_status: "pending",
          payment_reference: `paypal:${orderJson.id}`,
          status: "awaiting_payment",
        })
        .in("id", orderIds);
    }

    const approveLink = (orderJson?.links ?? []).find((l: any) => l?.rel === "approve" || l?.rel === "payer-action");
    if (!approveLink?.href) return json({ error: "PayPal did not return an approval link" }, 502);

    return json({ orderID: orderJson.id, amount: value, approveUrl: approveLink.href });
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
