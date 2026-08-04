import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Check, Zap, Wallet as WalletIcon, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAiCredits, AI_TRIAL_ACTIONS } from "@/hooks/useAiCredits";
import { useWallet } from "@/hooks/useWallet";

const fmtUsd = (n: number) => `$${Number(n).toFixed(2)}`;

export default function AiCreditsPage() {
  const {
    balance, planCode, account, trialRemaining, plans, packs, costs, ledger,
    userId, buyPack, subscribe,
  } = useAiCredits();
  const { personalBalance } = useWallet();

  const handleBuy = async (code: string, price: number, name: string) => {
    if (!userId) return toast.error("Sign in to buy AI credits");
    if ((personalBalance ?? 0) < price) {
      return toast.error("Not enough wallet balance — top up your wallet first");
    }
    try {
      await buyPack.mutateAsync(code);
      toast.success(`${name} pack added to your AI credits`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSubscribe = async (code: string, price: number, name: string) => {
    if (!userId) return toast.error("Sign in to choose an AI plan");
    if (price > 0 && (personalBalance ?? 0) < price) {
      return toast.error("Not enough wallet balance — top up your wallet first");
    }
    try {
      await subscribe.mutateAsync(code);
      toast.success(`${name} plan active`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/account" aria-label="Back" className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">AI credits &amp; plans</h1>
      </header>

      {/* Balance */}
      <section className="mx-4 mt-4 rounded-2xl bg-muted/60 p-6 text-center">
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" /> AI credit balance
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{balance.toLocaleString()}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className="capitalize">{planCode} plan</Badge>
          {trialRemaining > 0 && (
            <Badge variant="outline">{trialRemaining} of {AI_TRIAL_ACTIONS} free actions left</Badge>
          )}
          {account?.plan_renews_at && (
            <Badge variant="outline">
              Renews {new Date(account.plan_renews_at).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <WalletIcon className="h-3.5 w-3.5" />
          Wallet: {fmtUsd(personalBalance ?? 0)} — plans and packs are charged to your wallet
        </p>
      </section>

      {/* Plans */}
      <section className="mt-8 px-4">
        <h2 className="text-base font-semibold">Monthly plans</h2>
        <p className="text-sm text-muted-foreground">Credits refill every month. Cancel by switching to Starter.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const active = planCode === p.code;
            return (
              <div
                key={p.code}
                className={`flex flex-col rounded-2xl border p-4 ${active ? "border-primary ring-1 ring-primary" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-2xl font-extrabold">
                  {p.price_usd > 0 ? fmtUsd(p.price_usd) : "Free"}
                  {p.price_usd > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {p.monthly_credits > 0
                    ? `${p.monthly_credits.toLocaleString()} credits / month`
                    : `${AI_TRIAL_ACTIONS} free AI actions`}
                </p>
                {p.blurb && <p className="mt-2 flex-1 text-xs text-muted-foreground">{p.blurb}</p>}
                <Button
                  className="mt-4"
                  variant={active ? "secondary" : "default"}
                  disabled={active || subscribe.isPending}
                  onClick={() => handleSubscribe(p.code, Number(p.price_usd), p.name)}
                >
                  {active ? "Current plan" : p.price_usd > 0 ? "Choose plan" : "Switch to free"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top-up packs */}
      <section className="mt-8 px-4">
        <h2 className="text-base font-semibold">Top up credits</h2>
        <p className="text-sm text-muted-foreground">One-off packs that never expire. Great when you run out mid-month.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pk) => (
            <div key={pk.code} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{pk.name}</h3>
                {pk.bonus_label && <Badge variant="secondary">{pk.bonus_label}</Badge>}
              </div>
              <p className="mt-1 text-2xl font-extrabold">{pk.credits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">credits for {fmtUsd(pk.price_usd)}</p>
              <Button
                className="mt-4 w-full"
                variant="outline"
                disabled={buyPack.isPending}
                onClick={() => handleBuy(pk.code, Number(pk.price_usd), pk.name)}
              >
                <Zap className="mr-1 h-4 w-4" /> Buy
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Feature pricing */}
      <section className="mt-8 px-4">
        <h2 className="text-base font-semibold">What each AI feature costs</h2>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
          {costs.map((c) => (
            <li key={c.feature} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
              </div>
              <span className="text-sm font-semibold">{c.credits} cr</span>
            </li>
          ))}
        </ul>
      </section>

      {/* History */}
      {ledger.length > 0 && (
        <section className="mt-8 px-4">
          <h2 className="text-base font-semibold">AI credit history</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.description ?? l.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${l.delta > 0 ? "text-emerald-600" : l.delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {l.delta > 0 ? "+" : ""}{l.delta === 0 ? "free" : l.delta}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.balance_after} cr</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
