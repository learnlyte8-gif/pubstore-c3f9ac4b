// Shared AI credit metering for edge functions.
//
// Every AI feature charges the signed-in user's AI credit balance through the
// `ai_consume_credits` RPC (service role only). The first 10 AI actions per
// account are free (lifetime trial), after that credits are required.

import { createClient } from "npm:@supabase/supabase-js@2";

export type ChargeResult =
  | { ok: true; charged: number; balance: number; source: string; trialRemaining: number }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Resolve the caller from the Authorization header. */
export async function getCaller(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data } = await client.auth.getUser();
  return data?.user ?? null;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Charge `feature` to the caller's AI credits.
 * Returns a ready-to-send error payload when the caller can't pay.
 */
export async function chargeAiCredits(
  req: Request,
  feature: string,
  opts: { reference?: string; quantity?: number } = {},
): Promise<ChargeResult> {
  const user = await getCaller(req);
  if (!user) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "Sign in to use AI features.",
        code: "auth_required",
      },
    };
  }

  const { data, error } = await admin().rpc("ai_consume_credits", {
    _user_id: user.id,
    _feature: feature,
    _reference: opts.reference ?? null,
    _quantity: opts.quantity ?? 1,
  });

  if (error) {
    console.error("ai_consume_credits failed", feature, error.message);
    return {
      ok: false,
      status: 500,
      body: { error: "Could not verify your AI credits.", code: "credit_check_failed" },
    };
  }

  const res = (data ?? {}) as Record<string, unknown>;
  if (res.ok === false) {
    return {
      ok: false,
      status: 402,
      body: {
        error: "You're out of AI credits. Top up or upgrade your AI plan to continue.",
        code: "insufficient_ai_credits",
        required: res.required ?? null,
        balance: res.balance ?? 0,
        feature,
      },
    };
  }

  return {
    ok: true,
    charged: Number(res.charged ?? 0),
    balance: Number(res.balance ?? 0),
    source: String(res.source ?? "balance"),
    trialRemaining: Number(res.trial_remaining ?? 0),
  };
}

/** Refund a charge when the downstream AI call fails. */
export async function refundAiCredits(
  userId: string,
  feature: string,
  credits: number,
  reference?: string,
) {
  if (!credits) return;
  try {
    const sb = admin();
    const { data: acc } = await sb
      .from("ai_credit_accounts")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    const balance = Number(acc?.balance ?? 0) + credits;
    await sb.from("ai_credit_accounts").update({ balance }).eq("user_id", userId);
    await sb.from("ai_credit_ledger").insert({
      user_id: userId,
      delta: credits,
      balance_after: balance,
      kind: "refund",
      feature,
      description: "Refund for failed AI request",
      reference: reference ?? null,
    });
  } catch (e) {
    console.error("refundAiCredits failed", e);
  }
}
