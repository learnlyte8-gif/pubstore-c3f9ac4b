import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export const AI_TRIAL_ACTIONS = 10;

export type AiPlan = {
  code: string;
  name: string;
  price_usd: number;
  monthly_credits: number;
  blurb: string | null;
  sort_order: number;
};

export type AiCreditPack = {
  code: string;
  name: string;
  credits: number;
  price_usd: number;
  bonus_label: string | null;
  sort_order: number;
};

export type AiFeatureCost = {
  feature: string;
  label: string;
  credits: number;
  notes: string | null;
};

export type AiAccount = {
  balance: number;
  plan_code: string;
  plan_renews_at: string | null;
  trial_used: number;
  lifetime_credits_purchased: number;
  lifetime_credits_spent: number;
};

export type AiLedgerEntry = {
  id: string;
  delta: number;
  balance_after: number;
  kind: string;
  feature: string | null;
  description: string | null;
  created_at: string;
};

export function useAiCredits() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const plans = useQuery({
    queryKey: ["ai-plans"],
    queryFn: async (): Promise<AiPlan[]> => {
      const { data } = await sb
        .from("ai_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as AiPlan[];
    },
  });

  const packs = useQuery({
    queryKey: ["ai-credit-packs"],
    queryFn: async (): Promise<AiCreditPack[]> => {
      const { data } = await sb
        .from("ai_credit_packs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as AiCreditPack[];
    },
  });

  const costs = useQuery({
    queryKey: ["ai-feature-costs"],
    queryFn: async (): Promise<AiFeatureCost[]> => {
      const { data } = await sb
        .from("ai_feature_costs")
        .select("*")
        .eq("is_active", true)
        .order("credits");
      return (data ?? []) as AiFeatureCost[];
    },
  });

  const account = useQuery({
    queryKey: ["ai-account", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AiAccount | null> => {
      const { data } = await sb
        .from("ai_credit_accounts")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      return (data ?? null) as AiAccount | null;
    },
  });

  const ledger = useQuery({
    queryKey: ["ai-ledger", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AiLedgerEntry[]> => {
      const { data } = await sb
        .from("ai_credit_ledger")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as AiLedgerEntry[];
    },
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["ai-account", userId] });
    qc.invalidateQueries({ queryKey: ["ai-ledger", userId] });
    qc.invalidateQueries({ queryKey: ["wallet", userId] });
    qc.invalidateQueries({ queryKey: ["wallet-tx", userId] });
  }, [qc, userId]);

  const buyPack = useMutation({
    mutationFn: async (packCode: string) => {
      const { data, error } = await sb.rpc("ai_buy_credit_pack", { _pack_code: packCode });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });

  const subscribe = useMutation({
    mutationFn: async (planCode: string) => {
      const { data, error } = await sb.rpc("ai_subscribe_plan", { _plan_code: planCode });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });

  const trialRemaining = Math.max(0, AI_TRIAL_ACTIONS - (account.data?.trial_used ?? 0));

  return {
    userId,
    balance: account.data?.balance ?? 0,
    account: account.data ?? null,
    trialRemaining,
    planCode: account.data?.plan_code ?? "free",
    plans: plans.data ?? [],
    packs: packs.data ?? [],
    costs: costs.data ?? [],
    ledger: ledger.data ?? [],
    loading: plans.isLoading || packs.isLoading || (!!userId && account.isLoading),
    buyPack,
    subscribe,
    refresh,
  };
}
