// Paynow webhook (resulturl). Paynow POSTs form-urlencoded fields when the
// payment completes. We verify the SHA-512 hash, then either credit the wallet
// or mark the matching orders as paid — idempotently.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHash } from "https://deno.land/std@0.190.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function verifyHash(fields: Record<string, string>, key: string): boolean {
  const sent = (fields.hash || "").toUpperCase();
  if (!sent) return false;
  const { hash: _omit, ...rest } = fields;
  const concat = Object.values(rest).join("") + key;
  const expected = createHash("sha512").update(concat).digest("hex").toUpperCase();
  return expected === sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get("PAYNOW_INTEGRATION_KEY");
    if (!key) return new Response("misconfigured", { status: 500 });

    const text = await req.text();
    // Paynow may post either as form-urlencoded or as the same line-based key=value format
    const params = new URLSearchParams(text);
    const fields: Record<string, string> = {};
    for (const [k, v] of params) fields[k] = v;

    if (!verifyHash(fields, key)) {
      console.error("paynow webhook: bad hash", { reference: fields.reference });
      return new Response("bad hash", { status: 400 });
    }

    const reference = fields.reference || "";
    const status = (fields.status || "").toLowerCase();
    const paynowRef = fields.paynowreference || "";
    const amount = Number(fields.amount || "0");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (status !== "paid" && status !== "awaiting delivery" && status !== "delivered") {
      // Mark order(s) failed if applicable; nothing to do for wallet top-ups.
      if (reference.startsWith("order_")) {
        await admin
          .from("orders")
          .update({ payment_status: status === "cancelled" ? "cancelled" : "failed" })
          .eq("payment_reference", reference);
      }
      return new Response("ok", { status: 200 });
    }

    if (reference.startsWith("wallet_topup_")) {
      const userId = reference.split("_")[2]; // first 8 chars only — re-derive
      // We stored only the prefix, so look up the latest topup row by reference.
      // Idempotency: don't double-credit the same paynow ref.
      const internalRef = `paynow:${paynowRef || reference}`;
      const { data: existing } = await admin
        .from("wallet_transactions")
        .select("id")
        .eq("reference", internalRef)
        .maybeSingle();
      if (existing) return new Response("ok", { status: 200 });

      // Find the user. Reference encodes the first 8 chars of the uid; match it.
      const { data: candidates } = await admin
        .from("profiles")
        .select("user_id")
        .ilike("user_id", `${userId}%`)
        .limit(1);
      const uid = candidates?.[0]?.user_id;
      if (!uid) return new Response("user not found", { status: 200 });

      await admin.rpc("apply_wallet_transaction", {
        _user_id: uid,
        _kind: "topup",
        _amount: amount,
        _description: `Paynow top-up $${amount.toFixed(2)}`,
        _reference: internalRef,
      });
      return new Response("ok", { status: 200 });
    }

    if (reference.startsWith("order_")) {
      // Mark order(s) paid.
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_reference: paynowRef || reference,
          status: "placed",
        })
        .eq("payment_reference", reference);
      return new Response("ok", { status: 200 });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("paynow-result error", e);
    return new Response("err", { status: 500 });
  }
});
