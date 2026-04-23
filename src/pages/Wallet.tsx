import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Wallet, Plus, ArrowDownLeft, ArrowUpRight, Sparkles, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;
const TOPUP_AMOUNTS = [10, 25, 50, 100, 250, 500];

declare global {
  interface Window {
    paypal?: any;
  }
}

let sdkPromise: Promise<void> | null = null;
const SDK_SCRIPT_ID = "paypal-js-sdk";

function loadPayPalSdk(clientId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    // If a previous attempt left a broken tag behind, remove it so we get a clean retry.
    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) existing.remove();

    const params = new URLSearchParams({
      "client-id": clientId,
      currency: "USD",
      intent: "capture",
      components: "buttons",
      "enable-funding": "venmo,paylater",
    });

    const s = document.createElement("script");
    s.id = SDK_SCRIPT_ID;
    s.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.namespace = "paypal";

    const timeout = window.setTimeout(() => {
      sdkPromise = null;
      reject(new Error("PayPal SDK timed out. Check your connection or ad-blocker."));
    }, 15000);

    s.onload = () => {
      window.clearTimeout(timeout);
      if (window.paypal) {
        resolve();
      } else {
        sdkPromise = null;
        reject(new Error("PayPal SDK loaded but is unavailable."));
      }
    };
    s.onerror = () => {
      window.clearTimeout(timeout);
      sdkPromise = null;
      reject(new Error("Could not reach PayPal. An ad-blocker or network filter may be blocking paypal.com."));
    };

    document.head.appendChild(s);
  });

  return sdkPromise;
}

export default function WalletPage() {
  const { balance, transactions, isLoading, userId, refresh } = useWallet();
  const [selected, setSelected] = useState<number | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [sdkAttempt, setSdkAttempt] = useState(0);
  const [processing, setProcessing] = useState(false);
  const buttonsHostRef = useRef<HTMLDivElement | null>(null);
  const buttonsInstanceRef = useRef<any>(null);

  // Fetch the PayPal client id once
  useEffect(() => {
    supabase.functions.invoke("paypal-public-config").then(({ data, error }) => {
      if (error || !(data as any)?.clientId) {
        toast.error("Payments are temporarily unavailable");
        return;
      }
      setClientId((data as any).clientId);
    });
  }, []);

  // Load the SDK when we have the client id (or when the user retries)
  useEffect(() => {
    if (!clientId) return;
    setSdkError(null);
    loadPayPalSdk(clientId)
      .then(() => { setSdkReady(true); setSdkError(null); })
      .catch((e) => {
        setSdkReady(false);
        setSdkError(e?.message ?? "Could not load PayPal");
      });
  }, [clientId, sdkAttempt]);

  const retrySdk = () => setSdkAttempt((n) => n + 1);

  // Render PayPal buttons whenever an amount is selected
  useEffect(() => {
    if (!sdkReady || !selected || !buttonsHostRef.current || !window.paypal) return;
    const host = buttonsHostRef.current;
    host.innerHTML = "";

    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal", height: 45 },
      createOrder: async () => {
        try {
          const { data, error } = await supabase.functions.invoke("paypal-create-order", {
            body: { amount: selected },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          return (data as any).orderID as string;
        } catch (e: any) {
          toast.error(e.message ?? "Could not start PayPal checkout");
          throw e;
        }
      },
      onApprove: async (data: { orderID: string }) => {
        setProcessing(true);
        try {
          const { data: res, error } = await supabase.functions.invoke("paypal-capture-order", {
            body: { orderID: data.orderID },
          });
          if (error) throw error;
          if ((res as any)?.error) throw new Error((res as any).error);
          const amount = (res as any)?.amount ?? selected;
          if ((res as any)?.alreadyCredited) {
            toast.info(`Already credited ${fmt(Number(amount))}`);
          } else {
            toast.success(`Added ${fmt(Number(amount))} to PUBSTORE Pay 🎉`);
          }
          refresh();
          setSelected(null);
        } catch (e: any) {
          toast.error(e.message ?? "Could not complete payment");
        } finally {
          setProcessing(false);
        }
      },
      onError: (err: any) => {
        console.error("paypal error", err);
        toast.error("PayPal had a problem. Please try again.");
      },
      onCancel: () => {
        toast.info("Payment cancelled");
      },
    });

    buttonsInstanceRef.current = buttons;
    if (buttons.isEligible()) {
      buttons.render(host).catch((err: any) => console.error(err));
    } else {
      host.innerHTML = '<p class="text-xs text-muted-foreground text-center py-3">PayPal is not available for this account.</p>';
    }

    return () => {
      try { buttons.close(); } catch { /* ignore */ }
    };
  }, [sdkReady, selected, refresh]);

  const choose = (a: number) => {
    if (!userId) { toast.error("Sign in first"); return; }
    setSelected(a);
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
                onClick={() => choose(a)}
                disabled={processing}
                className={`h-14 rounded-xl border transition flex items-center justify-center font-black text-base tabular-nums tracking-tight disabled:opacity-50 ${
                  selected === a
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40"
                }`}
              >
                {fmt(a)}
              </button>
            ))}
          </div>

          {/* PayPal buttons appear once an amount is chosen */}
          {selected && (
            <div className="mt-4 rounded-xl bg-muted/30 border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold">
                  Pay <span className="text-primary tabular-nums">{fmt(selected)}</span> with PayPal
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  disabled={processing}
                >
                  Change
                </button>
              </div>
              {!sdkReady ? (
                <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading PayPal…
                </div>
              ) : (
                <div ref={buttonsHostRef} />
              )}
              {processing && (
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Crediting your wallet…
                </p>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
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
