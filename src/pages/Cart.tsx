import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, MapPin, Tag, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => `$${n.toFixed(2)}`;

type AddrRow = {
  id: string;
  recipient: string;
  line1: string;
  city: string | null;
  country: string | null;
  is_default: boolean | null;
};

type AppliedCoupon = {
  id: string;
  code: string;
  supplierId: string;
  discount: number; // dollar amount applied to that supplier's subtotal
};

export default function Cart() {
  const { cartProducts, updateQty, removeFromCart, cartTotal, clearCart } = useShop();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<AddrRow[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [coupons, setCoupons] = useState<AppliedCoupon[]>([]);

  // Group cart by supplier for coupon math
  const supplierGroups = new Map<string, { subtotal: number; items: typeof cartProducts }>();
  for (const item of cartProducts) {
    const sid = item.product.supplierId;
    const g = supplierGroups.get(sid) ?? { subtotal: 0, items: [] };
    g.subtotal += item.product.price * item.qty;
    g.items.push(item);
    supplierGroups.set(sid, g);
  }

  const totalDiscount = coupons.reduce((s, c) => s + c.discount, 0);
  const discountedSubtotal = Math.max(0, cartTotal - totalDiscount);
  const shipping = discountedSubtotal > 25 || discountedSubtotal === 0 ? 0 : 4.99;
  const total = discountedSubtotal + shipping;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("addresses")
        .select("id,recipient,line1,city,country,is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      const list = (data ?? []) as AddrRow[];
      setAddresses(list);
      const def = list.find((a) => a.is_default) ?? list[0];
      if (def) setAddressId(def.id);
    })();
  }, []);

  // Re-validate coupons whenever cart contents change (so removing a supplier's items removes its coupon)
  useEffect(() => {
    setCoupons((prev) => prev.filter((c) => {
      const g = supplierGroups.get(c.supplierId);
      return !!g && g.subtotal > 0;
    }).map((c) => {
      // Recompute discount against new subtotal — refresh by re-applying same code rules
      return c;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartTotal]);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (code.length > 50) { toast.error("Code too long"); return; }
    if (coupons.some((c) => c.code === code)) { toast.error("Coupon already applied"); return; }

    setValidating(true);
    try {
      const { data: list, error } = await supabase
        .from("coupons")
        .select("id,supplier_id,code,discount_type,discount_value,min_subtotal,max_uses,uses_count,expires_at,active")
        .ilike("code", code);
      if (error) throw error;
      const now = Date.now();
      const valid = (list ?? []).find((c: any) => {
        if (!c.active) return false;
        if (c.expires_at && new Date(c.expires_at).getTime() < now) return false;
        if (c.max_uses !== null && c.max_uses !== undefined && c.uses_count >= c.max_uses) return false;
        const g = supplierGroups.get(c.supplier_id);
        if (!g) return false;
        if (g.subtotal < Number(c.min_subtotal || 0)) return false;
        return true;
      });
      if (!valid) {
        toast.error("Invalid or inapplicable coupon");
        return;
      }
      const g = supplierGroups.get((valid as any).supplier_id)!;
      const dv = Number((valid as any).discount_value);
      const discount = (valid as any).discount_type === "percent"
        ? Math.min(g.subtotal, (g.subtotal * dv) / 100)
        : Math.min(g.subtotal, dv);
      setCoupons((prev) => [...prev, {
        id: (valid as any).id,
        code: (valid as any).code,
        supplierId: (valid as any).supplier_id,
        discount,
      }]);
      setCouponInput("");
      toast.success(`Coupon ${(valid as any).code} applied · -${fmt(discount)}`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not apply coupon");
    } finally {
      setValidating(false);
    }
  };

  const removeCoupon = (id: string) => setCoupons((prev) => prev.filter((c) => c.id !== id));

  const placeOrder = async () => {
    if (cartProducts.length === 0) return;
    if (!addressId) {
      toast.error("Add a shipping address first");
      navigate("/addresses");
      return;
    }
    setPlacing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const addr = addresses.find((a) => a.id === addressId);
      const shipTo = addr ? `${addr.recipient}, ${addr.line1}, ${addr.city ?? ""}, ${addr.country ?? ""}` : "";

      const placedRefs: string[] = [];
      for (const [supplierId, group] of supplierGroups) {
        const subtotal = group.subtotal;
        const coupon = coupons.find((c) => c.supplierId === supplierId);
        const discount = coupon?.discount ?? 0;
        const afterDiscount = Math.max(0, subtotal - discount);
        const ship = afterDiscount > 25 ? 0 : 4.99;
        const orderTotal = afterDiscount + ship;

        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .insert({
            buyer_id: user.id,
            supplier_id: supplierId,
            address_id: addressId,
            ship_to: shipTo,
            subtotal,
            shipping: ship,
            discount,
            coupon_code: coupon?.code ?? null,
            total: orderTotal,
            status: "placed",
          })
          .select("id,ref_code")
          .single();
        if (orderErr || !order) throw orderErr ?? new Error("Order failed");

        const itemRows = group.items.map((it) => ({
          order_id: order.id,
          product_id: it.product.id,
          qty: it.qty,
          unit_price: it.product.price,
          title: it.product.title,
          image: it.product.image,
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
        if (itemsErr) throw itemsErr;

        // Record coupon redemption
        if (coupon) {
          await supabase.from("coupon_redemptions").insert({
            coupon_id: coupon.id,
            order_id: order.id,
            buyer_id: user.id,
            amount: discount,
          });
        }

        // Notify buyer
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "order_placed",
          title: "Order placed",
          body: `Your order ${order.ref_code ?? ""} has been placed.`,
          link: `/orders`,
        });

        // Notify supplier owner
        const { data: sup } = await supabase
          .from("suppliers")
          .select("owner_id,name")
          .eq("id", supplierId)
          .maybeSingle();
        if (sup?.owner_id) {
          await supabase.from("notifications").insert({
            user_id: sup.owner_id,
            type: "new_order",
            title: "New order received",
            body: `${itemRows.length} item(s) · ${fmt(orderTotal)}`,
            link: `/store/orders`,
          });
        }
        if (order.ref_code) placedRefs.push(order.ref_code);
      }

      await clearCart();
      toast.success(placedRefs.length > 1 ? `${placedRefs.length} orders placed` : "Order placed", {
        description: placedRefs.join(" · "),
      });
      navigate("/orders");
    } catch (e) {
      console.error(e);
      toast.error("Could not place order", { description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setPlacing(false);
    }
  };

  if (cartProducts.length === 0) {
    return (
      <div className="px-6 pt-16 pb-24 text-center animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
          <ShoppingBag className="w-9 h-9 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          Browse the marketplace and add items you love.
        </p>
        <Link to="/home">
          <Button className="mt-6 h-11 px-6 rounded-full bg-primary text-primary-foreground">
            Start shopping
          </Button>
        </Link>
      </div>
    );
  }

  const selectedAddr = addresses.find((a) => a.id === addressId);

  return (
    <div className="pb-32">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Cart ({cartProducts.length})</h1>
        <button onClick={clearCart} className="text-xs text-muted-foreground hover:text-destructive">
          Clear all
        </button>
      </div>

      {/* Address picker */}
      <div className="mx-4 mb-2 rounded-xl border bg-card p-3 flex items-start gap-2">
        <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {selectedAddr ? (
            <>
              <p className="text-xs font-bold truncate">{selectedAddr.recipient}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {selectedAddr.line1}, {selectedAddr.city}, {selectedAddr.country}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No shipping address set.</p>
          )}
        </div>
        <Link to="/addresses" className="text-xs font-bold text-primary shrink-0">
          {selectedAddr ? "Change" : "Add"}
        </Link>
      </div>

      <ul className="divide-y divide-border">
        {cartProducts.map(({ product, qty }) => (
          <li key={product.id} className="flex gap-3 px-4 py-3">
            <img
              src={product.image}
              alt={product.title}
              loading="lazy"
              className="w-20 h-20 rounded-lg object-cover bg-muted shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-sm leading-snug line-clamp-2">{product.title}</p>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-base font-bold text-destructive">{fmt(product.price)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(product.id, qty - 1)}
                    aria-label="Decrease"
                    className="w-7 h-7 rounded-md border border-border flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    onClick={() => updateQty(product.id, qty + 1)}
                    aria-label="Increase"
                    className="w-7 h-7 rounded-md border border-border flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeFromCart(product.id)}
                    aria-label="Remove"
                    className="ml-1 w-7 h-7 text-muted-foreground hover:text-destructive flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Coupon */}
      <div className="mx-4 mt-4 rounded-2xl border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold">Discount code</p>
        </div>
        <div className="flex gap-2">
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase().slice(0, 50))}
            onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
            placeholder="Enter code"
            className="flex-1 h-10 rounded-xl border bg-background px-3 text-sm font-mono uppercase tracking-wider"
            maxLength={50}
          />
          <Button onClick={applyCoupon} disabled={validating || !couponInput.trim()} className="h-10 px-4">
            {validating ? "…" : "Apply"}
          </Button>
        </div>
        {coupons.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {coupons.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg px-2.5 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="font-bold">{c.code}</span>
                <span className="ml-auto font-bold">-{fmt(c.discount)}</span>
                <button onClick={() => removeCoupon(c.id)} aria-label="Remove" className="p-0.5 rounded-full hover:bg-foreground/10">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky checkout bar */}
      <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-30 bg-background border-t border-border safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">
              {totalDiscount > 0 ? `Saved ${fmt(totalDiscount)} · ` : ""}
              {shipping === 0 ? "Free shipping" : `+ ${fmt(shipping)} ship`}
            </p>
            <p className="text-lg font-bold text-destructive leading-tight">{fmt(total)}</p>
          </div>
          <Button
            onClick={placeOrder}
            disabled={placing}
            className="h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold"
          >
            {placing ? "Placing…" : <>Checkout <ArrowRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
