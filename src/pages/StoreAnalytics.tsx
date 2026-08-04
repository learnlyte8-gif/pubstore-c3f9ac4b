import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UpgradeNotice, usePlanFeature } from "@/components/store/PlanGate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMySupplier } from "@/data/products";
import {
  ArrowLeft, TrendingUp, ShoppingBag, DollarSign, Users, Eye, Package,
  Activity, Sparkles, Zap, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import CircleSpinner from "@/components/CircleSpinner";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

const sb = supabase as any;
const fmt$ = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

type Range = "7d" | "30d" | "90d";
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export default function StoreAnalytics() {
  const [range, setRange] = useState<Range>("30d");
  const days = RANGES.find((r) => r.id === range)!.days;
  const since = useMemo(() => daysAgo(days - 1), [days]);
  const prevSince = useMemo(() => daysAgo(days * 2 - 1), [days]);

  const { data: supplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ["my-supplier"],
    queryFn: fetchMySupplier,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["store-analytics", supplier?.id, range],
    enabled: !!supplier,
    queryFn: async () => {
      const sid = supplier!.id;
      const [ordersRes, prevOrdersRes, prodRes, reviewsRes, followersRes] = await Promise.all([
        sb.from("orders")
          .select("id,total,status,created_at,buyer_id")
          .eq("supplier_id", sid)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        sb.from("orders")
          .select("id,total")
          .eq("supplier_id", sid)
          .gte("created_at", prevSince.toISOString())
          .lt("created_at", since.toISOString()),
        sb.from("products")
          .select("id,title,price,sold,rating,review_count,image,active,created_at")
          .eq("supplier_id", sid)
          .order("sold", { ascending: false })
          .limit(50),
        sb.from("reviews")
          .select("id,rating,created_at,product_id,products!inner(supplier_id)")
          .eq("products.supplier_id", sid)
          .gte("created_at", since.toISOString()),
        sb.from("followers").select("id", { count: "exact", head: true }).eq("supplier_id", sid),
      ]);

      const orders = ordersRes.data ?? [];
      const prev = prevOrdersRes.data ?? [];
      const products = prodRes.data ?? [];
      const reviews = reviewsRes.data ?? [];

      // Build daily buckets
      const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
      for (let i = 0; i < days; i++) {
        const d = daysAgo(days - 1 - i);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, { date: key, revenue: 0, orders: 0 });
      }
      for (const o of orders) {
        const key = new Date(o.created_at).toISOString().slice(0, 10);
        const b = buckets.get(key);
        if (b) {
          b.revenue += Number(o.total || 0);
          b.orders += 1;
        }
      }
      const daily = Array.from(buckets.values());

      const revenue = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const prevRevenue = prev.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const orderCount = orders.length;
      const prevOrderCount = prev.length;
      const buyers = new Set(orders.map((o: any) => o.buyer_id)).size;
      const aov = orderCount ? revenue / orderCount : 0;

      // Status breakdown
      const statusMap = new Map<string, number>();
      for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
      const statusData = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));

      // Top products by revenue (price * sold) — using snapshot
      const topProducts = [...products]
        .sort((a, b) => (b.sold || 0) * (b.price || 0) - (a.sold || 0) * (a.price || 0))
        .slice(0, 5);

      const activeProducts = products.filter((p: any) => p.active).length;
      const avgRating = reviews.length
        ? reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / reviews.length
        : products.length
          ? products.reduce((s: number, p: any) => s + Number(p.rating || 0), 0) / products.length
          : 0;

      return {
        daily, statusData, topProducts, products,
        revenue, prevRevenue, orderCount, prevOrderCount,
        buyers, aov, activeProducts, avgRating,
        reviewsCount: reviews.length,
        followersCount: followersRes.count ?? 0,
      };
    },
  });

  if (loadingSupplier) return <div className="p-8 text-center"><CircleSpinner size={28} /></div>;
  if (!supplier) {
    return (
      <div className="pt-12">
        <EmptyState
          title="Create your store first"
          description="Open analytics after you've set up your supplier profile."
          action={<Button asChild><Link to="/become-supplier">Create my store</Link></Button>}
        />
      </div>
    );
  }

  const revDelta = data ? data.revenue - data.prevRevenue : 0;
  const revDeltaPct = data && data.prevRevenue > 0 ? (revDelta / data.prevRevenue) * 100 : data?.revenue ? 100 : 0;
  const ordDelta = data ? data.orderCount - data.prevOrderCount : 0;

  return (
    <div className="pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-[hsl(285_55%_55%)]" />
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-[hsl(285_55%_55%)]/30 blur-3xl" />
        <div className="relative px-4 pt-4 pb-14 text-primary-foreground">
          <div className="flex items-center gap-2 mb-5">
            <Link to="/store" className="w-9 h-9 rounded-full bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-base font-black tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Sales Cockpit
              </h1>
              <p className="text-[11px] opacity-80 font-semibold">{supplier.name}</p>
            </div>
            <div className="flex gap-1 rounded-full bg-primary-foreground/15 backdrop-blur p-1 border border-primary-foreground/20">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => (canFull || r.id === "7d" ? setRange(r.id) : navigate("/store/plans"))}
                  className={`px-2.5 h-7 rounded-full text-[10px] font-black tracking-tight transition ${
                    range === r.id ? "bg-primary-foreground text-primary shadow" : "text-primary-foreground/80"
                  } ${!canFull && r.id !== "7d" ? "opacity-50" : ""}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 p-4 shadow-elevated">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3" /> Revenue
                </p>
                <p className="text-4xl font-black tracking-tighter tabular-nums leading-none mt-1">
                  {isLoading ? "—" : fmt$(data?.revenue ?? 0)}
                </p>
                {data && (
                  <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-black rounded-full px-2 py-0.5 ${revDelta >= 0 ? "bg-emerald-400/20 text-emerald-50" : "bg-rose-400/20 text-rose-50"}`}>
                    {revDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(revDeltaPct).toFixed(0)}% vs prev
                  </div>
                )}
              </div>
              <div className="w-24 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.daily ?? []}>
                    <defs>
                      <linearGradient id="sparkRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary-foreground))" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="hsl(var(--primary-foreground))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary-foreground))" strokeWidth={2} fill="url(#sparkRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="px-4 -mt-7 relative z-10 grid grid-cols-2 gap-2">
        <Kpi icon={ShoppingBag} label="Orders" value={String(data?.orderCount ?? 0)} sub={`${ordDelta >= 0 ? "+" : ""}${ordDelta} vs prev`} tone="primary" />
        <Kpi icon={Users} label="Unique buyers" value={String(data?.buyers ?? 0)} sub={`${data?.followersCount ?? 0} followers`} tone="violet" />
        <Kpi icon={TrendingUp} label="Avg order" value={fmt$(data?.aov ?? 0)} sub="per order" tone="emerald" />
        <Kpi icon={Package} label="Active products" value={String(data?.activeProducts ?? 0)} sub={`${data?.products?.length ?? 0} total`} tone="amber" />
      </div>

      {/* Revenue chart */}
      <div className="px-4 mt-4">
        <ChartCard title="Revenue trend" icon={Activity}>
          {isLoading || !data ? (
            <div className="h-52 flex items-center justify-center"><CircleSpinner size={24} /></div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 11 }}
                    formatter={(v: any) => fmt$(v as number)}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#grad-rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Orders bars */}
      <div className="px-4 mt-3">
        <ChartCard title="Orders per day" icon={Zap}>
          {isLoading || !data ? (
            <div className="h-44 flex items-center justify-center"><CircleSpinner size={24} /></div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={28} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 11 }}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  />
                  <Bar dataKey="orders" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Status + top products (full analytics only) */}
      {!canFull ? (
        <div className="px-4 mt-3"><UpgradeNotice feature="full_analytics" compact /></div>
      ) : (
      <div className="px-4 mt-3 grid grid-cols-1 gap-3">
        <ChartCard title="Order status mix" icon={Eye}>
          {isLoading || !data || data.statusData.length === 0 ? (
            <p className="h-36 flex items-center justify-center text-xs text-muted-foreground">No orders in this range yet</p>
          ) : (
            <div className="h-44 flex items-center">
              <div className="w-32 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.statusData} dataKey="value" innerRadius={28} outerRadius={56} paddingAngle={3}>
                      {data.statusData.map((_, i) => (
                        <Cell key={i} fill={["hsl(var(--primary))", "hsl(285 55% 55%)", "hsl(160 70% 45%)", "hsl(38 92% 55%)", "hsl(340 80% 55%)", "hsl(220 80% 60%)"][i % 6]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-1.5">
                {data.statusData.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ["hsl(var(--primary))","hsl(285 55% 55%)","hsl(160 70% 45%)","hsl(38 92% 55%)","hsl(340 80% 55%)","hsl(220 80% 60%)"][i % 6] }} />
                    <span className="capitalize flex-1 font-bold">{s.name}</span>
                    <span className="tabular-nums font-black">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top products by revenue" icon={TrendingUp}>
          {isLoading || !data || data.topProducts.length === 0 ? (
            <p className="h-24 flex items-center justify-center text-xs text-muted-foreground">No products to rank yet</p>
          ) : (
            <ul className="space-y-2">
              {data.topProducts.map((p: any, i: number) => {
                const rev = Number(p.sold || 0) * Number(p.price || 0);
                const max = Number(data.topProducts[0].sold || 0) * Number(data.topProducts[0].price || 0) || 1;
                const pct = Math.max(6, (rev / max) * 100);
                return (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <span className="w-6 text-center text-[11px] font-black text-muted-foreground tabular-nums">#{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0">
                      {p.image && <img src={p.image} alt={p.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{p.title}</p>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-[hsl(285_55%_55%)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black tabular-nums">{fmt$(rev)}</p>
                      <p className="text-[10px] text-muted-foreground">{p.sold || 0} sold</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>
      )}


      {/* Quality strip */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="Avg rating" value={data ? data.avgRating.toFixed(2) : "—"} sub={`${data?.reviewsCount ?? 0} new reviews`} />
        <MiniStat label="Followers" value={String(data?.followersCount ?? 0)} sub="all-time" />
      </div>

      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-11"><Link to="/store/orders">View orders</Link></Button>
        <Button asChild className="h-11"><Link to="/wallet">Open wallet</Link></Button>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone: "primary" | "violet" | "emerald" | "amber" }) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    violet: "from-[hsl(285_55%_55%)]/15 to-[hsl(285_55%_55%)]/5 text-[hsl(285_55%_55%)]",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-elevated overflow-hidden relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]} opacity-60 pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <span className={`w-7 h-7 rounded-lg bg-background/80 backdrop-blur flex items-center justify-center ${tones[tone].split(" ").pop()}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-black tabular-nums tracking-tight mt-1.5">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground font-bold">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-elevated">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs font-black tracking-tight">{title}</p>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</p>
      <p className="text-xl font-black tabular-nums tracking-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground font-bold">{sub}</p>}
    </div>
  );
}
