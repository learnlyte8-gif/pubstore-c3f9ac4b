// Creates a PayPal Live order for a wallet top-up.
// Returns { orderID, amount } so the frontend SDK can render PayPal buttons.

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
    // Safe diagnostics — never log the secret itself.
    console.error("paypal token error", {
      env: PAYPAL_ENV,
      base: PAYPAL_BASE,
      clientIdPrefix: id.slice(0, 6),
      clientIdLength: id.length,
      paypal: j,
    });
    throw new Error(
      j?.error === "invalid_client"
        ? `PayPal rejected the credentials for ${PAYPAL_ENV} mode. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET match the ${PAYPAL_ENV} app in the PayPal Developer Dashboard.`
        : "Could not authenticate with PayPal",
    );
  }
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: require a logged-in user
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

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    const returnUrl: string | undefined = typeof body?.returnUrl === "string" ? body.returnUrl : undefined;
    const cancelUrl: string | undefined = typeof body?.cancelUrl === "string" ? body.cancelUrl : undefined;
    if (!Number.isFinite(amount) || amount < 1 || amount > 5000) {
      return json({ error: "Amount must be between $1 and $5000" }, 400);
    }
    if (!returnUrl || !cancelUrl) {
      return json({ error: "returnUrl and cancelUrl are required" }, 400);
    }
    const value = amount.toFixed(2);

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
            reference_id: `wallet_topup_${userRes.user.id}`,
            description: "PUBSTORE Pay top-up",
            amount: { currency_code: "USD", value },
          },
        ],
        application_context: {
          brand_name: "PUBSTORE",
          shipping_preference: "NO_SHIPPING",
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

    const approveLink = (orderJson?.links ?? []).find((l: any) => l?.rel === "approve" || l?.rel === "payer-action");
    if (!approveLink?.href) {
      console.error("no approve link", orderJson);
      return json({ error: "PayPal did not return an approval link" }, 502);
    }

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
