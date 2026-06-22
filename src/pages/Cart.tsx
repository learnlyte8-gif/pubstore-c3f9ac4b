import { useEffect, useMemo, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, MapPin, Tag, X, CheckCircle2, Wallet, Smartphone, CreditCard, Banknote, ShieldCheck, Loader2, Truck, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { useVerification } from "@/hooks/useVerification";
import { useQuery } from "@tanstack/react-query";
import { courierToRate, quoteCourierRate, summarizeRate } from "@/lib/courierRates";

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
  discount: number;
};

type PayMethod = "wallet" | "pesepay" | "paypal" | "cod";

type DeliveryOption = {
  id: string;
  supplierId: string;
  courierUserId: string | null;
  label: string;
  sub: string;
  courier: any;
  isDefault: boolean;
  isSelf?: boolean;
};

const sb = supabase as any;

export default function Cart() {
  const { cartProducts, updateQty, removeFromCart, cartTotal, clearCart } = useShop();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { balance, payOrder } = useWallet();
  const { isApproved: isVerified, status: verificationStatus, loading: verificationLoading } = useVerification();
  const [addresses, setAddresses] = useState<AddrRow[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [coupons, setCoupons] = useState<AppliedCoupon[]>([]);
  const [payMethod, setPayMethod] = useState<PayMethod>("wallet");

  // Group cart by supplier for coupon math
  const supplierGroups = useMemo(() => {
    const m = new Map<string, { subtotal: number; items: typeof cartProducts }>();
    for (const item of cartProducts) {
      const sid = item.product.supplierId;
      const g = m.get(sid) ?? { subtotal: 0, items: [] };
      g.subtotal += item.product.price * item.qty;
      g.items.push(item);
      m.set(sid, g);
    }
    return m;
  }, [cartProducts]);

  const supplierIds = useMemo(() => Array.from(supplierGroups.keys()), [supplierGroups]);




  // Fetch delivery options per supplier: their own self-delivery (if they're a courier)
  // plus any active courier partnerships. Default partnership is pre-selected.
  const { data: deliveryOptionsBySupplier = {} } = useQuery({
    queryKey: ["cart-delivery-options", supplierIds.join(",")],
    enabled: supplierIds.length > 0,
    queryFn: async () => {
      const result: Record<string, DeliveryOption[]> = {};
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, owner_id, name, logo")
        .in("id", supplierIds);
      const ownerIds = (suppliers ?? []).map((s: any) => s.owner_id).filter(Boolean);
      const { data: ownerCouriers } = ownerIds.length
        ? await supabase.from("courier_profiles" as any).select("*").in("user_id", ownerIds)
        : { data: [] as any[] };
      const ownerCourierMap = new Map((ownerCouriers ?? []).map((c: any) => [c.user_id, c]));

      const { data: partsRaw } = await supabase
        .from("supplier_courier_partnerships" as any)
        .select("*")
        .in("supplier_id", supplierIds)
        .eq("status", "active");
      const parts: any[] = (partsRaw as any[]) ?? [];
      const partCourierIds = parts.map((p) => p.courier_user_id);
      const { data: partCouriers } = partCourierIds.length
        ? await supabase.from("courier_profiles" as any).select("*").in("user_id", partCourierIds)
        : { data: [] as any[] };
      const partCourierMap = new Map((partCouriers ?? []).map((c: any) => [c.user_id, c]));

      for (const s of (suppliers ?? []) as any[]) {
        const opts: DeliveryOption[] = [];
        const selfCourier = ownerCourierMap.get(s.owner_id);
        if (selfCourier) {
          opts.push({
            id: `self-${s.id}`,
            supplierId: s.id,
            courierUserId: selfCourier.user_id,
            label: `${s.name} (self-delivery)`,
            sub: summarizeRate(courierToRate(selfCourier)),
            courier: selfCourier,
            isDefault: true,
            isSelf: true,
          });
        }
        const supplierParts = parts.filter((p) => p.supplier_id === s.id);
        for (const p of supplierParts) {
          const c = partCourierMap.get(p.courier_user_id);
          if (!c) continue;
          opts.push({
            id: p.id,
            supplierId: s.id,
            courierUserId: p.courier_user_id,
            label: c.company_name || c.display_name || "Courier",
            sub: summarizeRate(courierToRate(c)),
            courier: c,
            isDefault: !selfCourier && !!p.is_default,
          });
        }
        if (opts.length === 0) {
          opts.push({
            id: `flat-${s.id}`,
            supplierId: s.id,
            courierUserId: null,
            label: "Standard shipping",
            sub: "Flat $4.99 · free over $25",
            courier: null,
            isDefault: true,
          });
        }
        result[s.id] = opts;
      }
      return result;
    },
  });

  // The buyer's pick per supplier (option id).
  const [deliveryPicks, setDeliveryPicks] = useState<Record<string, string>>({});
  useEffect(() => {
    setDeliveryPicks((prev) => {
      const next = { ...prev };
      for (const sid of supplierIds) {
        const opts = deliveryOptionsBySupplier[sid] ?? [];
        if (opts.length === 0) continue;
        if (!next[sid] || !opts.find((o) => o.id === next[sid])) {
          next[sid] = (opts.find((o) => o.isDefault) ?? opts[0]).id;
        }
      }
      return next;
    });
  }, [supplierIds, deliveryOptionsBySupplier]);

  // Compute shipping fee per supplier from picked option using courier rate quote.
  const shippingBySupplier = useMemo(() => {
    const map: Record<string, { fee: number; label: string; courierUserId: string | null }> = {};
    for (const [sid, group] of supplierGroups) {
      const opts = deliveryOptionsBySupplier[sid] ?? [];
      const pickId = deliveryPicks[sid] ?? opts[0]?.id;
      const opt = opts.find((o) => o.id === pickId) ?? opts[0];
      const subtotalAfterDiscount = Math.max(0, group.subtotal - (coupons.find((c) => c.supplierId === sid)?.discount ?? 0));
      let fee: number;
      if (!opt) {
        fee = subtotalAfterDiscount > 25 || subtotalAfterDiscount === 0 ? 0 : 4.99;
      } else if (!opt.courier) {
        fee = subtotalAfterDiscount > 25 || subtotalAfterDiscount === 0 ? 0 : 4.99;
      } else {
        // Default to a nominal 5km / 1kg estimate when no geo/weight data is available.
        const totalWeight = group.items.reduce((s, it) => s + it.qty, 0);
        const quote = quoteCourierRate(courierToRate(opt.courier), {
          distanceKm: 5,
          weightKg: Math.max(1, totalWeight),
          orderSubtotal: subtotalAfterDiscount,
        });
        fee = quote.amount;
      }
      map[sid] = { fee, label: opt?.label ?? "Standard shipping", courierUserId: opt?.courierUserId ?? null };
    }
    return map;
  }, [supplierGroups, deliveryPicks, deliveryOptionsBySupplier, coupons]);

  const totalDiscount = coupons.reduce((s, c) => s + c.discount, 0);
  const discountedSubtotal = Math.max(0, cartTotal - totalDiscount);
  const shipping = Object.values(shippingBySupplier).reduce((s, v) => s + v.fee, 0);
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

  // After Pesepay web redirect, finalise via pesepay-status
  useEffect(() => {
    const ref = searchParams.get("pesepay_ref");
    const pref = searchParams.get("pesepay_pref");
    if (!ref || !pref) return;
    (async () => {
      try {
        const { data, error } = await sb.functions.invoke("pesepay-status", {
          body: { reference: ref, pesepayReference: pref },
        });
        if (error) throw error;
        if (data?.paid) {
          await clearCart();
          toast.success("Payment received 🎉");
          navigate("/orders");
          return;
        }
        toast.message("Payment is still pending", { description: "We'll update your order once it clears." });
      } catch (e) {
        toast.error("Could not verify Pesepay payment");
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete("pesepay_ref");
        next.delete("pesepay_pref");
        setSearchParams(next, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Re-validate coupons when cart changes
  useEffect(() => {
    setCoupons((prev) => prev.filter((c) => {
      const g = supplierGroups.get(c.supplierId);
      return !!g && g.subtotal > 0;
    }));
  }, [supplierGroups]);

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
        if (c.max_uses != null && c.uses_count >= c.max_uses) return false;
        const g = supplierGroups.get(c.supplier_id);
        if (!g) return false;
        if (g.subtotal < Number(c.min_subtotal || 0)) return false;
        return true;
      });
      if (!valid) { toast.error("Invalid or inapplicable coupon"); return; }
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

  /** Create the order rows. Returns the array of created order ids + ref codes. */
  const createOrders = async (userId: string, statusOverride?: string): Promise<{ id: string; ref: string | null; total: number }[]> => {
    const addr = addresses.find((a) => a.id === addressId);
    const shipTo = addr ? `${addr.recipient}, ${addr.line1}, ${addr.city ?? ""}, ${addr.country ?? ""}` : "";
    const created: { id: string; ref: string | null; total: number }[] = [];

    for (const [supplierId, group] of supplierGroups) {
      const subtotal = group.subtotal;
      const coupon = coupons.find((c) => c.supplierId === supplierId);
      const discount = coupon?.discount ?? 0;
      const afterDiscount = Math.max(0, subtotal - discount);
      const shipInfo = shippingBySupplier[supplierId];
      const ship = shipInfo?.fee ?? (afterDiscount > 25 ? 0 : 4.99);
      const orderTotal = afterDiscount + ship;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          buyer_id: userId,
          supplier_id: supplierId,
          address_id: addressId,
          ship_to: shipTo,
          subtotal,
          shipping: ship,
          discount,
          coupon_code: coupon?.code ?? null,
          total: orderTotal,
          status: (statusOverride ?? "placed") as any,
          payment_method: payMethod,
          payment_status: payMethod === "cod" ? "cod" : "pending",
          delivery_courier_user_id: shipInfo?.courierUserId ?? null,
          delivery_option_label: shipInfo?.label ?? null,
        } as any)
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

      if (coupon) {
        await supabase.from("coupon_redemptions").insert({
          coupon_id: coupon.id,
          order_id: order.id,
          buyer_id: userId,
          amount: discount,
        });
      }
      created.push({ id: order.id, ref: order.ref_code ?? null, total: orderTotal });
    }
    return created;
  };

  const placeOrder = async () => {
    if (cartProducts.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.message("Sign in to checkout", { description: "Your cart will be saved." });
      navigate(`/auth?redirect=${encodeURIComponent("/cart")}`);
      return;
    }
    if (!addressId) {
      toast.error("Add a shipping address first");
      navigate("/addresses");
      return;
    }
    if (payMethod === "wallet" && balance < total) {
      toast.error("Insufficient PUBSTORE Pay balance", {
        description: `Need ${fmt(total)} · You have ${fmt(balance)}`,
        action: { label: "Top up", onClick: () => navigate("/wallet") },
      });
      return;
    }
    // No mobile-money pre-check needed: Pesepay collects details on its hosted page.

    if (payMethod === "cod" && !isVerified) {
      toast.error("Verification required for Cash on delivery", {
        description: "Upload your ID and proof of residency to unlock COD.",
        action: { label: "Verify now", onClick: () => navigate("/verification") },
      });
      return;
    }

    if (payMethod === "manual") {
      if (!manualAvailable) {
        toast.error("Manual payment isn't enabled for one or more suppliers in your cart");
        return;
      }
      if (!manualRef.trim()) {
        toast.error("Enter the EcoCash transaction reference you received");
        return;
      }
    }

    setPlacing(true);
    try {
      // Wallet & COD & manual: orders go straight to "placed".
      if (payMethod === "wallet" || payMethod === "cod" || payMethod === "manual") {
        const created = await createOrders(user.id, "placed");
        if (payMethod === "wallet") {
          for (const o of created) {
            await payOrder(o.id);
          }
        }
        await clearCart();
        toast.success(
          payMethod === "cod" ? "Order placed · Pay on delivery" :
          payMethod === "manual" ? "Order placed · Awaiting payment confirmation" :
          "Order placed"
        );
        navigate("/orders");
        return;
      }

      // Real-money flows: orders are first created as awaiting_payment
      const created = await createOrders(user.id, "awaiting_payment");
      const orderIds = created.map((o) => o.id);

      if (payMethod === "paypal") {
        const origin = window.location.origin;
        const { data, error } = await sb.functions.invoke("paypal-create-order", {
          body: {
            purpose: "order",
            orderIds,
            returnUrl: `${origin}/orders?paypal_capture=1`,
            cancelUrl: `${origin}/orders?paypal_cancelled=1`,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        await clearCart();
        window.location.href = data.approveUrl;
        return;
      }

      if (payMethod === "pesepay") {
        const origin = window.location.origin;
        // The hosted page handles the rest — we'll confirm via pesepay-status on return.
        const back = new URL(`${origin}/cart`);
        const { data, error } = await sb.functions.invoke("pesepay-create-payment", {
          body: {
            purpose: "order",
            orderIds,
            returnUrl: back.toString(),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        await clearCart();
        // Tack our refs onto the return URL so we can confirm. Pesepay preserves the URL.
        back.searchParams.set("pesepay_ref", data.reference);
        back.searchParams.set("pesepay_pref", data.pesepayReference || "");
        // We can't change Pesepay's saved returnUrl after init, but most flows redirect
        // straight to redirectUrl which itself bounces back to our `back` value.
        window.location.href = data.redirectUrl;
        return;
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not start payment", { description: await getEdgeFunctionErrorMessage(e, "Try again.") });
    } finally {
      setPlacing(false);
    }
  };

  if (cartProducts.length === 0) {
    return (
      <div className="px-6 pt-16  text-center animate-fade-up">
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
    <div className="">
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
            <img src={product.image} alt={product.title} loading="lazy" className="w-20 h-20 rounded-lg object-cover bg-muted shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-sm leading-snug line-clamp-2">{product.title}</p>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-base font-bold text-destructive">{fmt(product.price)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(product.id, qty - 1)} aria-label="Decrease" className="w-7 h-7 rounded-md border border-border flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button onClick={() => updateQty(product.id, qty + 1)} aria-label="Increase" className="w-7 h-7 rounded-md border border-border flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeFromCart(product.id)} aria-label="Remove" className="ml-1 w-7 h-7 text-muted-foreground hover:text-destructive flex items-center justify-center">
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

      {/* Delivery options per supplier */}
      <div className="mx-4 mt-4 rounded-2xl border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold">Delivery options</p>
        </div>
        <div className="space-y-3">
          {supplierIds.map((sid) => {
            const opts = deliveryOptionsBySupplier[sid] ?? [];
            const group = supplierGroups.get(sid);
            const supplierName = group?.items[0]?.product.supplierName ?? "Supplier";
            const fee = shippingBySupplier[sid]?.fee ?? 0;
            return (
              <div key={sid} className="rounded-xl border p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-muted-foreground truncate">{supplierName}</p>
                  <p className="text-[11px] font-bold text-destructive">{fee === 0 ? "FREE" : fmt(fee)}</p>
                </div>
                <div className="space-y-1.5">
                  {opts.map((opt) => {
                    const active = deliveryPicks[sid] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDeliveryPicks((prev) => ({ ...prev, [sid]: opt.id }))}
                        className={`w-full text-left rounded-lg border p-2.5 flex items-start gap-2 transition ${
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-background"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${active ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-background" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate">{opt.label}</span>
                            {opt.isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">SELF</span>}
                            {opt.isDefault && !opt.isSelf && <BadgeCheck className="w-3 h-3 text-primary" />}
                          </span>
                          <span className="block text-[10px] text-muted-foreground truncate">{opt.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment method picker */}
      <div className="mx-4 mt-4 rounded-2xl border bg-card p-3">
        <p className="text-xs font-bold mb-2">Payment method</p>
        <div className="grid grid-cols-2 gap-2">
          <PayOption
            active={payMethod === "wallet"}
            onClick={() => setPayMethod("wallet")}
            icon={Wallet}
            label="PUBSTORE Pay"
            sub={`Balance ${fmt(balance)}`}
            insufficient={balance < total}
          />
          <PayOption
            active={payMethod === "pesepay"}
            onClick={() => setPayMethod("pesepay")}
            icon={Smartphone}
            label="Pesepay"
            sub="EcoCash · OneMoney · Visa"
          />
          <PayOption
            active={payMethod === "paypal"}
            onClick={() => setPayMethod("paypal")}
            icon={CreditCard}
            label="PayPal"
            sub="Cards & PayPal"
          />
          <PayOption
            active={payMethod === "cod"}
            onClick={() => setPayMethod("cod")}
            icon={Banknote}
            label="Cash on delivery"
            sub={
              verificationLoading ? "Checking eligibility…" :
              isVerified ? "Pay supplier on receipt" :
              verificationStatus === "pending" ? "Verification pending" :
              verificationStatus === "rejected" ? "Verification rejected" :
              "Verify ID to unlock"
            }
            insufficient={!verificationLoading && !isVerified}
          />
          <PayOption
            active={payMethod === "manual"}
            onClick={() => setPayMethod("manual")}
            icon={Smartphone}
            label="Manual EcoCash"
            sub={manualAvailable ? "Send & submit reference" : "Not enabled by supplier"}
            insufficient={!manualAvailable}
          />
        </div>

        {payMethod === "cod" && !verificationLoading && !isVerified && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold">Verification required</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                Upload your government ID and proof of residency. A supplier will review and approve before you can pay on delivery.
              </p>
              <button
                type="button"
                onClick={() => navigate("/verification")}
                className="mt-2 text-[11px] font-bold text-primary underline underline-offset-2"
              >
                {verificationStatus === "pending" ? "View status" : verificationStatus === "rejected" ? "Re-submit documents" : "Verify now →"}
              </button>
            </div>
          </div>
        )}

        {payMethod === "pesepay" && (
          <p className="mt-3 text-[10px] text-muted-foreground leading-tight">
            You'll be redirected to Pesepay to complete payment with EcoCash, OneMoney, ZIPIT or your Visa card. We'll bring you right back when it's done.
          </p>
        )}

        {payMethod === "manual" && (
          <div className="mt-3 space-y-3">
            {supplierIds.map((sid) => {
              const m = manualBySupplier[sid];
              if (!m) return null;
              if (!m.enabled) {
                return (
                  <div key={sid} className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[11px]">
                    <p className="font-bold">{m.supplierName}</p>
                    <p className="text-muted-foreground mt-0.5">This supplier hasn't enabled manual payment. Pick another method.</p>
                  </div>
                );
              }
              return (
                <div key={sid} className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Send to {m.supplierName}</p>
                      <p className="text-sm font-extrabold">{m.number}</p>
                      {m.name && <p className="text-[11px] text-muted-foreground">{m.name}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(m.number || ""); toast.success("Number copied"); }}
                      className="text-[11px] font-bold text-primary px-2 py-1 rounded-md bg-background border"
                    >
                      Copy
                    </button>
                  </div>
                  {m.instructions && (
                    <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-snug">{m.instructions}</p>
                  )}
                </div>
              );
            })}

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">EcoCash reference *</label>
              <input
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder="e.g. EC123ABCD45"
                className="w-full h-11 rounded-xl border bg-background px-3 text-sm"
              />
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Message to supplier (optional)</label>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                rows={3}
                placeholder="Sent $X from 077… at 14:32. Please confirm."
                className="w-full rounded-xl border bg-background p-3 text-sm"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Send the payment from your EcoCash app, then paste the confirmation reference here. The supplier will verify and mark your order as paid.
              </p>
            </div>
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
            {placing ? <><CircleSpinner size={16} className="mr-1" /> Placing…</> : <>Pay {fmt(total)} <ArrowRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PayOption({
  active, onClick, icon: Icon, label, sub, insufficient,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Wallet;
  label: string;
  sub: string;
  insufficient?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition flex items-start gap-2 ${
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-background hover:border-primary/40"
      }`}
    >
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-black tracking-tight truncate">{label}</span>
        <span className={`block text-[10px] truncate ${insufficient ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {insufficient ? "Not enough balance" : sub}
        </span>
      </span>
    </button>
  );
}
