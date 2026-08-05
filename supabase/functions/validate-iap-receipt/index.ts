import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await anon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const authedUserId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null) as
      | { platform?: string; receipt?: string; planCode?: string; userId?: string }
      | null;
    const platform = body?.platform;
    const receipt = body?.receipt;
    const planCode = body?.planCode;

    if (!receipt || !planCode || (platform !== "ios" && platform !== "android")) {
      return json({ error: "Missing or invalid fields: platform, receipt, planCode" }, 400);
    }
    // Never trust a client-supplied user id.
    if (body?.userId && body.userId !== authedUserId) {
      return json({ error: "User mismatch" }, 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ─── Validate receipt with Apple / Google ────────────────────────────
    // TODO production: verify with Apple App Store Server API (verifyReceipt)
    // and Google Play Developer API (purchases.subscriptions.get).
    let isValid = false;
    let transactionId: string | null = null;

    if (platform === "ios") {
      try {
        const decoded = atob(receipt);
        if (decoded.length > 100) {
          isValid = true;
          transactionId = `ios_${authedUserId}_${Date.now()}`;
        }
      } catch {
        isValid = false;
      }
    } else if (receipt.length > 20) {
      isValid = true;
      transactionId = `android_${authedUserId}_${Date.now()}`;
    }

    if (!isValid) return json({ error: "Invalid receipt" }, 400);

    // ─── Resolve the caller's store ──────────────────────────────────────
    const { data: supplier, error: supplierError } = await admin
      .from("suppliers")
      .select("id")
      .eq("user_id", authedUserId)
      .maybeSingle();

    if (supplierError) return json({ error: supplierError.message }, 500);
    if (!supplier) return json({ error: "No supplier store for this account" }, 400);

    const { data: plan, error: planError } = await admin
      .from("supplier_plans")
      .select("code, is_active")
      .eq("code", planCode)
      .maybeSingle();

    if (planError) return json({ error: planError.message }, 500);
    if (!plan?.is_active) return json({ error: "Unknown or inactive plan" }, 400);

    // Idempotency: same plan still active → do not extend again.
    const { data: existing } = await admin
      .from("supplier_subscriptions")
      .select("plan_code, renews_at")
      .eq("supplier_id", supplier.id)
      .maybeSingle();

    if (
      existing?.plan_code === planCode &&
      existing.renews_at &&
      new Date(existing.renews_at).getTime() > Date.now()
    ) {
      return json({ ok: true, alreadyActive: true, renews_at: existing.renews_at });
    }

    const now = new Date();
    const renewsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: upsertError } = await admin
      .from("supplier_subscriptions")
      .upsert(
        {
          supplier_id: supplier.id,
          plan_code: planCode,
          started_at: now.toISOString(),
          renews_at: renewsAt.toISOString(),
        },
        { onConflict: "supplier_id" },
      );

    if (upsertError) return json({ error: upsertError.message }, 500);

    return json({ ok: true, plan_code: planCode, renews_at: renewsAt.toISOString(), transactionId });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
