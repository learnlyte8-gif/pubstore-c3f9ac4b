import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WalletAccount = "personal" | "sales";

export type WalletTx = {
  id: string;
  kind: "topup" | "purchase" | "refund" | "adjustment" | "transfer_in" | "transfer_out" | "withdrawal_hold" | "payout" | "sale" | "sales_to_personal_in" | "sales_to_personal_out";
  amount: number;
  balance_after: number;
  description: string | null;
  reference: string | null;
  account: WalletAccount;
  created_at: string;
};

// The wallet tables were just added; cast through `any` until Supabase types regenerate.
const sb = supabase as any;
let walletChannelNonce = 0;

const makeWalletChannelName = (userId: string) => `wallet-${userId}:${++walletChannelNonce}`;

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
    queryFn: async (): Promise<{ personal: number; sales: number }> => {
      const { data } = await sb
        .from("wallets")
        .select("balance, sales_balance")
        .eq("user_id", userId!)
        .maybeSingle();
      return {
        personal: Number(data?.balance ?? 0),
        sales: Number(data?.sales_balance ?? 0),
      };
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
        .limit(60);
      return (data ?? []) as WalletTx[];
    },
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["wallet", userId] });
    qc.invalidateQueries({ queryKey: ["wallet-tx", userId] });
  }, [qc, userId]);

  /**
   * Immediately reflect a withdrawal hold in the cached balances so the UI
   * updates the instant the request is accepted, before the refetch lands.
   */
  const applyOptimisticHold = useCallback(
    (amount: number, account: WalletAccount = "personal") => {
      const amt = Number(amount) || 0;
      if (amt <= 0) return;
      qc.setQueryData<{ personal: number; sales: number }>(["wallet", userId], (prev) => {
        const base = prev ?? { personal: 0, sales: 0 };
        return account === "sales"
          ? { ...base, sales: Math.max(0, base.sales - amt) }
          : { ...base, personal: Math.max(0, base.personal - amt) };
      });
      refresh();
    },
    [qc, userId, refresh],
  );


  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(makeWalletChannelName(userId))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);

  /** Pay an existing order from the wallet (personal balance). */
  const payOrder = useCallback(async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke("pay-order", {
      body: { orderId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    refresh();
    return data?.transaction as WalletTx;
  }, [refresh]);

  /** Move funds from sales balance to personal balance. */
  const moveSalesToPersonal = useCallback(async (amount: number) => {
    const { error } = await sb.rpc("move_sales_to_personal", { _amount: amount });
    if (error) throw error;
    refresh();
  }, [refresh]);

  const personal = balanceQuery.data?.personal ?? 0;
  const sales = balanceQuery.data?.sales ?? 0;

  return {
    userId,
    /** Personal balance (top-ups, transfers, refunds). Used at checkout & transfers. */
    balance: personal,
    personalBalance: personal,
    salesBalance: sales,
    totalBalance: personal + sales,
    isLoading: balanceQuery.isLoading,
    transactions: txQuery.data ?? [],
    refresh,
    applyOptimisticHold,
    payOrder,
    moveSalesToPersonal,

  };
}
