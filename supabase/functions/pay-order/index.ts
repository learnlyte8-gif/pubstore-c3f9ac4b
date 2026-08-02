// pay-order — pays an existing order from the buyer's wallet balance.
// Validates the caller's JWT in-code, then delegates all balance/order state
// changes to the SECURITY DEFINER RPC `pay_order_with_wallet`.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const orderId = String((body as any)?.orderId ?? (body as any)?.order_id ?? "");
    if (!UUID_RE.test(orderId)) return json({ error: "A valid orderId is required" }, 400);

    // RPC runs as the authenticated user and authorizes ownership internally.
    const { data, error } = await userClient.rpc("pay_order_with_wallet", {
      _order_id: orderId,
    });

    if (error) {
      console.error("pay_order_with_wallet failed", error);
      return json({ error: error.message || "Payment failed" }, 400);
    }

    return json({ ok: true, transaction: data });
  } catch (e) {
    console.error("pay-order error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
