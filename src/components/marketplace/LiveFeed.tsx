import { useEffect, useState } from "react";
import { Activity, ShoppingBag, Heart, Star, Zap } from "lucide-react";

type FeedItem = {
  id: number;
  icon: typeof ShoppingBag;
  text: string;
  meta: string;
  tone: "primary" | "destructive" | "amber" | "emerald";
};

const POOL: Omit<FeedItem, "id">[] = [
  { icon: ShoppingBag, text: "Sara from Berlin just bought Smart Watch Series 9", meta: "2m ago", tone: "primary" },
  { icon: Heart, text: "1.2k people added Air Fryer 5L to their wishlist today", meta: "live", tone: "destructive" },
  { icon: Star, text: "New 5-star review on Wireless Earbuds Pro", meta: "5m ago", tone: "amber" },
  { icon: Zap, text: "Flash deal restocked: LED Strip Lights 10m", meta: "just now", tone: "emerald" },
  { icon: ShoppingBag, text: "Carlos in Mexico ordered 200 units of Linen Shirts", meta: "8m ago", tone: "primary" },
  { icon: Heart, text: "Mumbai Wellness reached 50k followers", meta: "1h ago", tone: "destructive" },
  { icon: Star, text: "Aurora Electronics rated 4.9 by buyers this week", meta: "today", tone: "amber" },
  { icon: Zap, text: "Yoga Mat Eco TPE just dropped to $14.90", meta: "live", tone: "emerald" },
];

const toneClass: Record<FeedItem["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export default function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>(
    POOL.slice(0, 4).map((p, i) => ({ ...p, id: i })),
  );

  useEffect(() => {
    let counter = items.length;
    const t = setInterval(() => {
      const next = POOL[Math.floor(Math.random() * POOL.length)];
      counter += 1;
      setItems((prev) => [{ ...next, id: counter }, ...prev].slice(0, 5));
    }, 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden mt-3">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-muted/40">
        <div className="flex items-center gap-1.5">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <span className="relative rounded-full w-2 h-2 bg-emerald-500" />
          </span>
          <p className="text-xs font-bold uppercase tracking-wider">Live activity</p>
        </div>
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="px-3 py-2 flex items-center gap-2.5 animate-fade-up">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${toneClass[it.tone]}`}>
              <it.icon className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs leading-snug flex-1 line-clamp-2">{it.text}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">{it.meta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
