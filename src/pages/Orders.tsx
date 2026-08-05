import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Package, Truck, CheckCircle2, Clock, RotateCcw, MessageCircle,
  ChevronRight, XCircle, FileText, MapPin, Star, X, ShieldCheck, AlertTriangle, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import CircleSpinner from "@/components/CircleSpinner";
import CourierTrackingCard from "@/components/CourierTrackingCard";

type OrderStatus = "awaiting_payment" | "placed" | "processing" | "shipped" | "delivered" | "cancelled";

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
  delivery_courier_user_id?: string | null;
  delivery_option_label?: string | null;
  escrow_status?: "none" | "held" | "released" | "refunded" | "disputed";
  escrow_amount?: number;
  escrow_released_at?: string | null;
  dispute_opened_at?: string | null;
  dispute_reason?: string | null;
  payment_status?: string | null;
  supplier_marked_delivered_at?: string | null;
  buyer_confirmed_delivered_at?: string | null;
  refund_status?: "none" | "requested" | "declined" | "refunded" | string;
  refund_reason?: string | null;
  refund_admin_note?: string | null;
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
        <p className="text-center text-sm text-muted-foreground py-16"><CircleSpinner size={28} /></p>
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
    const { data, error } = await supabase.rpc("cancel_order_by_buyer" as never, { _order_id: order.id } as never);
    if (error) return toast.error(error.message);
    onUpdated({ ...order, ...((data as any) ?? {}), status: "cancelled", items: order.items, supplier: order.supplier });
    toast.success("Order cancelled — any payment held was returned to your wallet");
  };

  const reorder = async () => {
    for (const it of order.items) await addToCart(it.product_id, it.qty);
    toast.success("Items added back to cart");
  };

  const isDelivered = order.status === "delivered";
  const canCancel =
    (order.status === "placed" || order.status === "awaiting_payment") &&
    (order.refund_status ?? "none") !== "requested";

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

        {order.delivery_courier_user_id && order.status !== "cancelled" && order.status !== "delivered" && (
          <CourierTrackingCard
            courierUserId={order.delivery_courier_user_id}
            courierLabel={order.delivery_option_label}
          />
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

        <BuyerProtectionCard order={order} onUpdated={onUpdated} />

        {order.escrow_status && order.escrow_status !== "none" && (
          <EscrowCard order={order} />
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
          {canCancel ? (
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

function BuyerProtectionCard({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const supplierMarked = !!order.supplier_marked_delivered_at;
  const buyerConfirmed = !!order.buyer_confirmed_delivered_at || order.status === "delivered";
  const refundStatus = order.refund_status ?? "none";
  const cancelled = order.status === "cancelled";
  const refundPending = refundStatus === "requested";
  const canRequestRefund =
    !buyerConfirmed && !cancelled && !refundPending && refundStatus !== "refunded" && order.payment_status === "paid";

  const patch = (data: any) =>
    onUpdated({ ...order, ...(data ?? {}), items: order.items, supplier: order.supplier });

  const confirmDelivered = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("buyer_confirm_order_delivered" as never, { _order_id: order.id } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    patch(data);
    toast.success("Delivery confirmed — payment released to the seller");
  };

  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-4 mt-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <p className="text-xs font-bold flex-1">Buyer protection</p>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
        The seller is only paid once both of you confirm the parcel arrived.
      </p>

      <div className="mt-3 space-y-1.5">
        <ConfirmRow label="Seller marked as delivered" done={supplierMarked} at={order.supplier_marked_delivered_at} />
        <ConfirmRow label="You confirmed delivery" done={buyerConfirmed} at={order.buyer_confirmed_delivered_at} />
      </div>

      {!cancelled && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={confirmDelivered}
            disabled={!supplierMarked || buyerConfirmed || refundPending || busy}
            className="h-10 rounded-full bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {buyerConfirmed ? "Delivered" : busy ? "Confirming…" : "Mark as delivered"}
          </button>
          <button
            onClick={() => setRefundOpen(true)}
            disabled={!canRequestRefund}
            className="h-10 rounded-full bg-destructive/10 text-destructive text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {refundPending ? "Refund pending" : "Request refund"}
          </button>
        </div>
      )}

      {cancelled && (
        <p className="text-[11px] mt-3 px-2 py-1.5 rounded-md bg-muted text-muted-foreground">
          This order was cancelled, so delivery confirmation and refund requests are closed. Any payment held was
          returned to your wallet automatically.
        </p>
      )}
      {!supplierMarked && !buyerConfirmed && !cancelled && (
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          You can confirm delivery once the seller marks the order as delivered.
        </p>
      )}
      {buyerConfirmed && (
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          A refund can no longer be requested for a delivered order.
        </p>
      )}
      {refundPending && (
        <p className="text-[11px] mt-2 px-2 py-1.5 rounded-md bg-destructive/10 text-destructive">
          Refund requested{order.refund_reason ? `: ${order.refund_reason}` : ""} — our team is reviewing it.
        </p>
      )}
      {refundStatus === "declined" && (
        <p className="text-[11px] mt-2 px-2 py-1.5 rounded-md bg-muted text-muted-foreground">
          Refund request declined{order.refund_admin_note ? `: ${order.refund_admin_note}` : ""}.
        </p>
      )}
      {refundStatus === "refunded" && (
        <p className="text-[11px] mt-2 px-2 py-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
          Refunded to your wallet.
        </p>
      )}

      {refundOpen && (
        <RefundSheet
          order={order}
          onClose={() => setRefundOpen(false)}
          onDone={(data) => { patch(data); setRefundOpen(false); }}
        />
      )}
    </div>
  );
}

function ConfirmRow({ label, done, at }: { label: string; done: boolean; at?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-2.5 h-2.5" />}
      </span>
      <span className={`text-[11px] ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
      {done && at && <span className="text-[10px] text-muted-foreground ml-auto">{new Date(at).toLocaleDateString()}</span>}
    </div>
  );
}

const REFUND_REASONS = [
  "Item not received",
  "Delivery is taking too long",
  "Wrong item shipped",
  "Item damaged or faulty",
  "I no longer need it",
  "Other",
];

function RefundSheet({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: (data: any) => void }) {
  const [reason, setReason] = useState(REFUND_REASONS[0]);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const full = [reason, details.trim()].filter(Boolean).join(" — ");
    if (full.trim().length < 5) { toast.error("Please describe the reason"); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("request_order_refund" as never, {
      _order_id: order.id,
      _reason: full,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Refund requested — our team will review it");
    onDone(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-3xl p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <p className="text-sm font-bold flex-1">Request a refund</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Order {order.ref_code ?? order.id.slice(0, 8)} · ${Number(order.total).toFixed(2)} held in escrow.
        </p>
        <div className="space-y-1.5">
          {REFUND_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left text-xs px-3 h-10 rounded-xl border ${reason === r ? "border-primary bg-primary/10 font-semibold" : "border-border bg-background"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add any details that help us review (optional)"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border bg-background p-3 text-sm mt-3"
        />
        <div className="flex gap-2 mt-3">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose}>Close</Button>
          <Button variant="destructive" className="flex-1 h-11" onClick={submit} disabled={saving}>
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EscrowCard({ order }: { order: Order }) {
  const status = order.escrow_status ?? "none";
  const amount = Number(order.escrow_amount ?? order.total ?? 0);

  const tone = status === "held" ? "bg-amber-500/10 border-amber-500/30"
    : status === "released" ? "bg-emerald-500/10 border-emerald-500/30"
    : status === "disputed" ? "bg-destructive/10 border-destructive/30"
    : "bg-muted border-border";

  const Icon = status === "released" ? CheckCircle2 : status === "disputed" ? AlertTriangle : Lock;
  const label = status === "held" ? "Funds held in escrow"
    : status === "released" ? "Funds released"
    : status === "disputed" ? "Dispute open"
    : status === "refunded" ? "Refunded" : "Trade Assurance";

  return (
    <div className={`rounded-2xl border shadow-card p-4 mt-3 ${tone}`}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <p className="text-xs font-bold flex-1">Trade Assurance</p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background border border-border inline-flex items-center gap-1">
          <Icon className="w-3 h-3" /> {label}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
        ${amount.toFixed(2)} {status === "held" && "is securely held until both you and the seller confirm delivery."}
        {status === "released" && order.escrow_released_at && `released on ${new Date(order.escrow_released_at).toLocaleDateString()}.`}
        {status === "disputed" && "Our trade team is reviewing this case."}
      </p>
      {order.dispute_reason && (
        <p className="text-[11px] mt-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive">
          Reason: {order.dispute_reason}
        </p>
      )}
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
