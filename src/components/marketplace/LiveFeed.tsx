import { useEffect, useState } from "react";
import { Activity, ShoppingBag, Heart, Star, UserPlus, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tone = "primary" | "destructive" | "amber" | "emerald";
type FeedItem = {
  id: string;
  icon: typeof ShoppingBag;
  text: string;
  ts: number;
  tone: Tone;
};

const toneClass: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const ago = (ts: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

async function loadInitial(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  const [orders, reviews, follows, streams] = await Promise.all([
    supabase
      .from("orders")
      .select("id,created_at,supplier_id,suppliers(name,country)")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("reviews")
      .select("id,rating,created_at,product_id,products(title)")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("followers")
      .select("id,created_at,supplier_id,suppliers(name)")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("live_streams")
      .select("id,title,started_at,supplier_id,suppliers(name)")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(2),
  ]);

  (orders.data ?? []).forEach((o: any) =>
    items.push({
      id: `o-${o.id}`,
      icon: ShoppingBag,
      tone: "primary",
      ts: new Date(o.created_at).getTime(),
      text: `New order placed with ${o.suppliers?.name ?? "a supplier"}${o.suppliers?.country ? ` · ${o.suppliers.country}` : ""}`,
    }),
  );
  (reviews.data ?? []).forEach((r: any) =>
    items.push({
      id: `r-${r.id}`,
      icon: Star,
      tone: "amber",
      ts: new Date(r.created_at).getTime(),
      text: `New ${r.rating}★ review on ${r.products?.title ?? "a product"}`,
    }),
  );
  (follows.data ?? []).forEach((f: any) =>
    items.push({
      id: `f-${f.id}`,
      icon: UserPlus,
      tone: "destructive",
      ts: new Date(f.created_at).getTime(),
      text: `Someone followed ${f.suppliers?.name ?? "a supplier"}`,
    }),
  );
  (streams.data ?? []).forEach((s: any) =>
    items.push({
      id: `s-${s.id}`,
      icon: Radio,
      tone: "emerald",
      ts: new Date(s.started_at).getTime(),
      text: `${s.suppliers?.name ?? "A supplier"} is live: ${s.title}`,
    }),
  );

  return items.sort((a, b) => b.ts - a.ts).slice(0, 6);
}

export default function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    loadInitial().then(setItems);
    // refresh "ago" labels every 30s
    const t = setInterval(() => force((n) => n + 1), 30000);

    const push = (it: FeedItem) =>
      setItems((prev) => [it, ...prev.filter((x) => x.id !== it.id)].slice(0, 6));

    const ch = supabase
      .channel("home-live-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (p) => {
        const row: any = p.new;
        const { data: sup } = await supabase
          .from("suppliers").select("name,country").eq("id", row.supplier_id).maybeSingle();
        push({
          id: `o-${row.id}`,
          icon: ShoppingBag,
          tone: "primary",
          ts: new Date(row.created_at).getTime(),
          text: `New order placed with ${sup?.name ?? "a supplier"}${sup?.country ? ` · ${sup.country}` : ""}`,
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, async (p) => {
        const row: any = p.new;
        const { data: prod } = await supabase
          .from("products").select("title").eq("id", row.product_id).maybeSingle();
        push({
          id: `r-${row.id}`,
          icon: Star,
          tone: "amber",
          ts: new Date(row.created_at).getTime(),
          text: `New ${row.rating}★ review on ${prod?.title ?? "a product"}`,
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "followers" }, async (p) => {
        const row: any = p.new;
        const { data: sup } = await supabase
          .from("suppliers").select("name").eq("id", row.supplier_id).maybeSingle();
        push({
          id: `f-${row.id}`,
          icon: UserPlus,
          tone: "destructive",
          ts: new Date(row.created_at).getTime(),
          text: `Someone followed ${sup?.name ?? "a supplier"}`,
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_streams" }, async (p) => {
        const row: any = p.new;
        const { data: sup } = await supabase
          .from("suppliers").select("name").eq("id", row.supplier_id).maybeSingle();
        push({
          id: `s-${row.id}`,
          icon: Radio,
          tone: "emerald",
          ts: new Date(row.started_at).getTime(),
          text: `${sup?.name ?? "A supplier"} is live: ${row.title}`,
        });
      })
      .subscribe();

    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden mt-3 p-4 text-center">
        <Heart className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">Activity will appear here as buyers shop, review, and follow suppliers.</p>
      </div>
    );
  }

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
            <span className="text-[10px] text-muted-foreground shrink-0">{ago(it.ts)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
