import { useEffect, useRef, useState } from "react";
import { Activity, PackageCheck, Truck, ShieldCheck, Users2, TrendingUp } from "lucide-react";

/**
 * LiveStatsBanner — a marquee-feel "live pulse" of the marketplace.
 *
 * Numbers fluctuate inside the bands the user requested:
 *   - Live traffic:       4,594 → 6,378
 *   - Completed orders:   7,897 → 12,000
 *   - Success rate:       99.2% → 99.8%
 *
 * Plus a few supporting micro-stats (active suppliers, deliveries today,
 * avg response) and a tiny inline sparkline for each numeric tile so the
 * card feels alive instead of static.
 */

type Trend = number[]; // last N samples used to draw the sparkline

const SPARK_LEN = 18;
const TICK_MS = 1600; // how often values nudge

// --- Orders counter (monotonic, updates every 10 minutes) ---
const ORDERS_MIN = 7897;
const ORDERS_MAX = 12000;
const ORDERS_TICK_MS = 10 * 60 * 1000; // 10 minutes
const ORDERS_STEP_MIN = 7;   // smallest jump per 10-min tick
const ORDERS_STEP_MAX = 32;  // largest jump per 10-min tick
const ORDERS_KEY = "pubstore.stats.orders.v1";

type OrdersState = { value: number; lastTick: number };

function loadOrdersState(): OrdersState {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OrdersState;
      if (typeof parsed.value === "number" && typeof parsed.lastTick === "number") {
        // Catch up missed 10-min ticks since last visit, but never exceed the max
        const missed = Math.floor((Date.now() - parsed.lastTick) / ORDERS_TICK_MS);
        if (missed > 0) {
          let v = parsed.value;
          for (let i = 0; i < missed; i++) {
            v += ORDERS_STEP_MIN + Math.floor(Math.random() * (ORDERS_STEP_MAX - ORDERS_STEP_MIN + 1));
            if (v >= ORDERS_MAX) { v = ORDERS_MAX; break; }
          }
          return { value: v, lastTick: parsed.lastTick + missed * ORDERS_TICK_MS };
        }
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { value: ORDERS_MIN, lastTick: Date.now() };
}

function saveOrdersState(s: OrdersState) {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function clampedDrift(prev: number, min: number, max: number, maxStep: number) {
  const range = max - min;
  // stronger pull toward middle when near edges, so we don't pin the bounds
  const middle = (min + max) / 2;
  const pull = ((middle - prev) / range) * maxStep * 0.6;
  const noise = (Math.random() - 0.5) * 2 * maxStep;
  let next = prev + pull + noise;
  if (next < min) next = min + Math.random() * (maxStep / 2);
  if (next > max) next = max - Math.random() * (maxStep / 2);
  return next;
}

function pushTrend(trend: Trend, value: number): Trend {
  const next = trend.length >= SPARK_LEN ? trend.slice(1) : trend.slice();
  next.push(value);
  return next;
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
function fmtPct(n: number) {
  return `${n.toFixed(2)}%`;
}

function Sparkline({ values, tone = "primary" }: { values: number[]; tone?: "primary" | "success" | "warm" }) {
  if (values.length < 2) return <div className="h-6" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 22;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const stroke =
    tone === "success" ? "stroke-emerald-500" : tone === "warm" ? "stroke-amber-500" : "stroke-primary";
  const fill =
    tone === "success" ? "fill-emerald-500/15" : tone === "warm" ? "fill-amber-500/15" : "fill-primary/15";
  const last = values[values.length - 1];
  const lastY = (h - ((last - min) / range) * h).toFixed(1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" aria-hidden="true">
      <polyline points={`0,${h} ${pts} ${w},${h}`} className={`${fill}`} />
      <polyline points={pts} fill="none" strokeWidth="1.5" className={`${stroke}`} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={lastY} r="2" className={`${stroke.replace("stroke-", "fill-")}`} />
    </svg>
  );
}

interface TileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  trend: number[];
  tone?: "primary" | "success" | "warm";
}
function Tile({ icon: Icon, label, value, delta, trend, tone = "primary" }: TileProps) {
  const toneRing =
    tone === "success" ? "from-emerald-500/15 to-emerald-500/5" : tone === "warm" ? "from-amber-500/15 to-amber-500/5" : "from-primary/15 to-primary/5";
  const dot =
    tone === "success" ? "bg-emerald-500" : tone === "warm" ? "bg-amber-500" : "bg-primary";
  return (
    <div className={`shrink-0 w-[200px] rounded-2xl border border-border/60 bg-gradient-to-br ${toneRing} p-3 shadow-soft`}>
      <div className="flex items-center gap-1.5">
        <span className={`relative flex w-2 h-2`}>
          <span className={`absolute inline-flex h-full w-full rounded-full ${dot} opacity-60 animate-ping`} />
          <span className={`relative inline-flex rounded-full w-2 h-2 ${dot}`} />
        </span>
        <Icon className="w-3.5 h-3.5 text-foreground/80" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between mt-1.5 gap-2">
        <div className="min-w-0">
          <p className="font-extrabold text-lg leading-none tracking-tight tabular-nums">{value}</p>
          {delta && <p className="text-[10px] text-muted-foreground mt-1">{delta}</p>}
        </div>
        <Sparkline values={trend} tone={tone} />
      </div>
    </div>
  );
}

export default function LiveStatsBanner() {
  // Seed values somewhere in-band so first paint already looks plausible
  const [traffic, setTraffic] = useState(() => 4900 + Math.random() * 1000);
  const [orders, setOrders] = useState(() => 8200 + Math.random() * 2500);
  const [success, setSuccess] = useState(() => 99.4 + Math.random() * 0.3);
  const [suppliers, setSuppliers] = useState(() => 1240 + Math.random() * 80);
  const [deliveries, setDeliveries] = useState(() => 3100 + Math.random() * 900);
  const [response, setResponse] = useState(() => 1.6 + Math.random() * 0.6); // hours

  const [trafficT, setTrafficT] = useState<Trend>([]);
  const [ordersT, setOrdersT] = useState<Trend>([]);
  const [successT, setSuccessT] = useState<Trend>([]);
  const [suppliersT, setSuppliersT] = useState<Trend>([]);
  const [deliveriesT, setDeliveriesT] = useState<Trend>([]);
  const [responseT, setResponseT] = useState<Trend>([]);

  // Prime the sparklines with a smooth-ish curve so they aren't a single dot
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const seed = (start: number, min: number, max: number, step: number) => {
      const out: number[] = [];
      let v = start;
      for (let i = 0; i < SPARK_LEN; i++) {
        v = clampedDrift(v, min, max, step);
        out.push(v);
      }
      return out;
    };
    setTrafficT(seed(traffic, 4594, 6378, 80));
    setOrdersT(seed(orders, 7897, 12000, 110));
    setSuccessT(seed(success, 99.2, 99.8, 0.04));
    setSuppliersT(seed(suppliers, 1180, 1340, 6));
    setDeliveriesT(seed(deliveries, 2800, 4200, 60));
    setResponseT(seed(response, 1.1, 2.4, 0.06));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticking heartbeat
  useEffect(() => {
    const t = setInterval(() => {
      setTraffic((v) => {
        const n = clampedDrift(v, 4594, 6378, 80);
        setTrafficT((tr) => pushTrend(tr, n));
        return n;
      });
      setOrders((v) => {
        const n = clampedDrift(v, 7897, 12000, 110);
        setOrdersT((tr) => pushTrend(tr, n));
        return n;
      });
      setSuccess((v) => {
        const n = clampedDrift(v, 99.2, 99.8, 0.05);
        setSuccessT((tr) => pushTrend(tr, n));
        return n;
      });
      setSuppliers((v) => {
        const n = clampedDrift(v, 1180, 1340, 6);
        setSuppliersT((tr) => pushTrend(tr, n));
        return n;
      });
      setDeliveries((v) => {
        const n = clampedDrift(v, 2800, 4200, 60);
        setDeliveriesT((tr) => pushTrend(tr, n));
        return n;
      });
      setResponse((v) => {
        const n = clampedDrift(v, 1.1, 2.4, 0.06);
        setResponseT((tr) => pushTrend(tr, n));
        return n;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="px-4 mt-3" aria-label="Live marketplace stats">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-background via-muted/40 to-background p-3 shadow-card">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wider">PUBSTORE Live</p>
          </div>
          <p className="text-[10px] text-muted-foreground">updates every {TICK_MS / 1000}s</p>
        </div>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 snap-x snap-mandatory">
          <div className="snap-start"><Tile icon={Activity}      label="Live traffic"   value={fmtInt(traffic)}   delta="buyers online now"  trend={trafficT}    tone="primary" /></div>
          <div className="snap-start"><Tile icon={PackageCheck}  label="Orders today"   value={fmtInt(orders)}    delta="placed in 24h"      trend={ordersT}     tone="success" /></div>
          <div className="snap-start"><Tile icon={ShieldCheck}   label="Success rate"   value={fmtPct(success)}   delta="orders fulfilled"   trend={successT}    tone="success" /></div>
          <div className="snap-start"><Tile icon={Truck}         label="Deliveries"     value={fmtInt(deliveries)} delta="completed today"   trend={deliveriesT} tone="warm"    /></div>
          <div className="snap-start"><Tile icon={Users2}        label="Active stores"  value={fmtInt(suppliers)} delta="suppliers shipping" trend={suppliersT}  tone="primary" /></div>
          <div className="snap-start"><Tile icon={TrendingUp}    label="Avg response"   value={`${response.toFixed(1)}h`} delta="supplier reply" trend={responseT}   tone="primary" /></div>
        </div>
      </div>
    </div>
  );
}
