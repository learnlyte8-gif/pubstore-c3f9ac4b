import { useEffect, useMemo, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, MapPin, Tag, X, CheckCircle2, Wallet, Smartphone, CreditCard, Banknote, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { useVerification } from "@/hooks/useVerification";

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

type PayMethod = "wallet" | "paynow" | "ecocash" | "onemoney" | "paypal" | "cod";

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
  const [phone, setPhone] = useState("");

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

  // After Paynow web redirect, finalise via paynow-status
  useEffect(() => {
    const ref = searchParams.get("paynow_ref");
    const pollUrl = searchParams.get("paynow_poll");
    if (!ref || !pollUrl) return;
    (async () => {
      try {
        const { data, error } = await sb.functions.invoke("paynow-status", {
          body: { reference: ref, pollUrl: decodeURIComponent(pollUrl) },
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
        toast.error("Could not verify Paynow payment");
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete("paynow_ref");
        next.delete("paynow_poll");
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
      const ship = afterDiscount > 25 ? 0 : 4.99;
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
    if ((payMethod === "ecocash" || payMethod === "onemoney") && phone.replace(/\D/g, "").length < 9) {
      toast.error("Enter your mobile money number");
      return;
    }
    if (payMethod === "cod" && !isVerified) {
      toast.error("Verification required for Cash on delivery", {
        description: "Upload your ID and proof of residency to unlock COD.",
        action: { label: "Verify now", onClick: () => navigate("/verification") },
      });
      return;
    }

    setPlacing(true);
    try {
      // Wallet & COD: orders go straight to "placed" / appropriate status.
      if (payMethod === "wallet" || payMethod === "cod") {
        const created = await createOrders(user.id, payMethod === "wallet" ? "placed" : "placed");
        if (payMethod === "wallet") {
          for (const o of created) {
            await payOrder(o.id);
          }
        }
        await clearCart();
        toast.success(payMethod === "cod" ? "Order placed · Pay on delivery" : "Order placed");
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

      if (payMethod === "paynow") {
        const origin = window.location.origin;
        const { data, error } = await sb.functions.invoke("paynow-create-payment", {
          body: {
            purpose: "order",
            flow: "web",
            orderIds,
            returnUrl: `${origin}/cart`, // we'll re-poll on return
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        await clearCart();
        // tack the reference + pollUrl onto the return URL so we can confirm
        const back = new URL(`${origin}/cart`);
        back.searchParams.set("paynow_ref", data.reference);
        back.searchParams.set("paynow_poll", encodeURIComponent(data.pollUrl));
        // browserurl from Paynow already has its own returnurl, so we hop there now.
        // After Paynow the user will land on whatever returnurl the server set.
        window.location.href = data.redirectUrl;
        return;
      }

      // EcoCash / OneMoney express
      if (payMethod === "ecocash" || payMethod === "onemoney") {
        const { data, error } = await sb.functions.invoke("paynow-create-payment", {
          body: {
            purpose: "order",
            flow: "express",
            method: payMethod,
            phone,
            orderIds,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        await clearCart();
        toast.success("Check your phone", {
          description: data.instructions || "Approve the prompt to complete payment.",
        });
        navigate(`/orders`);
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
    <div className="pb-40">
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
            active={payMethod === "ecocash"}
            onClick={() => setPayMethod("ecocash")}
            icon={Smartphone}
            label="EcoCash"
            sub="Mobile prompt"
          />
          <PayOption
            active={payMethod === "onemoney"}
            onClick={() => setPayMethod("onemoney")}
            icon={Smartphone}
            label="OneMoney"
            sub="Mobile prompt"
          />
          <PayOption
            active={payMethod === "paynow"}
            onClick={() => setPayMethod("paynow")}
            icon={CreditCard}
            label="Paynow Web"
            sub="Visa / ZIPIT"
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

        {(payMethod === "ecocash" || payMethod === "onemoney") && (
          <div className="mt-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {payMethod === "ecocash" ? "EcoCash" : "OneMoney"} number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0771234567"
              className="mt-1 w-full h-11 rounded-xl border bg-background px-3 text-sm tabular-nums"
              inputMode="tel"
            />
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
