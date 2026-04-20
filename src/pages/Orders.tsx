import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  RotateCcw,
  MessageCircle,
  ChevronRight,
  XCircle,
  FileText,
  MapPin,
} from "lucide-react";
import { PRODUCTS, SUPPLIERS } from "@/data/products";

type OrderStatus = "placed" | "processing" | "shipped" | "delivered" | "cancelled";

type OrderItem = {
  productId: string;
  qty: number;
  unitPrice: number;
};

type Order = {
  id: string;
  date: string;
  supplierId: string;
  status: OrderStatus;
  items: OrderItem[];
  shipTo: string;
  tracking?: string;
  eta?: string;
};

const ORDERS: Order[] = [
  {
    id: "PUB-2026-04781",
    date: "2026-04-12",
    supplierId: "s1",
    status: "shipped",
    items: [
      { productId: "p1", qty: 50, unitPrice: 21.5 },
      { productId: "p9", qty: 5, unitPrice: 59.0 },
    ],
    shipTo: "Nairobi, Kenya",
    tracking: "DHL 9821 4471 220",
    eta: "Apr 24",
  },
  {
    id: "PUB-2026-04612",
    date: "2026-04-08",
    supplierId: "s4",
    status: "delivered",
    items: [{ productId: "p5", qty: 200, unitPrice: 9.9 }],
    shipTo: "Lagos, Nigeria",
    tracking: "FedEx 7712 0934 11",
  },
  {
    id: "PUB-2026-04501",
    date: "2026-04-04",
    supplierId: "s2",
    status: "processing",
    items: [
      { productId: "p2", qty: 100, unitPrice: 32.0 },
      { productId: "p10", qty: 50, unitPrice: 28.5 },
    ],
    shipTo: "Berlin, Germany",
    eta: "Apr 28",
  },
  {
    id: "PUB-2026-04388",
    date: "2026-04-01",
    supplierId: "s3",
    status: "placed",
    items: [{ productId: "p12", qty: 10, unitPrice: 79.0 }],
    shipTo: "Dubai, UAE",
    eta: "May 02",
  },
  {
    id: "PUB-2026-04201",
    date: "2026-03-26",
    supplierId: "s5",
    status: "cancelled",
    items: [{ productId: "p13", qty: 30, unitPrice: 21.0 }],
    shipTo: "Istanbul, Türkiye",
  },
];

const FILTERS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "placed", label: "Placed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_META: Record<
  OrderStatus,
  { icon: typeof Package; label: string; tone: string }
> = {
  placed: { icon: Clock, label: "Placed", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  processing: {
    icon: Package,
    label: "Processing",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  shipped: {
    icon: Truck,
    label: "Shipped",
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  delivered: {
    icon: CheckCircle2,
    label: "Delivered",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    tone: "bg-destructive/15 text-destructive",
  },
};

const STEPS: OrderStatus[] = ["placed", "processing", "shipped", "delivered"];

export default function Orders() {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = ORDERS.filter((o) => filter === "all" || o.status === filter);
  const open = openId ? ORDERS.find((o) => o.id === openId) : null;

  if (open) return <OrderDetail order={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-2 bg-card shadow-soft border-b border-border">
        <h1 className="text-xl font-bold">My orders</h1>
        <div className="flex gap-2 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 h-8 rounded-full text-xs font-semibold transition ${
                filter === f.id
                  ? "bg-foreground text-background shadow-card"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-16">No orders here yet.</p>
      ) : (
        <ul className="px-4 mt-3 space-y-3">
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} onOpen={() => setOpenId(o.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const sup = SUPPLIERS.find((s) => s.id === order.supplierId);
  const meta = STATUS_META[order.status];
  const total = order.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const Icon = meta.icon;

  return (
    <li>
      <button
        onClick={onOpen}
        className="w-full text-left rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition overflow-hidden"
      >
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <img src={sup?.logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{sup?.name}</p>
              <p className="text-[10px] text-muted-foreground">{order.id} · {order.date}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.tone}`}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
        </div>

        <div className="p-3 space-y-2">
          {order.items.map((it) => {
            const p = PRODUCTS.find((x) => x.id === it.productId);
            if (!p) return null;
            return (
              <div key={it.productId} className="flex items-center gap-2.5">
                <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug line-clamp-2">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {it.qty} {p.unit} × ${it.unitPrice.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 flex items-center justify-between border-t border-border bg-muted/20">
          <p className="text-[11px] text-muted-foreground">
            {order.eta ? `ETA ${order.eta}` : "—"}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">${total.toFixed(2)}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </button>
    </li>
  );
}

function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const sup = SUPPLIERS.find((s) => s.id === order.supplierId);
  const meta = STATUS_META[order.status];
  const total = order.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const activeStep =
    order.status === "cancelled" ? -1 : STEPS.indexOf(order.status as OrderStatus);

  return (
    <div className="pb-8">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted" aria-label="Back">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{order.id}</p>
          <p className="text-[10px] text-muted-foreground">{order.date}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      <div className="px-4 pt-4">
        {order.status !== "cancelled" ? (
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <p className="text-xs font-bold mb-3">Tracking</p>
            <div className="flex items-start">
              {STEPS.map((step, i) => {
                const m = STATUS_META[step];
                const done = i <= activeStep;
                const SIcon = m.icon;
                return (
                  <div key={step} className="flex-1 flex flex-col items-center relative">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                        done ? "bg-primary text-primary-foreground shadow-pop" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <SIcon className="w-4 h-4" />
                    </span>
                    <p className={`text-[10px] mt-1.5 font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {m.label}
                    </p>
                    {i < STEPS.length - 1 && (
                      <span
                        className={`absolute top-4 left-1/2 w-full h-0.5 ${
                          i < activeStep ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {order.tracking && (
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                Tracking: <span className="text-foreground font-medium">{order.tracking}</span>
              </p>
            )}
            {order.eta && (
              <p className="text-[11px] text-center mt-1">
                Expected delivery: <span className="font-bold">{order.eta}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">This order was cancelled.</p>
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
          <div className="flex items-center gap-2.5">
            <img src={sup?.logo} alt="" className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{sup?.name}</p>
              <p className="text-[11px] text-muted-foreground">{sup?.country}</p>
            </div>
            <Link
              to="/messages"
              className="px-3 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Chat
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
          <p className="text-xs font-bold mb-2">Items ({order.items.length})</p>
          <div className="space-y-2.5">
            {order.items.map((it) => {
              const p = PRODUCTS.find((x) => x.id === it.productId);
              if (!p) return null;
              return (
                <Link
                  to={`/product/${p.id}`}
                  key={it.productId}
                  className="flex items-center gap-2.5"
                >
                  <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug line-clamp-2">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {it.qty} {p.unit} × ${it.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm font-bold">${(it.qty * it.unitPrice).toFixed(2)}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" /> Ship to
          </p>
          <p className="text-xs text-muted-foreground">{order.shipTo}</p>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
          <Row label="Subtotal" value={`$${total.toFixed(2)}`} />
          <Row label="Shipping" value="Included" />
          <Row label="Trade Assurance fee" value="$0.00" />
          <div className="border-t border-border my-2" />
          <Row label="Total" value={`$${total.toFixed(2)}`} bold />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="h-10 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-1.5 shadow-card">
            <RotateCcw className="w-4 h-4" /> Reorder
          </button>
          <button className="h-10 rounded-full bg-card border border-border text-foreground text-sm font-semibold flex items-center justify-center gap-1.5 shadow-soft">
            <FileText className="w-4 h-4" /> Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={`text-xs ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`text-xs ${bold ? "text-base font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
