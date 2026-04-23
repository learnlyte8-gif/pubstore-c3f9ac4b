import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Package, Truck, CheckCircle2, Clock, RotateCcw, MessageCircle,
  ChevronRight, XCircle, FileText, MapPin, Star, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type OrderStatus = "placed" | "processing" | "shipped" | "delivered" | "cancelled";

type Item = {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  title: string | null;
  image: string | null;
};

type Order = {
  id: string;
  ref_code: string | null;
  created_at: string;
  status: OrderStatus;
  ship_to: string | null;
  tracking: string | null;
  eta: string | null;
  subtotal: number;
  shipping: number;
  discount?: number;
  coupon_code?: string | null;
  total: number;
  supplier_id: string;
  supplier?: { id: string; name: string; logo: string | null; country: string | null };
  items: Item[];
};

const FILTERS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "placed", label: "Placed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const STATUS_META: Record<OrderStatus, { icon: typeof Package; label: string; tone: string }> = {
  awaiting_payment: { icon: Clock, label: "Awaiting payment", tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  placed: { icon: Clock, label: "Placed", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  processing: { icon: Package, label: "Processing", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  shipped: { icon: Truck, label: "Shipped", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  delivered: { icon: CheckCircle2, label: "Delivered", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cancelled: { icon: XCircle, label: "Cancelled", tone: "bg-destructive/15 text-destructive" },
};

const STEPS: OrderStatus[] = ["placed", "processing", "shipped", "delivered"];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reviewedProductIds, setReviewedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: ords } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      const list = (ords ?? []) as unknown as Order[];
      if (list.length) {
        const ids = list.map((o) => o.id);
        const supIds = Array.from(new Set(list.map((o) => o.supplier_id)));
        const [{ data: items }, { data: sups }, { data: revs }] = await Promise.all([
          supabase.from("order_items").select("*").in("order_id", ids),
          supabase.from("suppliers").select("id,name,logo,country").in("id", supIds),
          supabase.from("reviews").select("product_id").eq("user_id", user.id),
        ]);
        const supMap = new Map((sups ?? []).map((s) => [s.id, s]));
        const itemsByOrder = new Map<string, Item[]>();
        (items ?? []).forEach((it) => {
          const arr = itemsByOrder.get(it.order_id) ?? [];
          arr.push(it as Item);
          itemsByOrder.set(it.order_id, arr);
        });
        setOrders(list.map((o) => ({
          ...o,
          supplier: supMap.get(o.supplier_id) as Order["supplier"],
          items: itemsByOrder.get(o.id) ?? [],
        })));
        setReviewedProductIds(new Set((revs ?? []).map((r) => r.product_id)));
      } else {
        setOrders([]);
      }
      setLoading(false);
    })();
  }, []);

  const visible = orders.filter((o) => filter === "all" || o.status === filter);
  const open = openId ? orders.find((o) => o.id === openId) : null;

  if (open) return (
    <OrderDetail
      order={open}
      reviewedProductIds={reviewedProductIds}
      onReviewed={(pid) => setReviewedProductIds((s) => new Set(s).add(pid))}
      onBack={() => setOpenId(null)}
      onUpdated={(o) => setOrders((xs) => xs.map((x) => x.id === o.id ? o : x))}
    />
  );

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
                filter === f.id ? "bg-foreground text-background shadow-card" : "bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-16">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Package className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-bold mt-3">No orders yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add items to your cart and place your first order.</p>
          <Link to="/home" className="inline-block mt-4 px-4 h-10 leading-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="px-4 mt-3 space-y-3">
          {visible.map((o) => <OrderCard key={o.id} order={o} onOpen={() => setOpenId(o.id)} />)}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const meta = STATUS_META[order.status];
  const Icon = meta.icon;
  return (
    <li>
      <button
        onClick={onOpen}
        className="w-full text-left rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition overflow-hidden"
      >
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            {order.supplier?.logo && <img src={order.supplier.logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{order.supplier?.name ?? "Supplier"}</p>
              <p className="text-[10px] text-muted-foreground">{order.ref_code ?? order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.tone}`}>
            <Icon className="w-3 h-3" />{meta.label}
          </span>
        </div>

        <div className="p-3 space-y-2">
          {order.items.slice(0, 3).map((it) => (
            <div key={it.id} className="flex items-center gap-2.5">
              <img src={it.image ?? "/placeholder.svg"} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug line-clamp-2">{it.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{it.qty} × ${Number(it.unit_price).toFixed(2)}</p>
              </div>
            </div>
          ))}
          {order.items.length > 3 && <p className="text-[10px] text-muted-foreground">+{order.items.length - 3} more</p>}
        </div>

        <div className="px-3 py-2 flex items-center justify-between border-t border-border bg-muted/20">
          <p className="text-[11px] text-muted-foreground">{order.eta ? `ETA ${order.eta}` : "—"}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">${Number(order.total).toFixed(2)}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </button>
    </li>
  );
}

function OrderDetail({
  order, onBack, onUpdated, reviewedProductIds, onReviewed,
}: {
  order: Order;
  onBack: () => void;
  onUpdated: (o: Order) => void;
  reviewedProductIds: Set<string>;
  onReviewed: (pid: string) => void;
}) {
  const meta = STATUS_META[order.status];
  const activeStep = order.status === "cancelled" ? -1 : STEPS.indexOf(order.status);
  const { addToCart } = useShop();
  const [reviewItem, setReviewItem] = useState<Item | null>(null);

  const cancel = async () => {
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    if (error) return toast.error("Could not cancel");
    onUpdated({ ...order, status: "cancelled" });
    toast.success("Order cancelled");
  };

  const reorder = async () => {
    for (const it of order.items) await addToCart(it.product_id, it.qty);
    toast.success("Items added back to cart");
  };

  const isDelivered = order.status === "delivered";

  return (
    <div className="pb-8">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted" aria-label="Back">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{order.ref_code ?? order.id.slice(0, 8)}</p>
          <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.tone}`}>{meta.label}</span>
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
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${done ? "bg-primary text-primary-foreground shadow-pop" : "bg-muted text-muted-foreground"}`}>
                      <SIcon className="w-4 h-4" />
                    </span>
                    <p className={`text-[10px] mt-1.5 font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</p>
                    {i < STEPS.length - 1 && <span className={`absolute top-4 left-1/2 w-full h-0.5 ${i < activeStep ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
            {order.tracking && <p className="text-[11px] text-muted-foreground mt-3 text-center">Tracking: <span className="text-foreground font-medium">{order.tracking}</span></p>}
            {order.eta && <p className="text-[11px] text-center mt-1">Expected delivery: <span className="font-bold">{order.eta}</span></p>}
          </div>
        ) : (
          <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">This order was cancelled.</p>
          </div>
        )}

        {order.supplier && (
          <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
            <div className="flex items-center gap-2.5">
              {order.supplier.logo && <img src={order.supplier.logo} alt="" className="w-10 h-10 rounded-full object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{order.supplier.name}</p>
                <p className="text-[11px] text-muted-foreground">{order.supplier.country}</p>
              </div>
              <Link to="/messages" className="px-3 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
          <p className="text-xs font-bold mb-2">Items ({order.items.length})</p>
          <div className="space-y-2.5">
            {order.items.map((it) => {
              const reviewed = reviewedProductIds.has(it.product_id);
              return (
                <div key={it.id} className="flex items-center gap-2.5">
                  <Link to={`/product/${it.product_id}`} className="shrink-0">
                    <img src={it.image ?? "/placeholder.svg"} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${it.product_id}`} className="text-xs leading-snug line-clamp-2 hover:text-primary">{it.title}</Link>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{it.qty} × ${Number(it.unit_price).toFixed(2)}</p>
                    {isDelivered && (
                      reviewed ? (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Reviewed
                        </span>
                      ) : (
                        <button
                          onClick={() => setReviewItem(it)}
                          className="inline-flex items-center gap-1 mt-1.5 px-2 h-6 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold"
                        >
                          <Star className="w-3 h-3" /> Write a review
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-sm font-bold">${(it.qty * Number(it.unit_price)).toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {order.ship_to && (
          <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
            <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Ship to</p>
            <p className="text-xs text-muted-foreground">{order.ship_to}</p>
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
          <Row label="Subtotal" value={`$${Number(order.subtotal).toFixed(2)}`} />
          {Number(order.discount || 0) > 0 && (
            <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`} value={`-$${Number(order.discount).toFixed(2)}`} />
          )}
          <Row label="Shipping" value={Number(order.shipping) === 0 ? "Free" : `$${Number(order.shipping).toFixed(2)}`} />
          <div className="border-t border-border my-2" />
          <Row label="Total" value={`$${Number(order.total).toFixed(2)}`} bold />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={reorder} className="h-10 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-1.5 shadow-card">
            <RotateCcw className="w-4 h-4" /> Reorder
          </button>
          {order.status === "placed" ? (
            <button onClick={cancel} className="h-10 rounded-full bg-destructive/10 text-destructive text-sm font-semibold flex items-center justify-center gap-1.5 shadow-soft">
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          ) : (
            <button className="h-10 rounded-full bg-card border border-border text-foreground text-sm font-semibold flex items-center justify-center gap-1.5 shadow-soft">
              <FileText className="w-4 h-4" /> Invoice
            </button>
          )}
        </div>
      </div>

      {reviewItem && (
        <ReviewModal
          item={reviewItem}
          onClose={() => setReviewItem(null)}
          onDone={(pid) => { onReviewed(pid); setReviewItem(null); }}
        />
      )}
    </div>
  );
}

function ReviewModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: (pid: string) => void }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (rating < 1 || rating > 5) { toast.error("Pick a rating"); return; }
    if (trimmed.length > 1000) { toast.error("Review too long (max 1000 chars)"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in required"); setSaving(false); return; }
    const { error } = await supabase.from("reviews").insert({
      product_id: item.product_id,
      user_id: user.id,
      rating,
      text: trimmed || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Review posted · thanks!");
    onDone(item.product_id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-3xl p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <img src={item.image ?? "/placeholder.svg"} alt="" className="w-12 h-12 rounded-xl object-cover bg-muted" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Write a review</p>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{item.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center justify-center gap-1 my-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} type="button" onClick={() => setRating(i + 1)} aria-label={`${i + 1} stars`}>
              <Star className={`w-8 h-8 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          placeholder="Tell other buyers what you think (optional)…"
          rows={4}
          className="w-full rounded-xl border bg-background p-3 text-sm"
          maxLength={1000}
        />
        <p className="text-[10px] text-muted-foreground text-right mt-1">{text.length}/1000</p>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-11" onClick={submit} disabled={saving}>
            {saving ? "Posting…" : "Post review"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={`text-xs ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-xs ${bold ? "text-base font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
