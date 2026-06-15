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
const sb = supabase as any;

type Pending = { orderID: string; amount: number };
type Provider = "paypal" | "pesepay";

export default function WalletPage() {
  const { balance, personalBalance, salesBalance, transactions, isLoading, userId, refresh, moveSalesToPersonal } = useWallet();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<number | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [provider, setProvider] = useState<Provider>("pesepay");
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
    const ref = searchParams.get("pesepay_ref");
    const pref = searchParams.get("pesepay_pref");
    if (!ref || !pref) return;
    pesepayRanRef.current = true;
    setCapturing(true);
    (async () => {
      try {
        const { data, error } = await sb.functions.invoke("pesepay-status", {
          body: { reference: ref, pesepayReference: pref },
        });
        if (error) throw error;
        if (data?.paid) {
          toast.success(`Added ${fmt(Number(data.amount || 0))} to PUBSTORE Pay 🎉`);
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

      if (provider === "pesepay") {
        const { data, error } = await sb.functions.invoke("pesepay-create-payment", {
          body: { purpose: "wallet_topup", amount, returnUrl: `${origin}/wallet?pesepay_ref=PENDING` },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        // Stash the reference + pesepay reference so we can confirm on return.
        const back = new URL(`${origin}/wallet`);
        back.searchParams.set("pesepay_ref", data.reference);
        back.searchParams.set("pesepay_pref", data.pesepayReference || "");
        sessionStorage.setItem("pubstore.pesepay.return", back.toString());
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

          {/* Provider picker */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <ProviderBtn active={provider === "pesepay"} onClick={() => setProvider("pesepay")} icon={Smartphone} label="Pesepay" sub="EcoCash · OneMoney · Visa" />
            <ProviderBtn active={provider === "paypal"} onClick={() => setProvider("paypal")} icon={CreditCard} label="PayPal" sub="Cards & PayPal" />
          </div>


          <div className="grid grid-cols-3 gap-2">
            {TOPUP_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => (provider === "simulate" ? simulateDeposit(a) : startCheckout(a))}
                disabled={redirecting || capturing}
                className={`h-14 rounded-xl border transition flex items-center justify-center font-black text-base tabular-nums tracking-tight disabled:opacity-50 ${
                  selected === a
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40"
                }`}
              >
                {redirecting && selected === a ? <CircleSpinner size={16} /> : fmt(a)}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mt-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Or enter custom amount
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={10}
                  step="0.01"
                  placeholder="Min $10.00"
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
                  if (!Number.isFinite(amt) || amt < 10) {
                    toast.error("Minimum top-up is $10.00");
                    return;
                  }
                  const rounded = Math.round(amt * 100) / 100;
                  if (provider === "simulate") {
                    simulateDeposit(rounded);
                  } else {
                    startCheckout(rounded);
                  }
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
