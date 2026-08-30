import { useEffect, useRef, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, Plus, ArrowDownLeft, ArrowUpRight, Sparkles, ShieldCheck, Zap, Smartphone, CreditCard, Send, Wrench, Banknote, Clock, XCircle, Store, ArrowRightLeft } from "lucide-react";
import SendMoneyDialog from "@/components/wallet/SendMoneyDialog";
import WithdrawDialog from "@/components/wallet/WithdrawDialog";
import LoyaltyCard from "@/components/wallet/LoyaltyCard";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;
const TOPUP_AMOUNTS = [10, 25, 50, 100, 250, 500];
const PENDING_KEY = "pubstore.paypal.pending";
const PESEPAY_PENDING_KEY = "pubstore.pesepay.pending.topup";

const sb = supabase as any;

type Pending = { orderID: string; amount: number };
type Provider = "paypal" | "ecocash" | "onemoney" | "visa" | "mastercard";
const PESEPAY_PROVIDERS: Provider[] = ["ecocash", "onemoney", "visa", "mastercard"];

export default function WalletPage() {
  const { balance, personalBalance, salesBalance, transactions, isLoading, userId, refresh, moveSalesToPersonal } = useWallet();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<number | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [provider, setProvider] = useState<Provider>("ecocash");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [sendOpen, setSendOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAccount, setWithdrawAccount] = useState<"personal" | "sales">("personal");
  const [txTab, setTxTab] = useState<"all" | "personal" | "sales">("all");
  const [moveAmount, setMoveAmount] = useState("");
  const [moving, setMoving] = useState(false);


  const { data: withdrawals = [], refetch: refetchWithdrawals } = useQuery({
    queryKey: ["withdrawals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await sb
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const cancelWithdrawal = async (id: string) => {
    try {
      const { error } = await sb.rpc("cancel_withdrawal_request", { _id: id });
      if (error) throw error;
      toast.success("Withdrawal cancelled — funds refunded");
      refresh();
      refetchWithdrawals();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not cancel withdrawal");
    }
  };

  const captureRanRef = useRef(false);
  const pesepayRanRef = useRef(false);

  // After Pesepay redirects back, confirm via pesepay-status.
  useEffect(() => {
    if (pesepayRanRef.current) return;
    // Pesepay's saved returnUrl is created before we know the reference, so it can
    // come back bare (or with the literal "PENDING"). Fall back to the stash we
    // wrote just before redirecting.
    let ref = searchParams.get("pesepay_ref") ?? "";
    let pref = searchParams.get("pesepay_pref") ?? "";
    if (ref === "PENDING") ref = "";
    let stashed: { reference?: string; pesepayReference?: string } | null = null;
    try {
      const raw = sessionStorage.getItem(PESEPAY_PENDING_KEY);
      if (raw) stashed = JSON.parse(raw);
    } catch { /* ignore */ }
    if (!ref) ref = stashed?.reference ?? "";
    if (!pref) pref = stashed?.pesepayReference ?? "";
    if (!pref) return;
    pesepayRanRef.current = true;
    sessionStorage.removeItem(PESEPAY_PENDING_KEY);
    setCapturing(true);

    (async () => {
      try {
        let data: any = null;
        // Pesepay can still be "processing" the instant the user returns —
        // poll check-payment a few times before calling it pending.
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const res = await sb.functions.invoke("pesepay-status", {
            body: { reference: ref, pesepayReference: pref },
          });
          if (res.error) throw res.error;
          data = res.data;
          if (data?.paid || !data?.pending) break;
          await new Promise((r) => setTimeout(r, 2500));
        }
        if (data?.paid) {
          if (data?.credited === false) {
            toast.warning("Payment received — balance is syncing", {
              description: "If it doesn't show in a minute, contact support with your reference.",
            });
          } else {
            toast.success(`Added ${fmt(Number(data.amount || 0))} to PUBSTORE Pay 🎉`);
          }
          refresh();
        } else {
          toast.message("Payment is still pending", { description: "We'll update your balance once it clears." });
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Could not verify Pesepay payment");
      } finally {
        setCapturing(false);
        const next = new URLSearchParams(searchParams);
        next.delete("pesepay_ref");
        next.delete("pesepay_pref");
        setSearchParams(next, { replace: true });
      }
    })();

  }, [searchParams, setSearchParams, refresh]);

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

      if (provider === "paypal") {
        const { data, error } = await sb.functions.invoke("paypal-create-order", {
          body: {
            purpose: "wallet_topup",
            amount,
            returnUrl: `${origin}/wallet`,
            cancelUrl: `${origin}/wallet?cancelled=1`,
          },
        });
        if (error) throw error;
        const payload = data as any;
        if (payload?.error) throw new Error(payload.error);
        if (!payload?.approveUrl) throw new Error("PayPal did not return an approval URL");
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderID: payload.orderID, amount }));
        window.location.href = payload.approveUrl;
        return;
      }

      if (PESEPAY_PROVIDERS.includes(provider)) {
        const { data, error } = await sb.functions.invoke("pesepay-create-payment", {
          body: { purpose: "wallet_topup", amount, returnUrl: `${origin}/wallet` },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        // Stash the reference + pesepay reference so we can confirm on return,
        // even when Pesepay sends us back to the bare returnUrl.
        sessionStorage.setItem(
          PESEPAY_PENDING_KEY,
          JSON.stringify({ reference: data.reference, pesepayReference: data.pesepayReference || "", amount }),
        );
        window.location.href = data.redirectUrl;
        return;

      }
    } catch (e: any) {
      setRedirecting(false);
      setSelected(null);
      toast.error(await getEdgeFunctionErrorMessage(e, "Could not start checkout"));
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
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Personal balance</p>
            </div>
            <p className="text-4xl font-black tracking-tighter tabular-nums leading-none">{fmt(personalBalance)}</p>
            <p className="text-[11px] opacity-75 mt-2">Top-ups & transfers. Use at checkout on any product.</p>
          </div>

          <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 p-4 shadow-elevated mt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Store className="w-4 h-4" />
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Sales balance</p>
            </div>
            <p className="text-3xl font-black tracking-tighter tabular-nums leading-none">{fmt(salesBalance)}</p>
            <p className="text-[11px] opacity-75 mt-2">Earnings from sales. Withdraw or move to personal.</p>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <button
              onClick={() => setSendOpen(true)}
              disabled={!userId || personalBalance <= 0}
              className="h-11 rounded-xl bg-primary-foreground text-primary font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50 shadow-soft"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
            <a
              href="#add-money"
              className="h-11 rounded-xl bg-primary-foreground/15 backdrop-blur border border-primary-foreground/30 text-primary-foreground font-black text-[11px] flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </a>
            <button
              onClick={() => { setWithdrawAccount(salesBalance >= 5 ? "sales" : "personal"); setWithdrawOpen(true); }}
              disabled={!userId || (personalBalance < 5 && salesBalance < 5)}
              className="h-11 rounded-xl bg-primary-foreground/15 backdrop-blur border border-primary-foreground/30 text-primary-foreground font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-40"
            >
              <Banknote className="w-3.5 h-3.5" /> Withdraw
            </button>
            <a
              href="#move-funds"
              className="h-11 rounded-xl bg-primary-foreground/15 backdrop-blur border border-primary-foreground/30 text-primary-foreground font-black text-[11px] flex items-center justify-center gap-1"
              aria-disabled={salesBalance <= 0}
              style={salesBalance <= 0 ? { opacity: 0.4, pointerEvents: "none" } : undefined}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Move
            </a>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        <LoyaltyCard />
      </div>



      <SendMoneyDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        balance={balance}
        currentUserId={userId}
        onSent={refresh}
      />

      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        personalBalance={personalBalance}
        salesBalance={salesBalance}
        defaultAccount={withdrawAccount}
        onSubmitted={() => { refresh(); refetchWithdrawals(); }}
      />

      {/* Pending withdrawals */}
      {withdrawals.length > 0 && (
        <div className="px-4 mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Withdrawals</p>
          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden divide-y divide-border">
            {withdrawals.map((w: any) => {
              const pending = w.status === "pending";
              return (
                <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${pending ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : w.status === "paid" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {pending ? <Clock className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate capitalize">{w.method} · {w.destination}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      <span className={`inline-block px-1.5 py-0.5 rounded mr-1 text-[9px] font-black ${w.account === "sales" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-primary/15 text-primary"}`}>
                        {w.account ?? "personal"}
                      </span>
                      {w.status} · {new Date(w.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm font-black tabular-nums">${Number(w.amount).toFixed(2)}</p>
                  {pending && (
                    <button onClick={() => cancelWithdrawal(w.id)} className="ml-2 w-8 h-8 rounded-full bg-muted hover:bg-destructive/15 hover:text-destructive flex items-center justify-center" aria-label="Cancel">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Capturing banner (returning from PayPal) */}
      {capturing && (
        <div className="px-4 -mt-6 relative z-10">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 shadow-elevated">
            <CircleSpinner size={16} className="text-primary" />
            <p className="text-xs font-bold">Confirming your PayPal payment…</p>
          </div>
        </div>
      )}

      {/* Top-up amounts */}
      <div id="add-money" className={`px-4 relative z-10 ${capturing ? "mt-3" : "-mt-6"}`}>
        <div className="bg-card rounded-2xl border border-border shadow-elevated p-4 scroll-mt-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Plus className="w-4 h-4 text-primary" />
            <p className="text-sm font-black tracking-tight">Add money</p>
          </div>

          {/* Provider picker — Pesepay rails + PayPal */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            <BrandTile active={provider === "ecocash"} onClick={() => setProvider("ecocash")} label="EcoCash" brand="ecocash" />
            <BrandTile active={provider === "onemoney"} onClick={() => setProvider("onemoney")} label="OneMoney" brand="onemoney" />
            <BrandTile active={provider === "visa"} onClick={() => setProvider("visa")} label="Visa" brand="visa" />
            <BrandTile active={provider === "mastercard"} onClick={() => setProvider("mastercard")} label="Mastercard" brand="mastercard" />
            <BrandTile active={provider === "paypal"} onClick={() => setProvider("paypal")} label="PayPal" brand="paypal" />
          </div>


          {/* Custom amount */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Enter amount
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  placeholder="Min $1.00"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  disabled={redirecting || capturing}
                  className="h-11 w-full rounded-xl border border-border bg-muted/40 pl-7 pr-3 text-sm font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                />
              </div>
              <Button
                className="h-11 px-4"
                disabled={redirecting || capturing}
                onClick={() => {
                  const amt = Number(customAmount);
                  if (!Number.isFinite(amt) || amt < 1) {
                    toast.error("Minimum top-up is $1.00");
                    return;
                  }
                  const rounded = Math.round(amt * 100) / 100;
                  startCheckout(rounded);
                }}
              >
                {redirecting && selected !== null && !TOPUP_AMOUNTS.includes(selected) ? <CircleSpinner size={16} /> : "Add"}
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Secure payments · instant balance update once cleared
          </p>
        </div>
      </div>

      <ManualTopupCard userId={userId} />


      {/* Perks */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        <Perk icon={Zap} title="One-tap checkout" desc="Skip cards. Pay with balance." />
        <Perk icon={Sparkles} title="No hidden fees" desc="Every cent goes to your order." />
      </div>

      {/* Move sales → personal */}
      <div id="move-funds" className="px-4 mt-4 scroll-mt-4">
        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <p className="text-sm font-black tracking-tight">Move sales → personal</p>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Sales balance: <span className="font-black tabular-nums text-foreground">{fmt(salesBalance)}</span>. Move earnings to your personal balance to spend at checkout or withdraw flexibly.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0.01}
                step="0.01"
                placeholder="0.00"
                value={moveAmount}
                onChange={(e) => setMoveAmount(e.target.value)}
                disabled={moving || salesBalance <= 0}
                className="h-11 w-full rounded-xl border border-border bg-muted/40 pl-7 pr-3 text-sm font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
              />
            </div>
            <Button
              variant="outline"
              className="h-11 px-3"
              disabled={moving || salesBalance <= 0}
              onClick={() => setMoveAmount(salesBalance.toFixed(2))}
            >
              All
            </Button>
            <Button
              className="h-11 px-4"
              disabled={moving || salesBalance <= 0}
              onClick={async () => {
                const amt = Math.round(Number(moveAmount) * 100) / 100;
                if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter an amount"); return; }
                if (amt > salesBalance) { toast.error("Exceeds sales balance"); return; }
                setMoving(true);
                try {
                  await moveSalesToPersonal(amt);
                  toast.success(`Moved ${fmt(amt)} to personal balance`);
                  setMoveAmount("");
                } catch (e: any) {
                  toast.error(e?.message ?? "Could not move funds");
                } finally { setMoving(false); }
              }}
            >
              {moving ? <CircleSpinner size={16} /> : "Move"}
            </Button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Activity</p>
          <div className="flex gap-1 bg-muted rounded-full p-0.5">
            {(["all", "personal", "sales"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTxTab(tab)}
                className={`px-2.5 h-6 rounded-full text-[10px] font-black capitalize transition ${txTab === tab ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>
          ) : (() => {
            const filtered = transactions.filter((t) => txTab === "all" ? true : (t.account ?? "personal") === txTab);
            if (filtered.length === 0) {
              return <p className="p-6 text-center text-sm text-muted-foreground">No {txTab === "all" ? "" : txTab + " "}transactions yet.</p>;
            }
            return (
              <ul className="divide-y divide-border">
                {filtered.map((t) => {
                  const isCredit = Number(t.amount) > 0;
                  const acct = t.account ?? "personal";
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCredit ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                        {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{t.description ?? t.kind}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${acct === "sales" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-primary/15 text-primary"}`}>
                            {acct}
                          </span>
                          {new Date(t.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p className={`text-sm font-black tabular-nums tracking-tight ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {isCredit ? "+" : ""}{fmt(Number(t.amount))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
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

function ProviderBtn({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CreditCard;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-14 rounded-xl border px-3 flex items-center gap-2 text-left transition ${
        active
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border bg-muted/40 hover:bg-primary/5 hover:border-primary/40"
      }`}
    >
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          active ? "bg-primary/20 text-primary" : "bg-background text-foreground"
        }`}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black tracking-tight truncate">{label}</span>
        <span className="block text-[10px] text-muted-foreground truncate">{sub}</span>
      </span>
    </button>
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

type Brand = "ecocash" | "onemoney" | "visa" | "mastercard" | "paypal";

function BrandMark({ brand }: { brand: Brand }) {
  switch (brand) {
    case "ecocash":
      // EcoCash — red roundel with white "E"
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#E30613" />
          <path d="M11 9h10v3.6h-6.4v2.6H20v3.4h-5.4v2.8H21V25H11z" fill="#fff" />
        </svg>
      );
    case "onemoney":
      // OneMoney — yellow tile with red "1" (NetOne palette)
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
          <rect width="32" height="32" rx="6" fill="#FFCB05" />
          <path d="M14.5 8h3.6v16h-3.8V12.2l-2.6.9V9.8z" fill="#D7282F" />
        </svg>
      );
    case "visa":
      return (
        <svg viewBox="0 0 48 32" className="w-9 h-7" aria-hidden>
          <rect width="48" height="32" rx="5" fill="#1A1F71" />
          <path fill="#fff" d="M18.6 21.4l2.1-10.8h3.3l-2.1 10.8zM33 10.8c-.7-.3-1.8-.6-3.2-.6-3.5 0-6 1.8-6 4.5 0 2 1.8 3 3.2 3.7 1.4.7 1.9 1.1 1.9 1.7 0 .9-1.1 1.4-2.2 1.4-1.5 0-2.3-.2-3.5-.7l-.5-.2-.5 3c.9.4 2.5.7 4.2.7 3.7 0 6.1-1.8 6.2-4.6 0-1.5-1-2.7-3.1-3.7-1.3-.6-2-1-2-1.7 0-.6.7-1.2 2.1-1.2 1.2 0 2.1.2 2.8.5l.3.2zm8.5-.2h-2.6c-.8 0-1.4.2-1.8 1.1l-5 9.7h3.6s.6-1.5.7-1.9h4.4c.1.4.4 1.9.4 1.9h3.2zm-4.1 6.6c.3-.7 1.3-3.4 1.3-3.4 0 .1.3-.7.5-1.2l.2 1.1.8 3.5zM15.8 10.6L12.4 18l-.4-1.7c-.6-1.9-2.5-4-4.6-5l3.2 10.1h3.6l5.4-10.8z"/>
          <path fill="#F7B600" d="M9.4 10.6H4l-.1.3c4.2 1 7 3.4 8.1 6.4l-1.2-5.6c-.2-.9-.7-1.1-1.4-1.1z"/>
        </svg>
      );
    case "mastercard":
      return (
        <svg viewBox="0 0 48 32" className="w-9 h-7" aria-hidden>
          <rect width="48" height="32" rx="5" fill="#0A0A0A" />
          <circle cx="20" cy="16" r="7" fill="#EB001B" />
          <circle cx="28" cy="16" r="7" fill="#F79E1B" />
          <path d="M24 10.8a7 7 0 0 0 0 10.4 7 7 0 0 0 0-10.4z" fill="#FF5F00" />
        </svg>
      );
    case "paypal":
      return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
          <rect width="32" height="32" rx="6" fill="#fff" stroke="#E5E7EB" />
          <path fill="#003087" d="M11.4 24.5l.5-3.1H8.3l2.1-13h6c2.7 0 4.5 1.3 4.2 3.8-.4 3.5-2.6 5.2-5.9 5.2h-1.9l-.6 3.7-.4 3.4z"/>
          <path fill="#0070E0" d="M22.6 13.4c-.3 3.5-2.6 5.2-5.9 5.2h-1.9l-1 6h-2.4l-.4 3.4h3.8l.5-3.1h2.1c3.5 0 6.2-1.7 6.7-5.6.3-2.3-.6-4.1-1.5-5.9z"/>
        </svg>
      );
  }
}

function BrandTile({
  active, onClick, label, brand,
}: { active: boolean; onClick: () => void; label: string; brand: Brand }) {
  return (
    <button
      onClick={onClick}
      className={`h-[68px] rounded-xl border px-1.5 py-2 flex flex-col items-center justify-center gap-1 transition ${
        active
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border bg-card hover:bg-primary/5 hover:border-primary/40"
      }`}
    >
      <BrandMark brand={brand} />
      <span className="block text-[9px] font-black tracking-tight truncate w-full text-center">{label}</span>
    </button>
  );
}

function ManualTopupCard({ userId }: { userId: string | null }) {
  const [cfg, setCfg] = useState<{ enabled: boolean; number: string; name: string; instructions: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myTopups, setMyTopups] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("platform_settings").select("value").eq("key", "manual_topup").maybeSingle();
      const v = (data?.value ?? {}) as any;
      setCfg({
        enabled: v.enabled !== false,
        number: v.number ?? "",
        name: v.name ?? "PUBSTORE",
        instructions: v.instructions ?? "",
      });
    })();
  }, []);

  const loadMine = async () => {
    if (!userId) return;
    const { data } = await sb.from("manual_topups").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    setMyTopups(data ?? []);
  };
  useEffect(() => { loadMine(); }, [userId]);

  const submit = async () => {
    if (!userId) { toast.error("Sign in first"); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 1) { toast.error("Enter the amount you sent"); return; }
    if (!reference.trim()) { toast.error("Enter the EcoCash confirmation reference"); return; }
    setSubmitting(true);
    const { error } = await sb.from("manual_topups").insert({
      user_id: userId,
      amount: Math.round(amt * 100) / 100,
      reference: reference.trim(),
      note: note.trim() || null,
      platform_number: cfg?.number ?? null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted — we'll credit your balance once verified");
    setAmount(""); setReference(""); setNote("");
    loadMine();
  };

  if (!cfg || !cfg.enabled) return null;

  return (
    <div className="px-4 mt-4">
      <div className="bg-card rounded-2xl border border-border shadow-card p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <Smartphone className="w-4 h-4 text-primary" />
          <p className="text-sm font-black tracking-tight">Manual EcoCash top-up</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Send EcoCash to the platform number, then paste the confirmation reference here. Your PUBSTORE Pay balance will be credited once the platform team verifies it.
        </p>

        {cfg.number ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Send to {cfg.name || "PUBSTORE"}</p>
              <p className="text-base font-extrabold tabular-nums">{cfg.number}</p>
              {cfg.instructions && <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-line">{cfg.instructions}</p>}
            </div>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(cfg.number); toast.success("Number copied"); }}
              className="text-[11px] font-bold text-primary px-2 py-1 rounded-md bg-background border"
            >Copy</button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-3 text-[11px]">
            Manual top-up isn't fully configured yet. Please try again later.
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Amount sent (USD)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" step="0.01" className="w-full h-10 rounded-xl border bg-background px-3 text-sm" placeholder="10.00" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">EcoCash reference *</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full h-10 rounded-xl border bg-background px-3 text-sm" placeholder="EC123ABCD45" />
            </div>
          </div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-xl border bg-background p-3 text-sm" placeholder="Sent at 14:32 from 077…" />
          <Button onClick={submit} disabled={submitting || !cfg.number} className="h-10 w-full">
            {submitting ? "Submitting…" : "Submit for verification"}
          </Button>
        </div>

        {myTopups.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Recent submissions</p>
            <div className="space-y-1.5">
              {myTopups.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-[11px] border rounded-lg px-2.5 py-1.5">
                  <span className="font-bold tabular-nums">${Number(t.amount).toFixed(2)}</span>
                  <span className="text-muted-foreground truncate flex-1">Ref {t.reference}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                    t.status === "approved" ? "bg-emerald-500/15 text-emerald-700" :
                    t.status === "declined" ? "bg-red-500/15 text-red-700" :
                    "bg-amber-500/15 text-amber-700"
                  }`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

