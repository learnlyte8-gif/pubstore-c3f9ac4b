import { Globe2, Store, Package } from "lucide-react";
import { useTradeMode, type TradeMode } from "@/hooks/useTradeMode";

const OPTIONS: { id: TradeMode; label: string; icon: typeof Globe2 }[] = [
  { id: "all", label: "All", icon: Globe2 },
  { id: "retail", label: "Retail", icon: Store },
  { id: "wholesale", label: "Wholesale", icon: Package },
];

export default function TradeModeSwitch({ className = "" }: { className?: string }) {
  const { mode, setMode } = useTradeMode();
  return (
    <div className={`inline-flex items-center bg-muted/70 rounded-full p-1 shadow-card ${className}`}>
      {OPTIONS.map((o) => {
        const active = mode === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            className={`flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-bold transition-all ${
              active
                ? "bg-ig-gradient text-white shadow-pop"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={active}
          >
            <Icon className="w-3 h-3" strokeWidth={active ? 2.6 : 2} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
