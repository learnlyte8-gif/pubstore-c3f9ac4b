import { useEffect, useMemo, useState } from "react";
import {
  DollarSign, Percent, Crown, Sparkles, Megaphone, TrendingUp, PiggyBank, ShoppingBag, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ConsolePage, Card, StatCard, SkeletonList, Empty, fmt } from "@/components/admin/ui";

const sb = supabase as any;

/** Platform economics assumptions (kept in one place so they're easy to tune). */
const AI_MARKUP = 6; // we charge 6x the model cost → cost = revenue / 6
const PSP_RATE = 0.029; // payment processing on collected order value

type RangeId = "30d" | "90d" | "12m" | "all";
const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "12m", label: "12 months", days: 365 },
  { id: "all", label: "All time", days: null },
];

const STREAM_COLORS = ["hsl(var(--primary))", "hsl(285 55% 55%)", "hsl(160 70% 45%)", "hsl(38 92% 55%)"];

function startOf(days: number | null) {
  if (days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function bucketKey(iso: string, monthly: boolean) {
  const s = new Date(iso).toISOString();
  return monthly ? s.slice(0, 7) : s.slice(0, 10);
}

export default function RevenuePanel() {
  const [range, setRange] = useState<RangeId>("30d");
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>(null);
  const days = RANGES.find((r) => r.id === range)!.days;
  const monthly = days == null || days > 120;
  const since = useMemo(() => startOf(days), [days]);

  const load = async () => {
    setLoading(true);
    const gte = (q: any, col = "created_at") => (since ? q.gte(col, since.toISOString()) : q);

    const [commRes, subsRes, plansRes, ledgerRes, aiPlansRes, packsRes, adsRes, ordersRes] = await Promise.all([
      gte(sb.from("supplier_commissions").select("commission,gross,net,rate,plan_code,created_at").order("created_at", { ascending: true }).limit(5000)),
      sb.from("supplier_subscriptions").select("supplier_id,plan_code,started_at,renews_at"),
      sb.from("supplier_plans").select("code,name,price_usd,commission_rate"),
      gte(sb.from("ai_credit_ledger").select("kind,delta,reference,created_at").in("kind", ["plan_start", "pack_buy", "pack_purchase", "topup"]).order("created_at", { ascending: true }).limit(5000)),
      sb.from("ai_plans").select("code,name,price_usd"),
      sb.from("ai_credit_packs").select("code,name,price_usd"),
      sb.from("ad_campaigns").select("id,name,total_spent,status,created_at,updated_at"),
      gte(sb.from("orders").select("total,subtotal,shipping,status,payment_status,created_at").limit(5000)),
    ]);

    const comm = commRes.data ?? [];
    const subs = subsRes.data ?? [];
    const plans = plansRes.data ?? [];
    const ledger = ledgerRes.data ?? [];
    const aiPlans = aiPlansRes.data ?? [];
    const packs = packsRes.data ?? [];
    const ads = adsRes.data ?? [];
    const orders = ordersRes.data ?? [];

    const planPrice = new Map<string, number>(plans.map((p: any) => [p.code, Number(p.price_usd || 0)]));
    const aiPrice = new Map<string, number>([
      ...aiPlans.map((p: any) => [`ai_plan:${p.code}`, Number(p.price_usd || 0)] as [string, number]),
      ...packs.map((p: any) => [`ai_pack:${p.code}`, Number(p.price_usd || 0)] as [string, number]),
    ]);

    // ---- Streams -------------------------------------------------------
    const commissionRevenue = comm.reduce((s: number, r: any) => s + Number(r.commission || 0), 0);
    const gmv = comm.reduce((s: number, r: any) => s + Number(r.gross || 0), 0);
    const paidToSellers = comm.reduce((s: number, r: any) => s + Number(r.net || 0), 0);

    const aiRows = ledger.filter((r: any) => aiPrice.has(String(r.reference ?? "")));
    const aiRevenue = aiRows.reduce((s: number, r: any) => s + (aiPrice.get(String(r.reference)) ?? 0), 0);
    const aiCost = aiRevenue / AI_MARKUP;

    const adRevenue = ads
      .filter((a: any) => !since || new Date(a.updated_at ?? a.created_at) >= since)
      .reduce((s: number, a: any) => s + Number(a.total_spent || 0), 0);

    const activeSubs = subs.filter((s: any) => s.plan_code && s.plan_code !== "free" && (!s.renews_at || new Date(s.renews_at) > new Date()));
    const mrr = activeSubs.reduce((s: number, r: any) => s + (planPrice.get(r.plan_code) ?? 0), 0);
    // subscription revenue booked in range: one charge per 30-day cycle since start
    const subRevenue = subs.reduce((s: number, r: any) => {
      const price = planPrice.get(r.plan_code) ?? 0;
      if (!price) return s;
      const start = new Date(r.started_at ?? r.renews_at ?? Date.now());
      const from = since && since > start ? since : start;
      const cycles = Math.max(1, Math.round((Date.now() - from.getTime()) / (30 * 86400000)));
      return s + price * cycles;
    }, 0);

    const grossRevenue = commissionRevenue + aiRevenue + adRevenue + subRevenue;
    const collected = orders
      .filter((o: any) => o.payment_status === "paid" || o.status !== "awaiting_payment")
      .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const pspCost = collected * PSP_RATE;
    const totalCost = aiCost + pspCost;
    const profit = grossRevenue - totalCost;
    const margin = grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0;
    const takeRate = gmv > 0 ? (commissionRevenue / gmv) * 100 : 0;

    // ---- Trend ---------------------------------------------------------
    const map = new Map<string, any>();
    const touch = (k: string) => {
      if (!map.has(k)) map.set(k, { period: k, commission: 0, ai: 0, ads: 0, subscriptions: 0 });
      return map.get(k);
    };
    if (days != null) {
      for (let i = 0; i < (monthly ? 12 : days); i++) {
        const dt = new Date();
        if (monthly) dt.setMonth(dt.getMonth() - i);
        else dt.setDate(dt.getDate() - i);
        touch(bucketKey(dt.toISOString(), monthly));
      }
    }
    for (const r of comm) touch(bucketKey(r.created_at, monthly)).commission += Number(r.commission || 0);
    for (const r of aiRows) touch(bucketKey(r.created_at, monthly)).ai += aiPrice.get(String(r.reference)) ?? 0;
    for (const a of ads) {
      const spent = Number(a.total_spent || 0);
      if (spent) touch(bucketKey(a.updated_at ?? a.created_at, monthly)).ads += spent;
    }
    for (const s0 of subs) {
      const price = planPrice.get(s0.plan_code) ?? 0;
      if (price && s0.started_at) touch(bucketKey(s0.started_at, monthly)).subscriptions += price;
    }
    const trend = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));

    // ---- Commission by plan tier ---------------------------------------
    const tierMap = new Map<string, { plan: string; commission: number; gross: number; orders: number }>();
    for (const r of comm) {
      const key = r.plan_code || "free";
      const t = tierMap.get(key) ?? { plan: key, commission: 0, gross: 0, orders: 0 };
      t.commission += Number(r.commission || 0);
      t.gross += Number(r.gross || 0);
      t.orders += 1;
      tierMap.set(key, t);
    }
    const byTier = Array.from(tierMap.values()).sort((a, b) => b.commission - a.commission);

    const mix = [
      { name: "Commission", value: commissionRevenue },
      { name: "Subscriptions", value: subRevenue },
      { name: "AI credits", value: aiRevenue },
      { name: "Ads", value: adRevenue },
    ].filter((m) => m.value > 0);

    setD({
      grossRevenue, commissionRevenue, subRevenue, aiRevenue, adRevenue,
      gmv, takeRate, paidToSellers, mrr, activeSubs: activeSubs.length,
      aiCost, pspCost, totalCost, profit, margin, collected,
      trend, mix, byTier, orderCount: comm.length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range]);

  const label = (v: string) => (monthly ? new Date(`${v}-01`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" }));

  return (
    <ConsolePage
      title="Revenue & profit"
      description="Platform earnings across every monetised surface, with cost of revenue and net profit."
      actions={
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 h-7 rounded-full text-[12px] font-medium border whitespace-nowrap ${
                  range === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="text-[12px] font-medium inline-flex items-center gap-1 px-2 h-7 rounded-md hover:bg-muted">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      }
    >
      {loading && !d ? <SkeletonList /> : !d ? <Empty label="No revenue data yet" /> : (
        <>
          {/* Headline */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={DollarSign} label="Platform revenue" value={fmt(d.grossRevenue)} hint="all monetised streams" />
            <StatCard icon={PiggyBank} label="Net profit" value={fmt(d.profit)} hint={`${d.margin.toFixed(1)}% margin`} />
            <StatCard icon={ShoppingBag} label="GMV settled" value={fmt(d.gmv)} hint={`${d.orderCount} settled orders`} />
            <StatCard icon={Percent} label="Take rate" value={`${d.takeRate.toFixed(1)}%`} hint="commission ÷ GMV" />
          </div>

          {/* Breakdown by stream */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue breakdown</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard icon={Percent} label="Order commission" value={fmt(d.commissionRevenue)} hint={`${fmt(d.paidToSellers)} paid to sellers`} />
            <StatCard icon={Crown} label="Store subscriptions" value={fmt(d.subRevenue)} hint={`${d.activeSubs} paid stores · ${fmt(d.mrr)} MRR`} />
            <StatCard icon={Sparkles} label="AI credits" value={fmt(d.aiRevenue)} hint={`${fmt(d.aiCost)} model cost`} />
            <StatCard icon={Megaphone} label="Ad spend earned" value={fmt(d.adRevenue)} hint="campaign spend" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <Card className="lg:col-span-2 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-semibold">Revenue trend</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={label} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={44} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                      formatter={(v: any, n: any) => [fmt(Number(v)), String(n)]}
                      labelFormatter={label}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {["commission", "subscriptions", "ai", "ads"].map((k, i) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={STREAM_COLORS[i]} fill={STREAM_COLORS[i]} fillOpacity={0.25} strokeWidth={2} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[13px] font-semibold mb-3">Revenue mix</p>
              {d.mix.length === 0 ? <Empty label="No revenue in this range" /> : (
                <>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={d.mix} dataKey="value" innerRadius={38} outerRadius={68} paddingAngle={3}>
                          {d.mix.map((_: any, i: number) => <Cell key={i} fill={STREAM_COLORS[i % STREAM_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1.5 mt-2">
                    {d.mix.map((m: any, i: number) => (
                      <li key={m.name} className="flex items-center gap-2 text-[12px]">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STREAM_COLORS[i % STREAM_COLORS.length] }} />
                        <span className="flex-1 font-medium">{m.name}</span>
                        <span className="tabular-nums text-muted-foreground">{((m.value / d.grossRevenue) * 100).toFixed(0)}%</span>
                        <span className="tabular-nums font-semibold">{fmt(m.value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          {/* Profit & cost of revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <Card className="p-4">
              <p className="text-[13px] font-semibold mb-3">Profit &amp; loss</p>
              <ul className="text-[13px] divide-y">
                <PL label="Gross platform revenue" value={d.grossRevenue} />
                <PL label={`AI model cost (1/${AI_MARKUP} of AI revenue)`} value={-d.aiCost} />
                <PL label={`Payment processing (${(PSP_RATE * 100).toFixed(1)}% of ${fmt(d.collected)} collected)`} value={-d.pspCost} />
                <PL label="Total cost of revenue" value={-d.totalCost} />
                <PL label="Net profit" value={d.profit} strong />
              </ul>
              <p className="text-[11px] text-muted-foreground mt-3">
                Seller payouts and courier fees are excluded — they never belong to the platform. Estimated costs use the platform's AI markup and card processing rate.
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-[13px] font-semibold mb-3">Commission by store plan</p>
              {d.byTier.length === 0 ? <Empty label="No settled orders in this range" /> : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.byTier} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="plan" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={44} />
                      <Tooltip formatter={(v: any, n: any) => [fmt(Number(v)), String(n)]} contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="gross" name="GMV" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="commission" name="Commission" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </ConsolePage>
  );
}

function PL({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const neg = value < 0;
  return (
    <li className={`flex items-center gap-3 py-2 ${strong ? "font-semibold" : ""}`}>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${neg ? "text-red-600 dark:text-red-400" : strong ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {neg ? `-${fmt(Math.abs(value))}` : fmt(value)}
      </span>
    </li>
  );
}
