import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, Plus, ArrowDownLeft, ArrowUpRight, Sparkles, Loader2, ShieldCheck, Zap, Smartphone, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;
const TOPUP_AMOUNTS = [10, 25, 50, 100, 250, 500];
const PENDING_KEY = "pubstore.paypal.pending";
const sb = supabase as any;

type Pending = { orderID: string; amount: number };
type Provider = "paypal" | "paynow" | "ecocash" | "onemoney";

export default function WalletPage() {
  const { balance, transactions, isLoading, userId, refresh } = useWallet();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<number | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const captureRanRef = useRef(false);

  // After PayPal redirects back, capture the order and credit the wallet.
  useEffect(() => {
    if (captureRanRef.current) return;
    const orderID = searchParams.get("orderID") ?? searchParams.get("token");
    const cancelled = searchParams.get("cancelled") === "1";
    if (cancelled) {
      captureRanRef.current = true;
      sessionStorage.removeItem(PENDING_KEY);
      toast.info("PayPal payment cancelled");
      const next = new URLSearchParams(searchParams);
      next.delete("cancelled");
      setSearchParams(next, { replace: true });
      return;
    }
    if (!orderID) return;

    captureRanRef.current = true;
    setCapturing(true);

    let pending: Pending | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) pending = JSON.parse(raw) as Pending;
    } catch { /* ignore */ }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
          body: { orderID },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        const amount = Number((data as any)?.amount ?? pending?.amount ?? 0);
        if ((data as any)?.alreadyCredited) {
          toast.info(`Already credited ${fmt(amount)}`);
        } else {
          toast.success(`Added ${fmt(amount)} to PUBSTORE Pay 🎉`);
        }
        refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Could not complete payment");
      } finally {
        sessionStorage.removeItem(PENDING_KEY);
        setCapturing(false);
        // Clean the URL so a refresh doesn't try to capture again.
        const next = new URLSearchParams(searchParams);
        next.delete("orderID");
        next.delete("token");
        next.delete("PayerID");
        setSearchParams(next, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, refresh]);

  const startCheckout = async (amount: number) => {
    if (!userId) { toast.error("Sign in first"); return; }
    setSelected(amount);
    setRedirecting(true);
    try {
      const origin = window.location.origin;
      const returnUrl = `${origin}/wallet`;
      const cancelUrl = `${origin}/wallet?cancelled=1`;
      const { data, error } = await supabase.functions.invoke("paypal-create-order", {
        body: { amount, returnUrl, cancelUrl },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.approveUrl) throw new Error("PayPal did not return an approval URL");

      // Save pending so we can show the right amount on return.
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ orderID: payload.orderID, amount }),
      );
      // Off to PayPal's hosted checkout.
      window.location.href = payload.approveUrl;
    } catch (e: any) {
      setRedirecting(false);
      setSelected(null);
      toast.error(e?.message ?? "Could not start PayPal checkout");
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

      {/* Capturing banner (returning from PayPal) */}
      {capturing && (
        <div className="px-4 -mt-6 relative z-10">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 shadow-elevated">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-xs font-bold">Confirming your PayPal payment…</p>
          </div>
        </div>
      )}

      {/* Top-up amounts */}
      <div className={`px-4 relative z-10 ${capturing ? "mt-3" : "-mt-6"}`}>
        <div className="bg-card rounded-2xl border border-border shadow-elevated p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Plus className="w-4 h-4 text-primary" />
            <p className="text-sm font-black tracking-tight">Add money</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TOPUP_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => startCheckout(a)}
                disabled={redirecting || capturing}
                className={`h-14 rounded-xl border transition flex items-center justify-center font-black text-base tabular-nums tracking-tight disabled:opacity-50 ${
                  selected === a
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40"
                }`}
              >
                {redirecting && selected === a ? <Loader2 className="w-4 h-4 animate-spin" /> : fmt(a)}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
            Pick an amount — you'll be sent to PayPal's secure checkout to pay, then bounced right back here.
          </p>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Secure payments by PayPal · instant balance update
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
