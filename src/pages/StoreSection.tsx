import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, TrendingUp, Eye, ShoppingBag, DollarSign, Star, Megaphone, Truck, Package, Settings, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProducts, fetchMySupplier, fetchCategories } from "@/data/products";
import EmptyState from "@/components/EmptyState";

const titles: Record<string, { title: string; sub: string }> = {
  products: { title: "My products", sub: "Manage your catalog" },
  orders: { title: "Store orders", sub: "Fulfill and track" },
  shipping: { title: "Shipping & logistics", sub: "Templates and carriers" },
  promote: { title: "Promotions", sub: "Coupons, deals, ads" },
  analytics: { title: "Analytics", sub: "Traffic, conversion, revenue" },
  reviews: { title: "Customer reviews", sub: "What buyers are saying" },
  profile: { title: "Store profile", sub: "Banner, logo, about" },
  settings: { title: "Store settings", sub: "Payouts, taxes, hours" },
  "products/new": { title: "Add new product", sub: "List something new" },
};

export default function StoreSection() {
  const { section = "products", sub } = useParams();
  const key = sub ? `${section}/${sub}` : section;
  const meta = titles[key] || { title: "Store", sub: "" };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/store" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base leading-tight truncate">{meta.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{meta.sub}</p>
        </div>
      </header>

      {key === "products" && <ProductsView />}
      {key === "products/new" && <NewProductView />}
      {key === "orders" && <OrdersView />}
      {key === "analytics" && <AnalyticsView />}
      {key === "promote" && <PromoteView />}
      {key === "reviews" && <ReviewsView />}
      {key === "shipping" && <ShippingView />}
      {key === "profile" && <ProfileView />}
      {key === "settings" && <SettingsView />}
    </div>
  );
}

// ---------------- Products list ----------------
function ProductsView() {
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["my-products", supplier?.id],
    queryFn: () => (supplier ? fetchProducts({ supplierId: supplier.id }) : Promise.resolve([])),
    enabled: !!supplier,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="px-4 py-4 space-y-3">
      <Button asChild className="w-full h-11">
        <Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add product</Link>
      </Button>
      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-7 h-7 text-muted-foreground" />}
          title="No products yet"
          description="Add your first product so buyers can find your store."
          action={<Button asChild><Link to="/store/products/new"><Plus className="w-4 h-4 mr-1.5" /> Add product</Link></Button>}
        />
      ) : (
        products.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="bg-card border rounded-2xl shadow-card p-3 flex gap-3">
            <img src={p.image} alt={p.title} className="w-20 h-20 rounded-xl object-cover bg-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold line-clamp-2">{p.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">${p.price} · MOQ {p.moq}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {p.sold}</span>
                <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {p.rating.toFixed(1)}</span>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

// ---------------- New product ----------------
function NewProductView() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", price: "", original_price: "",
    moq: "1", unit: "piece", lead_time: "7-15 days", ship_from: "",
    category_slug: "electronics", free_shipping: false,
  });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, 6);
    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
  };
  const removeAt = (i: number) => {
    setFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.price) { toast.error("Title and price required"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const supplier = await fetchMySupplier();
      if (!supplier) { toast.error("Create your store first"); navigate("/become-supplier"); return; }

      // Upload images
      const urls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, {
          cacheControl: "3600", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(publicUrl);
      }

      const { data: product, error } = await supabase.from("products").insert({
        supplier_id: supplier.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image: urls[0] ?? null,
        gallery: urls,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        moq: Number(form.moq) || 1,
        unit: form.unit || "piece",
        lead_time: form.lead_time || null,
        ship_from: form.ship_from || supplier.country || null,
        category_slug: form.category_slug,
        free_shipping: form.free_shipping,
        active: true,
      }).select().single();
      if (error) throw error;

      toast.success("Product published 🎉");
      qc.invalidateQueries({ queryKey: ["my-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate(`/product/${product.id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="px-4 py-4 space-y-4">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {previews.length === 0 ? (
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full aspect-video rounded-2xl border-2 border-dashed bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="w-8 h-8" />
          <p className="text-sm font-bold">Upload product photos</p>
          <p className="text-[11px]">JPG/PNG · up to 6 images · 10MB each</p>
        </button>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeAt(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {previews.length < 6 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product title *" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price *" type="number" step="0.01" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
        <input value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="Original price" type="number" step="0.01" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} placeholder="MOQ" type="number" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
        <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (piece, set, kg…)" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={form.lead_time} onChange={(e) => setForm({ ...form, lead_time: e.target.value })} placeholder="Lead time" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
        <input value={form.ship_from} onChange={(e) => setForm({ ...form, ship_from: e.target.value })} placeholder="Ships from" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      </div>
      <select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="w-full h-12 rounded-xl border bg-background px-4 text-sm">
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.free_shipping} onChange={(e) => setForm({ ...form, free_shipping: e.target.checked })} />
        Free shipping
      </label>
      <Button type="submit" disabled={submitting} className="w-full h-12">
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing…</> : "Publish product"}
      </Button>
    </form>
  );
}

// ---------------- Orders (real with status updates) ----------------
const ORDER_STATUSES = ["placed", "processing", "shipped", "delivered", "cancelled"] as const;
const STATUS_TONE: Record<string, string> = {
  placed: "bg-amber-500/15 text-amber-600",
  processing: "bg-sky-500/15 text-sky-600",
  shipped: "bg-violet-500/15 text-violet-600",
  delivered: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-destructive/15 text-destructive",
};

function OrdersView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["store-orders", supplier?.id],
    queryFn: async () => {
      if (!supplier) return [];
      const { data } = await supabase.from("orders").select("*, order_items(*)")
        .eq("supplier_id", supplier.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!supplier,
  });

  const updateStatus = async (orderId: string, buyerId: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as any, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      user_id: buyerId,
      title: "Order update",
      body: `Your order is now ${status}`,
      type: "order",
      link: "/orders",
    });
    toast.success(`Order marked ${status}`);
    qc.invalidateQueries({ queryKey: ["store-orders"] });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;
  if (!orders.length) {
    return <EmptyState icon={<ShoppingBag className="w-7 h-7 text-muted-foreground" />} title="No orders yet" description="When buyers purchase your products they'll appear here." />;
  }

  return (
    <div className="px-4 py-4 space-y-3">
      {orders.map((o: any) => {
        const idx = ORDER_STATUSES.indexOf(o.status);
        const next = idx >= 0 && idx < 3 ? ORDER_STATUSES[idx + 1] : null;
        return (
          <div key={o.id} className="bg-card border rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold truncate">{o.ref_code}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_TONE[o.status] || "bg-muted"}`}>{o.status}</span>
            </div>
            <p className="text-sm font-semibold mt-2">{o.order_items?.length ?? 0} items · ${Number(o.total).toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
            {o.ship_to && <p className="text-[11px] text-muted-foreground mt-1">Ship to: {o.ship_to}</p>}
            <div className="flex gap-2 mt-3">
              {next && (
                <Button size="sm" className="flex-1 h-9" onClick={() => updateStatus(o.id, o.buyer_id, next)}>
                  Mark {next}
                </Button>
              )}
              {o.status !== "cancelled" && o.status !== "delivered" && (
                <Button size="sm" variant="outline" className="h-9" onClick={() => updateStatus(o.id, o.buyer_id, "cancelled")}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Analytics (real) ----------------
function AnalyticsView() {
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data, isLoading } = useQuery({
    queryKey: ["store-analytics", supplier?.id],
    queryFn: async () => {
      if (!supplier) return null;
      const [{ data: orders }, { data: products }, { count: followerCount }] = await Promise.all([
        supabase.from("orders").select("total,status,created_at").eq("supplier_id", supplier.id),
        supabase.from("products").select("id,sold,rating,review_count").eq("supplier_id", supplier.id),
        supabase.from("followers").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id),
      ]);
      const ordersList = orders ?? [];
      const productsList = products ?? [];
      const revenue = ordersList.reduce((s, o) => s + Number(o.total || 0), 0);
      const completed = ordersList.filter((o) => o.status === "delivered").length;
      const cancelled = ordersList.filter((o) => o.status === "cancelled").length;
      const totalSold = productsList.reduce((s, p) => s + (p.sold || 0), 0);
      // Last 7 days revenue
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const last7 = ordersList.filter((o) => new Date(o.created_at).getTime() >= cutoff)
        .reduce((s, o) => s + Number(o.total || 0), 0);
      return {
        revenue, completed, cancelled, totalSold, last7,
        orderCount: ordersList.length,
        productCount: productsList.length,
        followers: followerCount ?? 0,
      };
    },
    enabled: !!supplier,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;
  if (!data) return <EmptyState title="Create a store first" description="Set up your supplier store to see analytics." />;

  const cards = [
    { label: "Total revenue", value: `$${data.revenue.toFixed(2)}`, icon: DollarSign },
    { label: "Last 7 days", value: `$${data.last7.toFixed(2)}`, icon: TrendingUp },
    { label: "Orders", value: String(data.orderCount), icon: ShoppingBag },
    { label: "Delivered", value: String(data.completed), icon: Package },
    { label: "Cancelled", value: String(data.cancelled), icon: X },
    { label: "Units sold", value: String(data.totalSold), icon: TrendingUp },
    { label: "Products", value: String(data.productCount), icon: Package },
    { label: "Followers", value: String(data.followers), icon: Eye },
  ];

  return (
    <div className="px-4 py-4 grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border rounded-2xl shadow-card p-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <c.icon className="w-4 h-4" />
            </span>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{c.label}</p>
          </div>
          <p className="text-xl font-bold mt-1.5 truncate">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------- Coupons (real CRUD) ----------------
type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_subtotal: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
};

function PromoteView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["my-coupons", supplier?.id],
    queryFn: async () => {
      if (!supplier) return [];
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("supplier_id", supplier.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Coupon[];
    },
    enabled: !!supplier,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: "",
    min_subtotal: "0",
    max_uses: "",
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!supplier) return;
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      toast.error("Code must be 3-30 chars (A-Z, 0-9, _, -)");
      return;
    }
    const value = Number(form.discount_value);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Enter a valid discount value"); return; }
    if (form.discount_type === "percent" && value > 100) { toast.error("Percent must be ≤100"); return; }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      supplier_id: supplier.id,
      code,
      discount_type: form.discount_type,
      discount_value: value,
      min_subtotal: Number(form.min_subtotal) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Coupon ${code} created`);
    setForm({ code: "", discount_type: "percent", discount_value: "", min_subtotal: "0", max_uses: "", expires_at: "" });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ["my-coupons"] });
  };

  const toggle = async (c: Coupon) => {
    const { error } = await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-coupons"] });
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Coupon deleted");
    qc.invalidateQueries({ queryKey: ["my-coupons"] });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="px-4 py-4 space-y-3">
      <Button onClick={() => setShowForm(!showForm)} className="w-full h-11">
        <Plus className="w-4 h-4 mr-2" /> {showForm ? "Cancel" : "New coupon"}
      </Button>

      {showForm && (
        <div className="bg-card rounded-2xl border shadow-card p-4 space-y-3">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 30) })}
            placeholder="Code (e.g. WELCOME10)"
            className="w-full h-11 rounded-xl border bg-background px-4 text-sm font-mono uppercase tracking-wider"
            maxLength={30}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
              className="h-11 rounded-xl border bg-background px-3 text-sm"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount</option>
            </select>
            <input
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              placeholder={form.discount_type === "percent" ? "e.g. 10 (%)" : "e.g. 5 ($)"}
              type="number"
              step="0.01"
              className="h-11 rounded-xl border bg-background px-4 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.min_subtotal}
              onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
              placeholder="Min subtotal ($)"
              type="number"
              step="0.01"
              className="h-11 rounded-xl border bg-background px-4 text-sm"
            />
            <input
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              placeholder="Max uses (optional)"
              type="number"
              className="h-11 rounded-xl border bg-background px-4 text-sm"
            />
          </div>
          <input
            value={form.expires_at}
            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            type="datetime-local"
            placeholder="Expires (optional)"
            className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
          />
          <Button onClick={create} disabled={saving} className="w-full h-11">
            {saving ? "Creating…" : "Create coupon"}
          </Button>
        </div>
      )}

      {coupons.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-7 h-7 text-muted-foreground" />}
          title="No coupons yet"
          description="Create your first discount code to attract more buyers."
        />
      ) : (
        coupons.map((c) => {
          const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
          const exhausted = c.max_uses !== null && c.uses_count >= c.max_uses;
          return (
            <div key={c.id} className="bg-card rounded-2xl border shadow-card p-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm font-mono uppercase tracking-wider">{c.code}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {c.discount_type === "percent" ? `${c.discount_value}% off` : `$${c.discount_value} off`}
                    {Number(c.min_subtotal) > 0 && ` · min $${c.min_subtotal}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Used {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ""}
                    {c.expires_at && ` · expires ${new Date(c.expires_at).toLocaleDateString()}`}
                  </p>
                  {(expired || exhausted || !c.active) && (
                    <p className="text-[10px] font-bold text-destructive mt-0.5">
                      {expired ? "Expired" : exhausted ? "Exhausted" : "Inactive"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => toggle(c)}>
                  {c.active ? "Pause" : "Activate"}
                </Button>
                <Button size="sm" variant="outline" className="h-9 text-destructive" onClick={() => remove(c)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}


// ---------------- Reviews (real) ----------------
function ReviewsView() {
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["store-reviews", supplier?.id],
    queryFn: async () => {
      if (!supplier) return [];
      const { data: prods } = await supabase.from("products").select("id,title,image").eq("supplier_id", supplier.id);
      const ids = (prods ?? []).map((p) => p.id);
      if (!ids.length) return [];
      const { data: rs } = await supabase
        .from("reviews")
        .select("*")
        .in("product_id", ids)
        .order("created_at", { ascending: false });
      const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));
      return (rs ?? []).map((r: any) => ({ ...r, product: prodMap.get(r.product_id) }));
    },
    enabled: !!supplier,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;
  if (!reviews.length) {
    return <EmptyState icon={<Star className="w-7 h-7 text-muted-foreground" />} title="No reviews yet" description="Buyer reviews will appear here once your products are reviewed." />;
  }
  return (
    <div className="px-4 py-4 space-y-3">
      {reviews.map((r: any) => (
        <div key={r.id} className="bg-card border rounded-2xl shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            {r.product?.image && <img src={r.product.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-muted" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{r.product?.title}</p>
              <div className="flex items-center gap-0.5 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
          </div>
          {r.text && <p className="text-sm">{r.text}</p>}
        </div>
      ))}
    </div>
  );
}
function ShippingView() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[
        { name: "Standard", time: "7-15 days", cost: "$4.99", carriers: "DHL, UPS" },
        { name: "Express", time: "3-5 days", cost: "$14.99", carriers: "FedEx" },
      ].map((s) => (
        <div key={s.name} className="bg-card rounded-2xl border shadow-card p-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Truck className="w-5 h-5" /></span>
            <div className="flex-1"><p className="font-bold text-sm">{s.name}</p><p className="text-[11px] text-muted-foreground">{s.time} · {s.carriers}</p></div>
            <p className="font-bold text-sm">{s.cost}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function ProfileView() {
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", country: "", about: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (supplier) setForm({ name: supplier.name, country: supplier.country, about: supplier.about });
  }, [supplier]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    setSaving(true);
    const { error } = await supabase.from("suppliers").update({
      name: form.name, country: form.country, about: form.about,
    }).eq("id", supplier.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-supplier"] }); }
  };
  return (
    <form onSubmit={save} className="px-4 py-4 space-y-4">
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Store name" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="About your store" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />
      <Button type="submit" disabled={saving} className="w-full h-12">{saving ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}
function SettingsView() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[
        { icon: DollarSign, label: "Payouts", hint: "Coming in Phase 2" },
        { icon: Package, label: "Tax & invoicing", hint: "Coming in Phase 2" },
        { icon: Settings, label: "Store hours", hint: "Coming in Phase 2" },
      ].map((s) => (
        <div key={s.label} className="bg-card rounded-2xl border shadow-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><s.icon className="w-5 h-5" /></span>
          <div className="flex-1"><p className="font-bold text-sm">{s.label}</p><p className="text-[11px] text-muted-foreground">{s.hint}</p></div>
        </div>
      ))}
    </div>
  );
}
