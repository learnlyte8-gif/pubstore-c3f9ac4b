import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  FileText,
  MessageCircle,
  TrendingDown,
  Bell,
  CheckCheck,
  Truck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PRODUCTS, SUPPLIERS } from "@/data/products";

type NotifType = "order" | "rfq" | "message" | "price" | "system";

type Notif = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  to?: string;
  meta?: { productId?: string; supplierId?: string; oldPrice?: number; newPrice?: number };
};

const SEED: Notif[] = [
  {
    id: "n1",
    type: "order",
    title: "Order shipped",
    body: "PUB-2026-04781 from Shenzhen TechWave is on the way · ETA Apr 24",
    time: "2m ago",
    unread: true,
    to: "/orders",
    meta: { supplierId: "s1" },
  },
  {
    id: "n2",
    type: "rfq",
    title: "3 new quotes received",
    body: "Your RFQ for 500× Wireless Earbuds got fresh quotes — best at $18.40/unit",
    time: "18m ago",
    unread: true,
    to: "/rfq",
  },
  {
    id: "n3",
    type: "price",
    title: "Price drop on your wishlist",
    body: "Premium Leather Tote dropped 18% — was $42.00, now $34.50",
    time: "1h ago",
    unread: true,
    to: "/wishlist",
    meta: { productId: "p2", oldPrice: 42, newPrice: 34.5 },
  },
  {
    id: "n4",
    type: "message",
    title: "Mumbai Textile Co. replied",
    body: "“Yes, we can ship 500 units within 12 days. MOQ confirmed.”",
    time: "3h ago",
    unread: true,
    to: "/messages",
    meta: { supplierId: "s2" },
  },
  {
    id: "n5",
    type: "order",
    title: "Order delivered",
    body: "PUB-2026-04612 from Lagos Fashion House was delivered. Leave a review?",
    time: "Yesterday",
    unread: false,
    to: "/orders",
    meta: { supplierId: "s4" },
  },
  {
    id: "n6",
    type: "price",
    title: "Flash deal alert",
    body: "Smart LED Bulb is 35% off for the next 4 hours",
    time: "Yesterday",
    unread: false,
    to: "/home",
    meta: { productId: "p9" },
  },
  {
    id: "n7",
    type: "rfq",
    title: "Quote accepted",
    body: "You accepted Istanbul Leather Co.'s quote — $21.00/unit · 30 units",
    time: "2d ago",
    unread: false,
    to: "/rfq",
  },
  {
    id: "n8",
    type: "system",
    title: "Welcome to PUBSTORE",
    body: "Complete your profile to get personalized supplier matches.",
    time: "1w ago",
    unread: false,
    to: "/account",
  },
];

const TYPE_META: Record<NotifType, { icon: typeof Package; tone: string; label: string }> = {
  order: { icon: Truck, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400", label: "Orders" },
  rfq: { icon: FileText, tone: "bg-primary/10 text-primary", label: "RFQ" },
  message: { icon: MessageCircle, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400", label: "Messages" },
  price: { icon: TrendingDown, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Prices" },
  system: { icon: Sparkles, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "System" },
};

const FILTERS: { id: "all" | NotifType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "order", label: "Orders" },
  { id: "rfq", label: "RFQs" },
  { id: "message", label: "Messages" },
  { id: "price", label: "Prices" },
];

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>(SEED);
  const [filter, setFilter] = useState<"all" | NotifType>("all");

  const visible = items.filter((n) => filter === "all" || n.type === filter);
  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => setItems((arr) => arr.map((n) => ({ ...n, unread: false })));
  const open = (n: Notif) => {
    setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    if (n.to) navigate(n.to);
  };

  return (
    <div className="pb-8">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft sticky top-0 z-10 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Notifications</p>
          <p className="text-[10px] text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-semibold text-primary inline-flex items-center gap-1 px-2 h-8 rounded-full hover:bg-primary/10"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all
          </button>
        )}
      </div>

      <div className="px-3 pt-3 flex gap-2 overflow-x-auto scrollbar-none -mx-1 pl-4 pb-1">
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

      {visible.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold">Nothing here yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            New activity will appear in this feed.
          </p>
        </div>
      ) : (
        <ul className="px-3 mt-3 space-y-2">
          {visible.map((n) => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            const product = n.meta?.productId ? PRODUCTS.find((p) => p.id === n.meta!.productId) : undefined;
            const supplier = n.meta?.supplierId ? SUPPLIERS.find((s) => s.id === n.meta!.supplierId) : undefined;
            return (
              <li key={n.id}>
                <button
                  onClick={() => open(n)}
                  className={`w-full text-left rounded-2xl border border-border shadow-card hover:shadow-elevated transition p-3 flex gap-3 ${
                    n.unread ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <span
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.tone}`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2} />
                    {n.unread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs leading-snug ${n.unread ? "font-bold" : "font-semibold"}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>

                    {(product || supplier) && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 p-1.5">
                        {product && (
                          <>
                            <img src={product.image} alt="" className="w-9 h-9 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] line-clamp-1">{product.title}</p>
                              {n.meta?.oldPrice && n.meta?.newPrice && (
                                <p className="text-[10px] mt-0.5">
                                  <span className="text-muted-foreground line-through">
                                    ${n.meta.oldPrice.toFixed(2)}
                                  </span>{" "}
                                  <span className="font-bold text-emerald-600">
                                    ${n.meta.newPrice.toFixed(2)}
                                  </span>
                                </p>
                              )}
                            </div>
                          </>
                        )}
                        {supplier && !product && (
                          <>
                            <img src={supplier.logo} alt="" className="w-7 h-7 rounded-full object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold line-clamp-1 flex items-center gap-1">
                                {supplier.name}
                                {supplier.verified && (
                                  <ShieldCheck className="w-3 h-3 text-primary" />
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{supplier.country}</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 mt-6">
        <Link
          to="/account"
          className="block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Manage notification preferences →
        </Link>
      </div>
    </div>
  );
}
