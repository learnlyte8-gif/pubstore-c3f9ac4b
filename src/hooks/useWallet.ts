import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WalletTx = {
  id: string;
  kind: "topup" | "purchase" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  description: string | null;
  reference: string | null;
  created_at: string;
};

// The wallet tables were just added; cast through `any` until Supabase types regenerate.
const sb = supabase as any;

export function useWallet() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const balanceQuery = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { data } = await sb
        .from("wallets")
        .select("balance")
        .eq("user_id", userId!)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const txQuery = useQuery({
    queryKey: ["wallet-tx", userId],
    enabled: !!userId,
    queryFn: async (): Promise<WalletTx[]> => {
      const { data } = await sb
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as WalletTx[];
    },
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["wallet", userId] });
    qc.invalidateQueries({ queryKey: ["wallet-tx", userId] });
  }, [qc, userId]);

  // Live updates when a tx is inserted (top-up, purchase, refund).
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`wallet-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);

  /** Pay an existing order from the wallet. Throws on insufficient balance. */
  const payOrder = useCallback(async (orderId: string) => {
    const { data, error } = await sb.rpc("pay_order_with_wallet", { _order_id: orderId });
    if (error) throw error;
    refresh();
    return data as WalletTx;
  }, [refresh]);

  return {
    userId,
    balance: balanceQuery.data ?? 0,
    isLoading: balanceQuery.isLoading,
    transactions: txQuery.data ?? [],
    refresh,
    payOrder,
  };
}
