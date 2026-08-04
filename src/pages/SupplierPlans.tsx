import { Link } from "react-router-dom";
import { Check, Crown, Percent, Package, Wallet as WalletIcon, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/BackButton";
import EmptyState from "@/components/EmptyState";
import CircleSpinner from "@/components/CircleSpinner";
import { useSupplierPlan } from "@/hooks/useSupplierPlan";
import { useWallet } from "@/hooks/useWallet";

const money = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 1)}%`;

export default function SupplierPlans() {
  const { supplier, plans, plan, planCode, subscription, lapsed, commissions, productCount, loading, subscribe } =
    useSupplierPlan();
  const { personalBalance } = useWallet();

  if (loading) return <div className="p-8 text-center"><CircleSpinner size={28} /></div>;

  if (!supplier) {
    return (
      <div className="pt-12">
        <EmptyState
          icon={<Store className="w-7 h-7 text-muted-foreground" />}
          title="No store yet"
          description="Create your supplier store first to choose a selling plan."
          action={<Button asChild><Link to="/become-supplier">Create my store</Link></Button>}
        />
      </div>
    );
  }

  const totalCommission = commissions.reduce((s, c) => s + c.commission, 0);
  const totalNet = commissions.reduce((s, c) => s + c.net, 0);

  const onSubscribe = async (code: string, price: number) => {
    if (price > 0 && personalBalance < price) {
      toast.error(`Top up your wallet — ${money(price)} needed, you have ${money(personalBalance)}`);
      return;
    }
    try {
      await subscribe.mutateAsync(code);
      toast.success("Plan updated");
    } catch (e: any) {
      toast.error(e.message || "Could not change plan");
    }
  };

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 h-14 flex items-center gap-2">
        <BackButton iconOnly />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Selling plans & commission</p>
          <p className="text-[11px] text-muted-foreground truncate">{supplier.name}</p>
        </div>
        <Link to="/wallet" className="text-xs font-bold text-primary flex items-center gap-1">
          <WalletIcon className="w-3.5 h-3.5" /> {money(personalBalance)}
        </Link>
      </header>

      {/* Current plan */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl border bg-card shadow-card p-4">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Current plan</p>
              <p className="font-bold">{plan?.name ?? "Free"}</p>
            </div>
            {subscription?.renews_at && (
              <p className="text-[11px] text-muted-foreground text-right">
                {lapsed ? "Expired" : "Renews"} {new Date(subscription.renews_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                <Percent className="w-3 h-3" /> Commission
              </p>
              <p className="font-bold mt-0.5">{pct(plan?.commission_rate ?? 0.12)} per sale</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                <Package className="w-3 h-3" /> Listings
              </p>
              <p className="font-bold mt-0.5">
                {productCount}
                {plan?.product_limit ? ` / ${plan.product_limit}` : " · unlimited"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="px-4 mt-5 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Choose a plan</p>
        {plans.map((p) => {
          const current = p.code === planCode && !lapsed;
          return (
            <div
              key={p.code}
              className={`rounded-2xl border p-4 shadow-card ${current ? "border-primary bg-primary/5" : "bg-card"}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold flex items-center gap-2">
                    {p.name}
                    {current && (
                      <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold">
                        Active
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pct(p.commission_rate)} commission ·{" "}
                    {p.product_limit ? `${p.product_limit} products` : "unlimited products"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{p.price_usd > 0 ? money(p.price_usd) : "Free"}</p>
                  {p.price_usd > 0 && <p className="text-[10px] text-muted-foreground">per month</p>}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="text-xs flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> {perk}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full h-11 mt-3"
                variant={current ? "outline" : "default"}
                disabled={current || subscribe.isPending}
                onClick={() => onSubscribe(p.code, p.price_usd)}
              >
                {subscribe.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</>
                ) : current ? (
                  "Your current plan"
                ) : p.price_usd > 0 ? (
                  `Subscribe · ${money(p.price_usd)}/mo from wallet`
                ) : (
                  "Switch to Free"
                )}
              </Button>
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground px-1">
          Plan fees are charged from your wallet balance. Commission is deducted automatically from each sale before it
          lands in your sales balance.
        </p>
      </div>

      {/* Commission history */}
      <div className="px-4 mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
          Commission on sales
        </p>
        {commissions.length === 0 ? (
          <EmptyState title="No commission yet" description="Once you make sales, the platform fee per order shows here." />
        ) : (
          <div className="rounded-2xl border bg-card shadow-card overflow-hidden divide-y">
            <div className="grid grid-cols-3 gap-2 px-4 py-2.5 bg-muted/40 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              <span>Gross</span>
              <span>Fee</span>
              <span className="text-right">Net</span>
            </div>
            {commissions.map((c) => (
              <div key={c.id} className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
                <span className="font-semibold">{money(c.gross)}</span>
                <span className="text-destructive">
                  −{money(c.commission)} <span className="text-[10px] text-muted-foreground">({pct(c.rate)})</span>
                </span>
                <span className="text-right font-bold">{money(c.net)}</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 px-4 py-3 text-sm bg-muted/30 font-bold">
              <span>Total</span>
              <span className="text-destructive">−{money(totalCommission)}</span>
              <span className="text-right">{money(totalNet)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
