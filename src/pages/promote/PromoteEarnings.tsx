import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PromoteTabs from "./PromoteTabs";
import { usePromoterEarnings, usePromoterProfile } from "@/hooks/usePromote";
import { money } from "@/lib/promote";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending — waiting for delivery",
  confirmed: "Confirmed — in the return window",
  available: "Available",
  paid: "Paid to wallet",
  cancelled: "Cancelled",
  reversed: "Reversed after refund",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  available: "bg-primary text-primary-foreground",
  paid: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  reversed: "bg-destructive/10 text-destructive",
};

export default function PromoteEarnings() {
  const { profile } = usePromoterProfile();
  const { summary, commissions, payouts, isLoading, withdraw } = usePromoterEarnings();
  const [amount, setAmount] = useState("");

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 10) return toast.error("Minimum withdrawal is $10.");
    if (value > summary.available_amount) return toast.error(`You have ${money(summary.available_amount)} available.`);
    try {
      await withdraw.mutateAsync(Math.round(value * 100) / 100);
      setAmount("");
      toast.success("Moved to your PUBSTORE wallet");
    } catch (e: any) {
      toast.error(e?.message ?? "Withdrawal failed");
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      <header className="px-4 pt-4 pb-3 space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Sales &amp; earnings</h1>
        <PromoteTabs />
      </header>

      <div className="px-4 space-y-4">
        <div className="rounded-3xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Available to withdraw</p>
          <p className="text-4xl font-extrabold tracking-tight">{money(summary.available_amount)}</p>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="rounded-2xl bg-muted/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Pending</p>
              <p className="text-sm font-bold">{money(summary.pending_amount + summary.confirming_amount)}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Paid out</p>
              <p className="text-sm font-bold">{money(summary.paid_amount)}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-2.5">
              <p className="text-[11px] text-muted-foreground">Sales</p>
              <p className="text-sm font-bold">{summary.sales_count}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Withdraw to wallet</p>
          {profile && profile.level < 2 ? (
            <p className="text-sm text-muted-foreground">
              <Link to="/verification" className="font-bold text-primary">Verify your identity</Link> to withdraw your earnings.
            </p>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                min={10}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (min $10)"
                className="h-12 rounded-2xl"
              />
              <Button onClick={submit} disabled={withdraw.isPending} className="h-12 rounded-2xl font-bold px-5">
                {withdraw.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
                Withdraw
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Earnings land in your PUBSTORE wallet, where you can spend them or cash out.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">Commission history</p>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)
          ) : !commissions.length ? (
            <p className="text-sm text-muted-foreground px-1 py-6 text-center">No commissions yet.</p>
          ) : (
            commissions.map((c: any) => (
              <div key={c.id} className="rounded-2xl border bg-card p-3 flex items-center gap-3">
                <img
                  src={c.product?.image ?? "/placeholder.svg"}
                  alt={c.product?.title ?? "Product"}
                  className="w-11 h-11 rounded-xl object-cover bg-muted"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold line-clamp-1">{c.product?.title ?? "Order item"}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[c.status] ?? "bg-muted"}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-extrabold ${c.status === "cancelled" || c.status === "reversed" ? "line-through text-muted-foreground" : ""}`}>
                    {money(Number(c.commission_amount))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {payouts.length ? (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">Withdrawals</p>
            {payouts.map((p: any) => (
              <div key={p.id} className="rounded-2xl border bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">To PUBSTORE wallet</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-extrabold">{money(Number(p.amount))}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
