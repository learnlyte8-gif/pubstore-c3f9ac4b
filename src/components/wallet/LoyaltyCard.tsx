import { useState } from "react";
import { Gift, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLoyalty } from "@/hooks/useLoyalty";
import { RewardedAdCTA } from "@/components/ads/RewardedAdSheet";

export default function LoyaltyCard() {
  const { balance, lifetime, transactions, redeem } = useLoyalty();
  const [redeeming, setRedeeming] = useState(false);
  const [code, setCode] = useState<{ code: string; value: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const maxRedeem = Math.floor(balance / 100) * 100;

  const doRedeem = async () => {
    if (maxRedeem < 100) { toast.error("Need at least 100 points"); return; }
    setRedeeming(true);
    try {
      const res = await redeem(maxRedeem);
      setCode(res);
      toast.success(`Got a $${res.value.toFixed(2)} coupon`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not redeem");
    } finally {
      setRedeeming(false);
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-card border rounded-3xl p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center shadow-card">
          <Gift className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loyalty points</p>
          <p className="text-2xl font-extrabold leading-tight">{balance.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground">Lifetime earned · {lifetime.toLocaleString()}</p>
        </div>
        <RewardedAdCTA />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          onClick={doRedeem}
          disabled={redeeming || maxRedeem < 100}
          className="flex-1"
          variant="outline"
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Redeem {maxRedeem || 100} pts for ${(Math.max(maxRedeem, 100) / 100).toFixed(2)}
        </Button>
      </div>

      {code && (
        <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
          <code className="text-sm font-bold flex-1 truncate">{code.code}</code>
          <button onClick={copyCode} className="px-3 h-9 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center gap-1">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent</p>
          <ul className="space-y-1.5 text-xs">
            {transactions.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span className="text-muted-foreground truncate">{t.reason.replace(/_/g, " ")}</span>
                <span className={t.delta > 0 ? "text-emerald-600 font-bold" : "text-foreground font-bold"}>
                  {t.delta > 0 ? "+" : ""}{t.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
