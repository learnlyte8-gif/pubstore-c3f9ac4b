// Initiates a Paynow payment for either:
//   - "wallet_topup": amount goes to wallet on success
//   - "order": pays one or more orders (the function marks them awaiting_payment)
// Supports two flows:
//   - "web"     -> returns { redirect_url } for hosted Paynow checkout (Visa, EcoCash WebApp, ZIPIT…)
//   - "express" -> Paynow "Mobile" remote transaction; user gets the EcoCash/OneMoney USSD prompt
// Docs: https://developers.paynow.co.zw/docs/integration_types.html

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYNOW_INITIATE = "https://www.paynow.co.zw/interface/initiatetransaction";
const PAYNOW_REMOTE = "https://www.paynow.co.zw/interface/remotetransaction";
const PAYNOW_FETCH_RETRIES = 3;
const PAYNOW_FETCH_TIMEOUT_MS = 12000;

async function paynowHash(values: Record<string, string>, integrationKey: string): Promise<string> {
  const concat = Object.values(values).join("") + integrationKey;
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(concat));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function toFormBody(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

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

function isRetryablePaynowError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /connection reset by peer|client error \(connect\)|timed out|unexpected eof|broken pipe/i.test(message);
}

async function postToPaynow(endpoint: string, formBody: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= PAYNOW_FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Connection": "close",
        },
        body: formBody,
        signal: AbortSignal.timeout(PAYNOW_FETCH_TIMEOUT_MS),
      });

      return await response.text();
    } catch (error) {
      lastError = error;
      console.error(`paynow request attempt ${attempt} failed`, error);

      if (attempt === PAYNOW_FETCH_RETRIES || !isRetryablePaynowError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }

  throw lastError ?? new Error("Paynow request failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const id = Deno.env.get("PAYNOW_INTEGRATION_ID");
    const key = Deno.env.get("PAYNOW_INTEGRATION_KEY");
    if (!id || !key) return json({ error: "Paynow not configured" }, 500);

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
    const flow: "web" | "express" = body?.flow ?? "web";
    const email: string = body?.email ?? userRes.user.email ?? "buyer@pubstore.world";
    const phone: string = body?.phone ?? "";
    const method: "ecocash" | "onemoney" = body?.method ?? "ecocash";
    const returnUrl: string = body?.returnUrl;
    const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds : [];
    let amount = Number(body?.amount);

    if (!purpose || (purpose !== "wallet_topup" && purpose !== "order")) {
      return json({ error: "purpose is required" }, 400);
    }
    if (flow === "web" && !returnUrl) return json({ error: "returnUrl required for web flow" }, 400);
    if (flow === "express" && (!phone || phone.length < 9)) {
      return json({ error: "Phone number required for express EcoCash/OneMoney" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate amount against the actual orders to prevent client-side tampering
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

    // Our internal reference (Paynow returns this back on result/poll).
    const reference = `${purpose}_${userId.slice(0, 8)}_${Date.now()}`;
    const value = amount.toFixed(2);
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const resultUrl = `${projectUrl}/functions/v1/paynow-result`;

    const additionalInfo = purpose === "wallet_topup"
      ? "PUBSTORE Pay top-up"
      : `PUBSTORE order(s) ${orderIds.join(",")}`;

    // Build form values in the exact order the docs expect (order matters for hashing).
    const values: Record<string, string> = {
      id,
      reference,
      amount: value,
      additionalinfo: additionalInfo,
      returnurl: returnUrl || `${projectUrl}/functions/v1/paynow-result`,
      resulturl: resultUrl,
      authemail: email,
    };
    if (flow === "express") {
      values.phone = phone.replace(/\D/g, "");
      values.method = method;
    }
    values.status = "Message";

    const hash = await paynowHash(values, key);
    const formBody = toFormBody({ ...values, hash });

    const endpoint = flow === "express" ? PAYNOW_REMOTE : PAYNOW_INITIATE;
    let text: string;
    try {
      text = await postToPaynow(endpoint, formBody);
    } catch (error) {
      return json(
        {
          error: flow === "express"
            ? "Mobile money service is temporarily unavailable. Please try again in a moment or use Paynow Web / PayPal instead."
            : "Paynow is temporarily unavailable. Please try again in a moment.",
        },
        502,
      );
    }

    const parsed = parsePaynowResponse(text);
    if ((parsed.status || "").toLowerCase() !== "ok") {
      console.error("paynow init failed", parsed);
      return json({ error: parsed.error || "Paynow rejected the request", paynow: parsed }, 502);
    }

    // Persist the pending payment so the result webhook can match it back.
    if (purpose === "order") {
      await admin
        .from("orders")
        .update({
          payment_method: flow === "express" ? `paynow_${method}` : "paynow",
          payment_status: "pending",
          payment_reference: reference,
          status: "awaiting_payment",
        })
        .in("id", orderIds);
    }
    // Wallet top-ups are credited only after the webhook confirms — no row created yet.

    const out: Record<string, unknown> = {
      ok: true,
      reference,
      pollUrl: parsed.pollurl,
      amount: value,
    };
    if (flow === "web") out.redirectUrl = parsed.browserurl;
    if (flow === "express") {
      out.instructions = parsed.instructions;
      out.method = method;
    }
    return json(out);
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
