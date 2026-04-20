import { Link } from "react-router-dom";
import { Flame, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { PRODUCTS, discountPct } from "@/data/products";

export default function DealOfTheDay() {
  const deal = PRODUCTS.find((p) => p.originalPrice && discountPct(p) >= 60) ?? PRODUCTS[0];
  const off = discountPct(deal);
  const [end] = useState(() => Date.now() + 8 * 3600 * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, end - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");

  const sold = 720;
  const total = 1000;
  const pct = (sold / total) * 100;

  return (
    <Link
      to={`/product/${deal.id}`}
      className="block rounded-2xl overflow-hidden bg-card border border-border shadow-elevated hover:shadow-pop transition"
    >
      <div className="grid grid-cols-2">
        <div className="relative bg-muted aspect-square">
          <img src={deal.image} alt={deal.title} className="w-full h-full object-cover" loading="lazy" />
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <Flame className="w-3 h-3" /> -{off}%
          </span>
        </div>
        <div className="p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Deal of the day</p>
            <p className="text-xs font-medium leading-snug line-clamp-2 mt-1">{deal.title}</p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-lg font-bold text-destructive">${deal.price.toFixed(2)}</span>
              {deal.originalPrice && (
                <span className="text-[11px] text-muted-foreground line-through">
                  ${deal.originalPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-destructive to-orange-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{sold} sold · {total - sold} left</p>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-foreground">
              <Clock className="w-3 h-3" />
              <span className="bg-foreground text-background rounded px-1 py-0.5 tabular-nums">{pad(h)}</span>:
              <span className="bg-foreground text-background rounded px-1 py-0.5 tabular-nums">{pad(m)}</span>:
              <span className="bg-foreground text-background rounded px-1 py-0.5 tabular-nums">{pad(s)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
