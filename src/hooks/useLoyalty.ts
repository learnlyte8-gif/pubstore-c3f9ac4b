import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type LoyaltyTx = {
  id: string;
  delta: number;
  reason: string;
  reference: string | null;
  created_at: string;
};

export function useLoyalty() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const points = useQuery({
    queryKey: ["loyalty-points", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await sb.from("loyalty_points").select("balance, lifetime_earned").eq("user_id", userId).maybeSingle();
      return { balance: Number(data?.balance ?? 0), lifetime: Number(data?.lifetime_earned ?? 0) };
    },
  });

  const ledger = useQuery({
    queryKey: ["loyalty-ledger", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LoyaltyTx[]> => {
      const { data } = await sb.from("loyalty_ledger").select("*").order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const redeem = async (pts: number): Promise<{ code: string; value: number }> => {
    const { data, error } = await sb.rpc("redeem_loyalty_points", { _points: pts });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["loyalty-points", userId] });
    qc.invalidateQueries({ queryKey: ["loyalty-ledger", userId] });
    return { code: data.code, value: Number(data.value) };
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["loyalty-points", userId] });
    qc.invalidateQueries({ queryKey: ["loyalty-ledger", userId] });
  };

  return {
    userId,
    balance: points.data?.balance ?? 0,
    lifetime: points.data?.lifetime ?? 0,
    transactions: ledger.data ?? [],
    isLoading: points.isLoading,
    redeem,
    refresh,
  };
}
