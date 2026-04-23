import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Wallet, Plus, ArrowDownLeft, ArrowUpRight, Sparkles, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;
const TOPUP_AMOUNTS = [10, 25, 50, 100, 250, 500];

const sb = supabase as any;

export default function WalletPage() {
  const { balance, transactions, isLoading, userId, refresh } = useWallet();
  const [pending, setPending] = useState<number | null>(null);

  // For now we simulate a deposit by inserting via the secure RPC.
  // Once Stripe is enabled this will trigger a Checkout session instead.
  const topUp = async (amount: number) => {
    if (!userId) { toast.error("Sign in first"); return; }
    setPending(amount);
    try {
      const { error } = await sb.rpc("apply_wallet_transaction", {
        _user_id: userId,
        _kind: "topup",
        _amount: amount,
        _description: `Top up ${fmt(amount)}`,
        _reference: null,
      });
      if (error) throw error;
      toast.success(`Added ${fmt(amount)} to PUBSTORE Pay`);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not top up");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-primary/60" />
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary-foreground/15 blur-3xl" />
        <div className="relative px-4 pt-4 pb-12 text-primary-foreground">
          <div className="flex items-center gap-2 mb-4">
            <Link to="/account" className="w-9 h-9 rounded-full bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-base font-black tracking-tight">PUBSTORE Pay</h1>
          </div>

          <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 p-4 shadow-elevated">
            <div className="flex items-center gap-2 mb-1.5">
              <Wallet className="w-4 h-4" />
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Available balance</p>
            </div>
            <p className="text-4xl font-black tracking-tighter tabular-nums leading-none">{fmt(balance)}</p>
            <p className="text-[11px] opacity-75 mt-2">Use at checkout on any product, any supplier.</p>
          </div>
        </div>
      </div>

      {/* Top-up amounts */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-card rounded-2xl border border-border shadow-elevated p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Plus className="w-4 h-4 text-primary" />
            <p className="text-sm font-black tracking-tight">Add money</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TOPUP_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => topUp(a)}
                disabled={pending !== null}
                className="h-14 rounded-xl border border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition flex items-center justify-center font-black text-base tabular-nums tracking-tight disabled:opacity-50"
              >
                {pending === a ? <Loader2 className="w-4 h-4 animate-spin" /> : fmt(a)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Secure deposits · instant balance update
          </p>
        </div>
      </div>

      {/* Perks */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        <Perk icon={Zap} title="One-tap checkout" desc="Skip cards. Pay with balance." />
        <Perk icon={Sparkles} title="No hidden fees" desc="Every cent goes to your order." />
      </div>

      {/* Transactions */}
      <div className="px-4 mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Activity</p>
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : transactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet. Add money to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((t) => {
                const isCredit = Number(t.amount) > 0;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCredit ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{t.description ?? t.kind}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                    </div>
                    <p className={`text-sm font-black tabular-nums tracking-tight ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {isCredit ? "+" : ""}{fmt(Number(t.amount))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="px-4 mt-4">
        <Button asChild variant="outline" className="w-full h-11">
          <Link to="/cart">Use balance at checkout</Link>
        </Button>
      </div>
    </div>
  );
}

function Perk({ icon: Icon, title, desc }: { icon: typeof Zap; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-1.5">
        <Icon className="w-4 h-4" />
      </span>
      <p className="text-xs font-black tracking-tight">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
    </div>
  );
}
