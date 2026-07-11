import { useEffect, useRef, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ServiceActionsTab from "@/components/marketplace/ServiceActionsTab";
import { ArrowLeft, Plus, TrendingUp, Eye, ShoppingBag, DollarSign, Star, Megaphone, Truck, Package, Settings, Image as ImageIcon, X, Loader2, Link2, Download, Sparkles, Percent, Check, Pencil, Trash2, CheckSquare, Square, Tag, EyeOff, Handshake, Search, MapPin, Weight, Route, BadgeCheck } from "lucide-react";
import { courierToRate, quoteCourierRate, summarizeRate, type WeightTier, type DistanceDiscount } from "@/lib/courierRates";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProducts, fetchMySupplier, fetchCategories } from "@/data/products";
import EmptyState from "@/components/EmptyState";
import LocationPicker from "@/components/LocationPicker";
import { useImportJob, type BulkCandidate, type ImportedProduct, type MarkupMode } from "@/store/importJob";
import ImageUpload from "@/components/ImageUpload";
import { uploadProductImages } from "@/lib/uploadProductImages";
import AddAdDialog from "@/components/store/AddAdDialog";
import { VERTICALS } from "@/data/verticalsCatalog";
import { importProductFromUrl } from "@/lib/importProduct";
import { importStayFromUrl, type ImportedStay } from "@/lib/importStay";


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
  "product-edit": { title: "Edit product", sub: "Update details, price, photos" },
  import: { title: "Import from the web", sub: "Alibaba, Amazon, Shopify URLs" },
  "services/stays": { title: "My stays", sub: "Rooms, hotels, factory tours" },
  "services/vehicles": { title: "My vehicles", sub: "Cars, EVs, trucks, bikes" },
  "services/industrial": { title: "My industrial listings", sub: "Machinery, materials, capacity" },
  "services/news": { title: "News & editorial", sub: "Publish articles" },
  "services/driver": { title: "Ride driver", sub: "Register your car for ride-hailing only" },
  "services/pros": { title: "Service provider", sub: "List your skills as a local pro" },
  "services/properties": { title: "My properties", sub: "Real estate listings" },
  "services/logistics": { title: "Courier / logistics", sub: "Register as a courier · partner with suppliers" },
  "services/finance": { title: "Finance products", sub: "Loans, insurance, financing" },
  "services/car-rentals": { title: "Car rentals", sub: "Self-drive listings, rules & penalties" },
  "services/agro": { title: "Agro listings", sub: "Produce, machinery, inputs, livestock, projects" },
};

export default function StoreSection() {
  const { section = "products", sub } = useParams();
  const [params, setParams] = useSearchParams();
  const key = sub ? `${section}/${sub}` : section;
  const meta = titles[key] || { title: "Store", sub: "" };
  const isService = section === "services" && !!sub;
  const tab = params.get("tab") === "actions" ? "actions" : "manage";
  const serviceKey = sub as
    | "stays" | "vehicles" | "industrial" | "news" | "driver" | "pros"
    | "properties" | "logistics" | "finance" | "car-rentals" | "agro" | undefined;
  const supportsActions = isService && serviceKey && serviceKey !== "news";

  return (
    <div className="">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/store" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base leading-tight truncate">{meta.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{meta.sub}</p>
        </div>
      </header>

      {supportsActions && (
        <div className="px-3 pt-2 flex gap-1 bg-background sticky top-[57px] z-10 border-b">
          <TabBtn active={tab === "manage"} onClick={() => { params.delete("tab"); setParams(params, { replace: true }); }}>Manage</TabBtn>
          <TabBtn active={tab === "actions"} onClick={() => { params.set("tab", "actions"); setParams(params, { replace: true }); }}>Actions inbox</TabBtn>
        </div>
      )}

      {supportsActions && tab === "actions" ? (
        <ServiceActionsTab section={serviceKey as any} />
      ) : (
        <>
          {key === "products" && <ProductsView />}
          {key === "products/new" && <NewProductView />}
          {section === "product-edit" && sub && <EditProductView productId={sub} />}
          {key === "orders" && <OrdersView />}
          {key === "analytics" && <AnalyticsView />}
          {key === "promote" && <PromoteView />}
          {key === "reviews" && <ReviewsView />}
          {key === "shipping" && <ShippingView />}
          {key === "profile" && <ProfileView />}
          {key === "settings" && <SettingsView />}
          {key === "import" && <ImportView />}
          {key === "services/stays" && <StaysServiceView />}
          {key === "services/vehicles" && <VehiclesServiceView />}
          {key === "services/industrial" && <IndustrialServiceView />}
          {key === "services/news" && <NewsServiceView />}
          {key === "services/driver" && <DriverServiceView />}
          {key === "services/pros" && <ProServiceView />}
          {key === "services/properties" && <PropertyServiceView />}
          {key === "services/logistics" && <CourierServiceView />}
          {key === "services/finance" && <FinanceServiceView />}
          {key === "services/car-rentals" && <CarRentalServiceView />}
          {key === "services/agro" && <AgroServiceView />}
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-10 text-xs font-bold border-b-2 transition ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
    >{children}</button>
  );
}

// ---------------- Import from URL (private beta) ----------------
const ALLOWED_IMPORT_EMAILS = ["kukistacks8@gmail.com"];

// Types ImportedProduct, BulkCandidate, MarkupMode are imported from "@/store/importJob".

function applyMarkup(price: number | null, mode: MarkupMode, value: number): number | null {
  if (price == null || isNaN(price)) return price;
  if (mode === "none" || !value) return Math.round(price * 100) / 100;
  const v = Number(value) || 0;
  const out = mode === "percent" ? price * (1 + v / 100) : price + v;
  return Math.round(out * 100) / 100;
}

// Mirror up to 6 remote images into our storage so they stay available.
async function mirrorImages(userId: string, urls: string[], slug: string) {
  const stored: string[] = [];
  for (let i = 0; i < Math.min(urls.length, 6); i++) {
    const src = urls[i];
    try {
      const r = await fetch(src);
      if (!r.ok) { stored.push(src); continue; }
      const blob = await r.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
      const path = `${userId}/imported-${slug}-${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: blob.type });
      if (upErr) { stored.push(src); continue; }
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
      stored.push(publicUrl);
    } catch {
      stored.push(src);
    }
  }
  return stored;
}

function ImportView() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk" | "aliexpress" | "stays">("single");

  // markup (shared by both modes)
  const [markupMode, setMarkupMode] = useState<MarkupMode>("percent");
  const [markupValue, setMarkupValue] = useState<string>("30");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/auth"); return; }
      setEmail((user.email || "").toLowerCase());
    });
  }, [navigate]);

  const allowed = !!email && ALLOWED_IMPORT_EMAILS.includes(email);

  if (email === null) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;

  if (!allowed) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<Sparkles className="w-7 h-7 text-muted-foreground" />}
          title="Private beta"
          description="Auto-import from Alibaba, Amazon and Shopify stores is currently limited to invited suppliers."
          action={<Button variant="outline" asChild><Link to="/store">Back to store</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Mode toggle */}
      <div className="flex bg-muted rounded-full p-1 overflow-x-auto">
        {(["single", "bulk", "aliexpress", "stays"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 min-w-[80px] h-9 rounded-full text-xs font-bold transition whitespace-nowrap px-3 ${mode === m ? "bg-background shadow-card" : "text-muted-foreground"}`}
          >
            {m === "single" ? "Single URL" : m === "bulk" ? "Bulk import" : m === "aliexpress" ? "AliExpress" : "Stays (Airbnb)"}
          </button>
        ))}
      </div>

      {/* Markup controls — shared (aliexpress uses fixed 4x multiplier) */}
      {mode !== "aliexpress" && (
        <div className="rounded-2xl border bg-card p-3 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Percent className="w-3.5 h-3.5" />
            </span>
            <p className="text-sm font-bold">Auto markup</p>
            <p className="text-[11px] text-muted-foreground">applied to every imported price</p>
          </div>
          <div className="flex gap-2">
            <select
              value={markupMode}
              onChange={(e) => setMarkupMode(e.target.value as MarkupMode)}
              className="h-10 rounded-xl border bg-background px-2 text-xs font-semibold"
            >
              <option value="percent">+ %</option>
              <option value="flat">+ flat</option>
              <option value="none">No markup</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={markupValue}
              disabled={markupMode === "none"}
              onChange={(e) => setMarkupValue(e.target.value)}
              className="flex-1 h-10 rounded-xl border bg-background px-3 text-sm disabled:opacity-50"
              placeholder={markupMode === "percent" ? "30" : "5.00"}
            />
          </div>
        </div>
      )}

      {mode === "single" ? (
        <SingleImport markupMode={markupMode} markupValue={Number(markupValue) || 0} qc={qc} navigate={navigate} />
      ) : mode === "bulk" ? (
        <BulkImport markupMode={markupMode} markupValue={Number(markupValue) || 0} qc={qc} />
      ) : (
        <AliExpressImport qc={qc} />
      )}
    </div>
  );
}

// ---------------- Single URL import ----------------
function SingleImport({ markupMode, markupValue, qc, navigate }: { markupMode: MarkupMode; markupValue: number; qc: ReturnType<typeof useQueryClient>; navigate: ReturnType<typeof useNavigate> }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ImportedProduct | null>(null);
  const { data: categories = [] } = useQuery({
    queryKey: ["import-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name,slug").order("sort_order", { ascending: true });
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  const fetchProduct = async () => {
    if (!url.trim()) { toast.error("Paste a product URL"); return; }
    setLoading(true); setPreview(null);
    try {
      const p = await importProductFromUrl(url.trim());
      // Pre-apply markup to the price shown in the preview.
      setPreview({ ...p, price: applyMarkup(p.price, markupMode, markupValue), original_price: p.price });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not import that URL");
    } finally { setLoading(false); }
  };

  const updatePreview = (patch: Partial<ImportedProduct>) => setPreview((p) => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!preview) return;
    if (!preview.title.trim()) { toast.error("Title required"); return; }
    if (preview.price == null || isNaN(preview.price)) { toast.error("Price required"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const supplier = await fetchMySupplier();
      if (!supplier) { toast.error("Create your store first"); navigate("/become-supplier"); return; }

      const stored = await mirrorImages(user.id, preview.images, "single");
      const { data: product, error } = await supabase.from("products").insert({
        supplier_id: supplier.id,
        title: preview.title.trim(),
        description: preview.description || null,
        image: stored[0] ?? null,
        gallery: stored,
        price: Number(preview.price),
        original_price: preview.original_price ?? null,
        moq: preview.moq ?? 1,
        unit: preview.unit ?? "piece",
        category_slug: preview.category_slug ?? null,
        ship_from: supplier.country ?? null,
        active: true,
        source: preview.source ?? null,
        source_url: preview.source_url ?? null,
        source_id: preview.source_id ?? null,
      }).select().single();
      if (error) throw error;

      toast.success("Product imported 🎉");
      qc.invalidateQueries({ queryKey: ["my-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate(`/product/${product.id}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to import");
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <p className="font-bold text-sm leading-tight">Paste a product link</p>
            <p className="text-[11px] text-muted-foreground">Alibaba · AliExpress · Amazon · any Shopify store</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link2 className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.alibaba.com/product-detail/…"
              className="w-full h-12 rounded-xl border bg-background pl-9 pr-3 text-sm"
              onKeyDown={(e) => e.key === "Enter" && fetchProduct()}
            />
          </div>
          <Button onClick={fetchProduct} disabled={loading} className="h-12 px-4">
            {loading ? <CircleSpinner size={16} /> : <Download className="w-4 h-4" />}
            <span className="ml-1.5 hidden sm:inline">Fetch</span>
          </Button>
        </div>
      </div>

      {loading && !preview && (
        <div className="rounded-2xl border bg-card p-8 flex flex-col items-center gap-2 text-muted-foreground">
          <CircleSpinner size={24} />
          <p className="text-xs">Reading that page…</p>
        </div>
      )}

      {preview && (
        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          {preview.images.length > 0 && (
            <div className="flex gap-1 overflow-x-auto p-2 bg-muted/30">
              {preview.images.slice(0, 6).map((src, i) => (
                <img key={i} src={src} alt="" className="w-24 h-24 rounded-lg object-cover bg-muted flex-shrink-0" />
              ))}
            </div>
          )}
          <div className="p-4 space-y-3">
            <LabeledInput label="Title" value={preview.title} onChange={(v) => updatePreview({ title: v })} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label={`Price${preview.currency ? ` (${preview.currency})` : ""}`} type="number" value={preview.price ?? ""} onChange={(v) => updatePreview({ price: v === "" ? null : Number(v) })} />
              <LabeledInput label="Original" type="number" value={preview.original_price ?? ""} onChange={(v) => updatePreview({ original_price: v === "" ? null : Number(v) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="MOQ" type="number" value={preview.moq ?? 1} onChange={(v) => updatePreview({ moq: Number(v) || 1 })} />
              <LabeledInput label="Unit" value={preview.unit ?? "piece"} onChange={(v) => updatePreview({ unit: v })} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                Category
                {preview.category_slug && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary normal-case tracking-normal">AI suggested</span>
                )}
              </label>
              <select
                value={preview.category_slug ?? ""}
                onChange={(e) => updatePreview({ category_slug: e.target.value || null })}
                className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
              <textarea
                value={preview.description}
                onChange={(e) => updatePreview({ description: e.target.value })}
                rows={5}
                className="w-full rounded-xl border bg-background p-3 text-sm mt-1"
              />
            </div>
            <p className="text-[10px] text-muted-foreground break-all">
              Source: <span className="font-semibold capitalize">{preview.source}</span> · {preview.source_url}
            </p>
            <Button onClick={save} disabled={saving} className="w-full h-12">
              {saving ? <><CircleSpinner size={16} className="mr-2" /> Importing…</> : <><Plus className="w-4 h-4 mr-2" /> Import to my store</>}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------- Bulk import ----------------
function BulkImport({ markupMode, markupValue, qc }: { markupMode: MarkupMode; markupValue: number; qc: ReturnType<typeof useQueryClient> }) {
  const job = useImportJob();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const { data: categories = [] } = useQuery({
    queryKey: ["import-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name,slug").order("sort_order", { ascending: true });
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  const items = job.state.items;
  const running = job.state.running;
  const progress = { done: job.state.done, total: job.state.total };
  const runState: "idle" | "running" | "done" = running
    ? "running"
    : job.state.finishedAt
    ? "done"
    : "idle";

  const listAll = async () => {
    if (!url.trim()) { toast.error("Paste a collection / seller URL"); return; }
    if (running) { toast.error("Wait for the current import to finish"); return; }
    setLoading(true);
    job.setItems([]);
    try {
      const { data, error } = await supabase.functions.invoke("import-list", { body: { url: url.trim(), limit: 40 } });
      if (error) throw error;
      if ((data as any)?.error && !((data as any)?.items?.length)) throw new Error((data as any).error);
      const raw = ((data as any)?.items || []) as Array<Omit<BulkCandidate, "status">>;
      job.setItems(raw.map((r) => ({ ...r, status: "pending" as const })));
      if (raw.length === 0) toast.error("No products found on that page");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not list products");
    } finally { setLoading(false); }
  };

  const updateItem = (idx: number, patch: Partial<BulkCandidate>) => job.updateItem(idx, patch);

  const toggleSkip = (idx: number) =>
    updateItem(idx, { status: items[idx].status === "skipped" ? "pending" : "skipped" });

  const importAll = async () => {
    let label = "Bulk import";
    try { label = new URL(url).hostname; } catch {}
    await job.start({
      items,
      markupMode,
      markupValue,
      sourceLabel: label,
      onProductSaved: () => {
        qc.invalidateQueries({ queryKey: ["my-products"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      },
    });
  };

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <>
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Download className="w-4 h-4" />
          </span>
          <div>
            <p className="font-bold text-sm leading-tight">Paste a collection or seller page</p>
            <p className="text-[11px] text-muted-foreground">Shopify /collections/… · Alibaba seller page · AliExpress store</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link2 className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourstore.com/collections/all"
              className="w-full h-12 rounded-xl border bg-background pl-9 pr-3 text-sm"
              onKeyDown={(e) => e.key === "Enter" && listAll()}
              disabled={running}
            />
          </div>
          <Button onClick={listAll} disabled={loading || running} className="h-12 px-4">
            {loading ? <CircleSpinner size={16} /> : <Download className="w-4 h-4" />}
            <span className="ml-1.5 hidden sm:inline">List</span>
          </Button>
        </div>
      </div>

      {loading && items.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 flex flex-col items-center gap-2 text-muted-foreground">
          <CircleSpinner size={24} />
          <p className="text-xs">Scanning catalog…</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* progress + action bar */}
          <div className="rounded-2xl border bg-card p-3 shadow-card sticky top-[56px] z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold">
                {running
                  ? `Importing ${progress.done}/${progress.total}…`
                  : runState === "done"
                  ? `Done · ${doneCount} imported${errorCount ? `, ${errorCount} errored` : ""}`
                  : `${pendingCount} selected of ${items.length}`}
              </p>
              <Button size="sm" onClick={importAll} disabled={running || pendingCount === 0} className="h-8">
                {running ? <CircleSpinner size={14} /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                {running ? "Running" : `Import ${pendingCount}`}
              </Button>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {items.map((it, idx) => {
            const expanded = editingIdx === idx;
            return (
              <div key={idx} className={`rounded-2xl border bg-card p-3 shadow-card ${it.status === "skipped" ? "opacity-50" : ""}`}>
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                    {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground m-auto mt-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {it.price != null ? (
                        <>Base {it.price} · <span className="font-semibold text-foreground">sells at {applyMarkup(it.price, markupMode, markupValue)}</span></>
                      ) : (
                        "Price fetched on import"
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{it.url}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <BulkStatus status={it.status} />
                    {!running && it.status !== "done" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingIdx(expanded ? null : idx)}
                          className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center"
                          aria-label="Edit"
                        >
                          {expanded ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => toggleSkip(idx)}
                          className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center"
                          aria-label="Skip"
                        >
                          {it.status === "skipped" ? <Plus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                    {it.status === "done" && it.productId && (
                      <Link to={`/product/${it.productId}`} className="text-[10px] font-bold text-primary">View</Link>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 pt-3 border-t space-y-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Title</label>
                      <input
                        value={it.title}
                        onChange={(e) => updateItem(idx, { title: e.target.value })}
                        className="w-full h-10 rounded-lg border bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Base price</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={it.price ?? ""}
                          onChange={(e) => updateItem(idx, { price: e.target.value === "" ? null : Number(e.target.value) })}
                          className="h-10 rounded-lg border bg-background px-3 text-sm w-32"
                          placeholder="0.00"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          → sells at <span className="font-bold text-foreground">{applyMarkup(it.price, markupMode, markupValue) ?? "—"}</span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Category</label>
                      <select
                        value={it.category_slug ?? ""}
                        onChange={(e) => updateItem(idx, { category_slug: e.target.value || null })}
                        className="w-full h-10 rounded-lg border bg-background px-2 text-sm"
                      >
                        <option value="">Uncategorized (auto-detect on import)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Spacer so the floating import banner + bottom nav don't cover the last edit panel */}
          <div className="h-32" aria-hidden />
        </>
      )}
    </>
  );
}

function BulkStatus({ status }: { status: BulkCandidate["status"] }) {
  const map: Record<BulkCandidate["status"], { label: string; cls: string }> = {
    pending: { label: "Queued", cls: "bg-muted text-muted-foreground" },
    importing: { label: "…", cls: "bg-primary/15 text-primary" },
    done: { label: "Done", cls: "bg-primary text-primary-foreground" },
    skipped: { label: "Skip", cls: "bg-muted text-muted-foreground line-through" },
    error: { label: "Error", cls: "bg-destructive text-destructive-foreground" },
  };
  const m = map[status];
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${m.cls}`}>{m.label}</span>;
}

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1"
      />
    </div>
  );
}


// ---------------- AliExpress category search (omkar.cloud) ----------------
type AliItem = {
  id: string;
  title: string;
  image: string | null;
  price: number | null;
  original_price: number | null;
  currency: string | null;
  rating: number | null;
  orders_count: number | null;
  url: string | null;
};

const ALI_PRICE_MULTIPLIER = 4;

function AliExpressImport({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AliItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });

  const { data: categories = [] } = useQuery({
    queryKey: ["import-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name,slug").order("sort_order", { ascending: true });
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  const runSearch = async (nextPage = 1) => {
    const q = query.trim();
    if (!q) { toast.error("Pick a category or type a query"); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again.");
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omkar-aliexpress-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query: q, page: nextPage }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Search failed (${r.status})`);
      const list = (j?.items ?? []) as AliItem[];
      setItems(list);
      setPage(j?.page ?? nextPage);
      setSelected(new Set(list.map((x) => x.id)));
      if (list.length === 0) toast.error("No products found");
    } catch (err: any) {
      toast.error(err?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => setSelected(new Set(items.map((x) => x.id)));
  const clearAll = () => setSelected(new Set());

  const importSelected = async () => {
    const chosen = items.filter((it) => selected.has(it.id));
    if (chosen.length === 0) { toast.error("Select at least one product"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in"); return; }
    const supplier = await fetchMySupplier();
    if (!supplier) { toast.error("Create your store first"); return; }

    setImporting(true);
    setProgress({ done: 0, total: chosen.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < chosen.length; i++) {
      const it = chosen[i];
      try {
        const basePrice = it.price ?? 0;
        const finalPrice = Math.round(basePrice * ALI_PRICE_MULTIPLIER * 100) / 100;
        const stored = it.image ? await mirrorImages(user.id, [it.image], `ali-${it.id}`) : [];
        const { error: insErr } = await supabase.from("products").insert({
          supplier_id: supplier.id,
          title: it.title.slice(0, 200),
          description: `Imported from AliExpress · ${it.url ?? ""}`.trim(),
          image: stored[0] ?? it.image ?? null,
          gallery: stored.length ? stored : (it.image ? [it.image] : []),
          price: finalPrice,
          original_price: basePrice || null,
          moq: 1,
          unit: "piece",
          category_slug: categorySlug || null,
          ship_from: supplier.country ?? null,
          active: finalPrice > 0,
          source: "aliexpress",
          source_url: it.url ?? null,
          source_id: it.id ?? null,
        });
        if (insErr) throw insErr;
      } catch (err) {
        console.error("ali import err", err);
        errors++;
      }
      setProgress({ done: i + 1, total: chosen.length, errors });
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ["my-products"] });
    toast.success(`Imported ${chosen.length - errors}/${chosen.length} products${errors ? ` (${errors} failed)` : ""}`);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-3 shadow-card space-y-2">
        <p className="text-sm font-bold">Search AliExpress by category</p>
        <p className="text-[11px] text-muted-foreground">
          Prices are automatically multiplied by <b>{ALI_PRICE_MULTIPLIER}×</b> when importing so you keep a healthy margin.
        </p>
        <select
          value={categorySlug}
          onChange={(e) => {
            const slug = e.target.value;
            setCategorySlug(slug);
            const cat = categories.find((c) => c.slug === slug);
            if (cat) setQuery(cat.name);
          }}
          className="w-full h-10 rounded-xl border bg-background px-2 text-xs font-semibold"
        >
          <option value="">— Pick a category —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. wireless earbuds"
            className="flex-1 h-10 rounded-xl border bg-background px-3 text-sm"
          />
          <Button onClick={() => runSearch(1)} disabled={loading || importing} className="h-10">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1 text-xs">Search</span>
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-muted-foreground">
              {selected.size} / {items.length} selected · page {page}
            </p>
            <div className="flex gap-1">
              <button onClick={selectAll} className="text-[11px] font-bold text-primary px-2 py-1">All</button>
              <button onClick={clearAll} className="text-[11px] font-bold text-muted-foreground px-2 py-1">None</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {items.map((it) => {
              const isSel = selected.has(it.id);
              const markedUp = it.price != null ? (it.price * ALI_PRICE_MULTIPLIER).toFixed(2) : null;
              return (
                <button
                  key={it.id}
                  onClick={() => toggle(it.id)}
                  className={`text-left rounded-2xl border overflow-hidden bg-card transition ${isSel ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                >
                  <div className="aspect-square bg-muted relative">
                    {it.image ? (
                      <img src={it.image} alt={it.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : null}
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${isSel ? "bg-primary text-primary-foreground" : "bg-background/80 border"}`}>
                      {isSel ? <Check className="w-3 h-3" /> : null}
                    </div>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <p className="text-[11px] leading-tight line-clamp-2 font-semibold">{it.title}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] text-muted-foreground line-through">
                        {it.price != null ? `$${it.price.toFixed(2)}` : "—"}
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {markedUp ? `$${markedUp}` : ""}
                      </span>
                    </div>
                    {it.orders_count != null || it.rating != null ? (
                      <p className="text-[10px] text-muted-foreground">
                        {it.rating != null ? `★ ${it.rating}` : ""}{it.rating != null && it.orders_count != null ? " · " : ""}{it.orders_count != null ? `${it.orders_count} sold` : ""}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" disabled={loading || page <= 1} onClick={() => runSearch(page - 1)}>Prev</Button>
            <Button variant="outline" className="flex-1 h-11" disabled={loading} onClick={() => runSearch(page + 1)}>Next</Button>
          </div>

          <div className="sticky bottom-2 z-10">
            <Button
              className="w-full h-12 shadow-card"
              disabled={importing || selected.size === 0}
              onClick={importSelected}
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing {progress.done}/{progress.total}…</>
                : <><Download className="w-4 h-4 mr-2" /> Import {selected.size} product{selected.size === 1 ? "" : "s"} (×{ALI_PRICE_MULTIPLIER} price)</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}





// ---------------- Products list ----------------
function ProductsView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["my-products", supplier?.id],
    queryFn: () => (supplier ? fetchProducts({ supplierId: supplier.id }) : Promise.resolve([])),
    enabled: !!supplier,
  });
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [working, setWorking] = useState(false);
  const [adOpen, setAdOpen] = useState(false);


  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allSelected = products.length > 0 && selected.size === products.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const bulkAssignCategory = async (slug: string) => {
    if (selected.size === 0) return;
    setWorking(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("products").update({ category_slug: slug }).in("id", ids);
    setWorking(false);
    setShowCatPicker(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Updated ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    refresh();
    exitSelect();
  };

  const bulkToggleActive = async (active: boolean) => {
    if (selected.size === 0) return;
    setWorking(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("products").update({ active }).in("id", ids);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${active ? "Activated" : "Hidden"} ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    refresh();
    exitSelect();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} product${selected.size > 1 ? "s" : ""}? This can't be undone.`)) return;
    setWorking(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("products").delete().in("id", ids);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted ${ids.length} product${ids.length > 1 ? "s" : ""}`);
    refresh();
    exitSelect();
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;

  return (
    <div className="px-4 py-4 space-y-3 ">
      <AddAdDialog open={adOpen} onOpenChange={setAdOpen} />
      {!selectMode ? (
        <div className="flex gap-2">
          <Button asChild className="flex-1 h-11">
            <Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add product</Link>
          </Button>
          {products.length > 0 && (
            <Button
              variant="outline"
              className="h-11 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setAdOpen(true)}
              title="Create AI ad"
            >
              <Sparkles className="w-4 h-4 mr-1.5" /> Add ad
            </Button>
          )}
          {products.length > 0 && (
            <Button variant="outline" className="h-11" onClick={() => setSelectMode(true)}>
              <CheckSquare className="w-4 h-4 mr-1.5" /> Select
            </Button>
          )}
        </div>

      ) : (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/30 rounded-xl px-3 h-11">
          <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-bold text-primary">
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </button>
          <button onClick={exitSelect} className="text-xs font-bold text-muted-foreground">Cancel</button>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-7 h-7 text-muted-foreground" />}
          title="No products yet"
          description="Add your first product so buyers can find your store."
          action={<Button asChild><Link to="/store/products/new"><Plus className="w-4 h-4 mr-1.5" /> Add product</Link></Button>}
        />
      ) : (
        products.map((p) => {
          const isSel = selected.has(p.id);
          return (
            <div
              key={p.id}
              className={`bg-card border rounded-2xl shadow-card p-3 flex gap-3 transition ${isSel ? "ring-2 ring-primary border-primary" : ""}`}
              onClick={selectMode ? () => toggle(p.id) : undefined}
              role={selectMode ? "button" : undefined}
            >
              {selectMode && (
                <div className="self-center">
                  {isSel ? (
                    <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-md border-2 border-muted-foreground/40" />
                  )}
                </div>
              )}
              {selectMode ? (
                <img src={p.image} alt={p.title} className="w-20 h-20 rounded-xl object-cover bg-muted shrink-0" />
              ) : (
                <Link to={`/product/${p.id}`} className="shrink-0">
                  <img src={p.image} alt={p.title} className="w-20 h-20 rounded-xl object-cover bg-muted" />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                {selectMode ? (
                  <div>
                    <p className="text-sm font-bold line-clamp-2">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">${p.price} · MOQ {p.moq}</p>
                    {p.category_slug && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">in {p.category_slug}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <Link to={`/product/${p.id}`} className="block">
                      <p className="text-sm font-bold line-clamp-2">{p.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">${p.price} · MOQ {p.moq}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {p.sold}</span>
                        <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {p.rating.toFixed(1)}</span>
                      </div>
                    </Link>
                    <div className="flex gap-2 mt-2">
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                        <Link to={`/store/product-edit/${p.id}`}><Pencil className="w-3 h-3 mr-1" /> Edit</Link>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30 bg-card border shadow-elevated rounded-2xl p-2 flex gap-2 max-w-md mx-auto">
          <Button variant="outline" className="flex-1 h-11" onClick={() => setShowCatPicker(true)} disabled={working}>
            <Tag className="w-4 h-4 mr-1.5" /> Category
          </Button>
          <Button variant="outline" className="flex-1 h-11" onClick={() => bulkToggleActive(false)} disabled={working}>
            <EyeOff className="w-4 h-4 mr-1.5" /> Hide
          </Button>
          <Button variant="outline" className="flex-1 h-11" onClick={() => bulkToggleActive(true)} disabled={working}>
            <Eye className="w-4 h-4 mr-1.5" /> Show
          </Button>
          <Button variant="outline" className="h-11 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={bulkDelete} disabled={working}>
            {working ? <CircleSpinner size={16} /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Category picker sheet */}
      {showCatPicker && (
        <div className="fixed inset-0 z-50 bg-foreground/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCatPicker(false)}>
          <div className="w-full max-w-md bg-card rounded-3xl p-5 shadow-elevated max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </span>
              <div>
                <p className="font-bold">Assign category</p>
                <p className="text-[11px] text-muted-foreground">{selected.size} product{selected.size > 1 ? "s" : ""} selected</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cats.map((c: any) => {
                const slug = c.slug ?? c.id;
                return (
                  <button
                    key={slug}
                    onClick={() => bulkAssignCategory(slug)}
                    disabled={working}
                    className="h-12 rounded-xl border bg-background hover:bg-primary/10 hover:border-primary text-sm font-bold transition disabled:opacity-50 truncate px-3"
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" className="w-full h-11 mt-4" onClick={() => setShowCatPicker(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Edit product ----------------
function EditProductView({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const { data: product, isLoading } = useQuery({
    queryKey: ["edit-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    title: "", description: "", price: "", original_price: "",
    moq: "1", unit: "piece", lead_time: "", ship_from: "",
    category_slug: "electronics", free_shipping: false, active: true,
    video_url: "",
  });
  const [gallery, setGallery] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!product) return;
    setForm({
      title: product.title ?? "",
      description: product.description ?? "",
      price: String(product.price ?? ""),
      original_price: product.original_price ? String(product.original_price) : "",
      moq: String(product.moq ?? 1),
      unit: product.unit ?? "piece",
      lead_time: product.lead_time ?? "",
      ship_from: product.ship_from ?? "",
      category_slug: product.category_slug ?? "electronics",
      free_shipping: !!product.free_shipping,
      active: product.active !== false,
      video_url: (product as any).video_url ?? "",
    });
    const g: string[] = Array.isArray(product.gallery) ? product.gallery.filter(Boolean) : [];
    if (g.length === 0 && product.image) g.push(product.image);
    setGallery(g);
  }, [product]);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, 6);
    setNewFiles(arr);
    setNewPreviews(arr.map((f) => URL.createObjectURL(f)));
  };
  const removeExisting = (i: number) => setGallery((g) => g.filter((_, idx) => idx !== i));
  const removeNewAt = (i: number) => {
    setNewFiles((p) => p.filter((_, idx) => idx !== i));
    setNewPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.price) { toast.error("Title and price required"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { urls: uploaded, failed } = await uploadProductImages(newFiles, { userId: user.id });
      if (failed.length) {
        toast.error(`${failed.length} photo(s) failed: ${failed.map((f) => f.reason).join(", ")}`);
        if (uploaded.length === 0 && newFiles.length > 0) { setSaving(false); return; }
      }
      const finalGallery = [...gallery, ...uploaded];

      const { error } = await supabase.from("products").update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        image: finalGallery[0] ?? null,
        gallery: finalGallery,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        moq: Number(form.moq) || 1,
        unit: form.unit || "piece",
        lead_time: form.lead_time || null,
        ship_from: form.ship_from || null,
        category_slug: form.category_slug,
        free_shipping: form.free_shipping,
        active: form.active,
        video_url: form.video_url.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", productId);
      if (error) throw error;

      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["my-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["edit-product", productId] });
      navigate("/store/products");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", productId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Product deleted");
    qc.invalidateQueries({ queryKey: ["my-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    navigate("/store/products");
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
  if (!product) return <EmptyState title="Product not found" description="It may have been deleted." />;

  return (
    <form onSubmit={submit} className="px-4 py-4 space-y-4">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Photos</p>
        <div className="grid grid-cols-3 gap-2">
          {gallery.map((src, i) => (
            <div key={`g-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeExisting(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {newPreviews.map((src, i) => (
            <div key={`n-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-muted ring-2 ring-primary">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeNewAt(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {gallery.length + newPreviews.length < 8 && (
            <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground">
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            placeholder="Paste image URL (https://…)"
            className="flex-1 h-10 rounded-xl border bg-background px-3 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              const u = imageUrlInput.trim();
              if (!/^https?:\/\//i.test(u)) { toast.error("Enter a valid https:// image URL"); return; }
              if (gallery.includes(u)) { toast("Already added"); return; }
              setGallery((g) => [...g, u]);
              setImageUrlInput("");
            }}
          >
            <Link2 className="w-4 h-4 mr-1" /> Add URL
          </Button>
        </div>
      </div>

      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product title *" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />
      <input
        value={form.video_url}
        onChange={(e) => setForm({ ...form, video_url: e.target.value })}
        placeholder="Video URL (MP4/WebM or YouTube/Vimeo link)"
        className="w-full h-12 rounded-xl border bg-background px-4 text-sm"
      />
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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Listed (visible to buyers)
      </label>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 h-12">
          {saving ? <><CircleSpinner size={16} className="mr-2" /> Saving…</> : "Save changes"}
        </Button>
        <Button type="button" variant="outline" disabled={deleting} onClick={handleDelete} className="h-12 text-destructive border-destructive/30 hover:bg-destructive/10">
          {deleting ? <CircleSpinner size={16} /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
}

// ---------------- New product ----------------
function NewProductView() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [urlImages, setUrlImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", price: "", original_price: "",
    moq: "1", unit: "piece", lead_time: "7-15 days", ship_from: "",
    category_slug: "electronics", free_shipping: false,
    video_url: "",
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

      // Upload images (parallel, validated, partial-success aware)
      const { urls, failed } = await uploadProductImages(files, { userId: user.id });
      if (failed.length) {
        toast.error(`${failed.length} photo(s) failed: ${failed.map((f) => f.reason).join(", ")}`);
        if (urls.length === 0 && files.length > 0 && urlImages.length === 0) { setSubmitting(false); return; }
      }
      const finalGallery = [...urls, ...urlImages];

      const { data: product, error } = await supabase.from("products").insert({
        supplier_id: supplier.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image: finalGallery[0] ?? null,
        gallery: finalGallery,
        video_url: form.video_url.trim() || null,
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
      {previews.length === 0 && urlImages.length === 0 ? (
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full aspect-video rounded-2xl border-2 border-dashed bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="w-8 h-8" />
          <p className="text-sm font-bold">Upload product photos</p>
          <p className="text-[11px]">JPG/PNG · up to 6 images · 10MB each — or paste image URLs below</p>
        </button>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={`f-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeAt(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {urlImages.map((src, i) => (
              <div key={`u-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-muted ring-1 ring-border">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setUrlImages((p) => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {previews.length + urlImages.length < 8 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed bg-muted/40 flex items-center justify-center text-muted-foreground">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={imageUrlInput}
          onChange={(e) => setImageUrlInput(e.target.value)}
          placeholder="Paste image URL (https://…)"
          className="flex-1 h-10 rounded-xl border bg-background px-3 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => {
            const u = imageUrlInput.trim();
            if (!/^https?:\/\//i.test(u)) { toast.error("Enter a valid https:// image URL"); return; }
            if (urlImages.includes(u)) { toast("Already added"); return; }
            setUrlImages((p) => [...p, u]);
            setImageUrlInput("");
          }}
        >
          <Link2 className="w-4 h-4 mr-1" /> Add URL
        </Button>
      </div>

      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product title *" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />
      <input
        value={form.video_url}
        onChange={(e) => setForm({ ...form, video_url: e.target.value })}
        placeholder="Video URL (MP4/WebM or YouTube/Vimeo link)"
        className="w-full h-12 rounded-xl border bg-background px-4 text-sm"
      />
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
        {submitting ? <><CircleSpinner size={16} className="mr-2" /> Publishing…</> : "Publish product"}
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

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
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

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
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

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;

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

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
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
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);

  // Is the supplier also a courier? If so we'll surface self-delivery as default.
  const { data: myCourier } = useQuery({
    queryKey: ["my-courier-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("courier_profiles" as any).select("*").eq("user_id", userId!).maybeSingle();
      return data as any;
    },
  });

  // Existing partnerships for this supplier with the courier profile joined in.
  const { data: partnerships = [] } = useQuery({
    queryKey: ["shipping-partnerships", supplier?.id],
    enabled: !!supplier?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_courier_partnerships" as any)
        .select("*")
        .eq("supplier_id", supplier!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as any[];
      const courierIds = rows.map((r) => r.courier_user_id);
      if (courierIds.length === 0) return rows;
      const { data: profiles } = await supabase
        .from("courier_profiles" as any)
        .select("*")
        .in("user_id", courierIds);
      const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, courier: map.get(r.courier_user_id) ?? null }));
    },
  });

  // Discover couriers open to partnerships, excluding ones already partnered.
  const { data: discover = [] } = useQuery({
    queryKey: ["shipping-discover", supplier?.id, search],
    enabled: !!supplier?.id,
    queryFn: async () => {
      let q = supabase
        .from("courier_profiles" as any)
        .select("*")
        .eq("active", true)
        .eq("offers_supplier_partnerships", true)
        .order("rating", { ascending: false })
        .limit(20);
      if (search.trim()) q = q.or(`company_name.ilike.%${search}%,display_name.ilike.%${search}%,city.ilike.%${search}%`);
      const { data } = await q;
      const taken = new Set(partnerships.map((p: any) => p.courier_user_id));
      return ((data ?? []) as any[]).filter((c) => !taken.has(c.user_id) && c.user_id !== userId);
    },
  });

  const invite = async (courierUserId: string) => {
    if (!supplier?.id) return;
    const { error } = await supabase.from("supplier_courier_partnerships" as any).insert({
      supplier_id: supplier.id,
      courier_user_id: courierUserId,
      initiated_by: "supplier",
      message: "We'd like to partner with you for our deliveries.",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Partnership request sent");
    qc.invalidateQueries({ queryKey: ["shipping-partnerships"] });
    qc.invalidateQueries({ queryKey: ["shipping-discover"] });
  };

  const setDefault = async (id: string) => {
    if (!supplier?.id) return;
    // Clear any existing default first (partial unique index would block otherwise).
    await supabase.from("supplier_courier_partnerships" as any)
      .update({ is_default: false })
      .eq("supplier_id", supplier.id)
      .eq("is_default", true);
    const { error } = await supabase.from("supplier_courier_partnerships" as any)
      .update({ is_default: true })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Default shipping updated"); qc.invalidateQueries({ queryKey: ["shipping-partnerships"] }); }
  };

  const respond = async (id: string, status: "active" | "declined") => {
    const { error } = await supabase.from("supplier_courier_partnerships" as any).update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(status === "active" ? "Partnership accepted" : "Declined"); qc.invalidateQueries({ queryKey: ["shipping-partnerships"] }); }
  };

  const removePartnership = async (id: string) => {
    if (!confirm("Remove this courier partnership?")) return;
    const { error } = await supabase.from("supplier_courier_partnerships" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["shipping-partnerships"] }); qc.invalidateQueries({ queryKey: ["shipping-discover"] }); }
  };

  if (!supplier) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Create your store first to manage shipping.</div>;
  }

  const hasDefault = partnerships.some((p: any) => p.is_default && p.status === "active");

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Self-delivery banner — if supplier also provides courier services */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><Truck className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm flex items-center gap-1.5">
              Self-delivery
              {myCourier && !hasDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">DEFAULT</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {myCourier
                ? "You also provide logistics — buyers see you as the default delivery option."
                : "Also offer courier services? Register and we'll set you as the default shipping option for your store."}
            </p>
          </div>
          <Link to="/store/services/logistics" className="px-3 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 shrink-0">
            {myCourier ? "Edit rates" : "Set up"}
          </Link>
        </div>
        {myCourier && (
          <p className="text-[11px] text-muted-foreground mt-2 pl-14">{summarizeRate(courierToRate(myCourier))}</p>
        )}
      </div>

      {/* My partnerships */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">My courier partnerships</p>
          <span className="text-[10px] text-muted-foreground">{partnerships.length} total</span>
        </div>
        {partnerships.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-5 text-center">
            <Handshake className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-bold">No partnerships yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">Invite a courier below — buyers will see the active options at checkout.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {partnerships.map((p: any) => {
              const c = p.courier;
              const rate = c ? courierToRate(c) : null;
              return (
                <div key={p.id} className="bg-card border rounded-2xl p-3 shadow-card">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                      {c?.vehicle_photo && <img src={c.vehicle_photo} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate flex items-center gap-1.5">
                        {c?.company_name || c?.display_name || "Courier"}
                        {p.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">DEFAULT</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize truncate">
                        {c?.vehicle_type?.replace("_", " ") ?? "—"} {c?.max_weight_kg ? `· up to ${c.max_weight_kg}kg` : ""} {c?.city ? `· ${c.city}` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full font-bold capitalize ${
                          p.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : p.status === "pending" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : p.status === "paused" ? "bg-muted text-muted-foreground"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                        }`}>{p.status}</span>
                        {rate && <span className="text-muted-foreground truncate">{summarizeRate(rate)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {p.status === "pending" && p.initiated_by === "courier" && (
                      <>
                        <button onClick={() => respond(p.id, "active")} className="flex-1 h-9 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Accept request
                        </button>
                        <button onClick={() => respond(p.id, "declined")} className="h-9 px-3 rounded-full border text-xs font-bold">
                          Decline
                        </button>
                      </>
                    )}
                    {p.status === "pending" && p.initiated_by === "supplier" && (
                      <span className="flex-1 h-9 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center">
                        Waiting for courier to accept
                      </span>
                    )}
                    {p.status === "active" && !p.is_default && (
                      <button onClick={() => setDefault(p.id)} className="flex-1 h-9 rounded-full border text-xs font-bold flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Set as default
                      </button>
                    )}
                    {p.is_default && (
                      <span className="flex-1 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" /> Default at checkout
                      </span>
                    )}
                    <button onClick={() => removePartnership(p.id)} className="w-9 h-9 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Discover couriers */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Discover couriers</p>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or city"
            className="w-full h-11 pl-9 pr-3 rounded-xl border bg-background text-sm"
          />
        </div>
        {discover.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-5 text-center text-xs text-muted-foreground">
            No couriers match. Try a different search or invite couriers to join PUBSTORE.
          </div>
        ) : (
          <div className="space-y-2">
            {discover.map((c: any) => {
              const rate = courierToRate(c);
              return (
                <div key={c.id} className="bg-card border rounded-2xl p-3 shadow-card flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
                    {c.vehicle_photo && <img src={c.vehicle_photo} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{c.company_name || c.display_name || "Courier"}</p>
                    <p className="text-[11px] text-muted-foreground capitalize truncate">
                      {c.vehicle_type?.replace("_", " ")} {c.max_weight_kg ? `· up to ${c.max_weight_kg}kg` : ""} {c.city ? `· ${c.city}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{summarizeRate(rate)}</p>
                    <div className="flex items-center gap-2 text-[11px] mt-1">
                      <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{Number(c.rating ?? 5).toFixed(1)}</span>
                      <span className="text-muted-foreground">{c.deliveries_completed ?? 0} deliveries</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => invite(c.user_id)} className="h-9 self-start text-[11px] shrink-0">
                    <Handshake className="w-3.5 h-3.5 mr-1" /> Invite
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
function ProfileView() {
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", country: "", about: "", logo: "", banner: "",
    latitude: null as number | null, longitude: null as number | null, locationAddress: "",
    businessType: "", phone: "", email: "", website: "",
    tradeType: "both" as "retail" | "wholesale" | "both",
    categories: [] as string[],
    verticals: [] as string[],
    manualPayEnabled: false,
    manualPayNumber: "",
    manualPayName: "",
    manualPayInstructions: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const { data: cats = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  useEffect(() => {
    if (supplier) setForm({
      name: supplier.name,
      country: supplier.country,
      about: supplier.about,
      logo: supplier.logo || "",
      banner: supplier.banner || "",
      latitude: supplier.latitude,
      longitude: supplier.longitude,
      locationAddress: supplier.locationAddress || "",
      businessType: supplier.businessType || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      website: supplier.website || "",
      tradeType: (supplier.tradeType ?? "both"),
      categories: supplier.categories || [],
      verticals: (supplier as any).verticals || [],
      manualPayEnabled: !!(supplier as any).manual_payment_enabled,
      manualPayNumber: (supplier as any).manual_payment_number || "",
      manualPayName: (supplier as any).manual_payment_name || "",
      manualPayInstructions: (supplier as any).manual_payment_instructions || "",
    });
  }, [supplier]);

  // Load manual payment fields directly (mapSupplier doesn't carry them)
  useEffect(() => {
    if (!supplier) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("suppliers")
        .select("manual_payment_enabled,manual_payment_number,manual_payment_name,manual_payment_instructions")
        .eq("id", supplier.id)
        .maybeSingle();
      if (data) setForm((f) => ({
        ...f,
        manualPayEnabled: !!data.manual_payment_enabled,
        manualPayNumber: data.manual_payment_number || "",
        manualPayName: data.manual_payment_name || "",
        manualPayInstructions: data.manual_payment_instructions || "",
      }));
    })();
  }, [supplier?.id]);

  const uploadImage = async (file: File, kind: "logo" | "banner") => {
    if (!supplier) return;
    setUploading(kind);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/store/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, [kind]: data.publicUrl }));
      const updatePayload = kind === "logo" ? { logo: data.publicUrl } : { banner: data.publicUrl };
      const { error: updErr } = await supabase.from("suppliers").update(updatePayload).eq("id", supplier.id);
      if (updErr) throw updErr;
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
      qc.invalidateQueries({ queryKey: ["supplier", supplier.id] });
      toast.success(`${kind === "logo" ? "Logo" : "Banner"} updated`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handlePin = async (next: { lat: number; lng: number; address: string }) => {
    if (!supplier) return;
    setForm((f) => ({ ...f, latitude: next.lat, longitude: next.lng, locationAddress: next.address }));
    const { error } = await supabase.from("suppliers").update({
      latitude: next.lat, longitude: next.lng, location_address: next.address,
    }).eq("id", supplier.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Location pinned");
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
      qc.invalidateQueries({ queryKey: ["supplier", supplier.id] });
    }
  };

  const toggleCategory = (slug: string) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(slug) ? f.categories.filter((c) => c !== slug) : [...f.categories, slug],
    }));
  };

  const toggleVertical = (slug: string) => {
    setForm((f) => ({
      ...f,
      verticals: f.verticals.includes(slug) ? f.verticals.filter((v) => v !== slug) : [...f.verticals, slug],
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    setSaving(true);
    const { error } = await (supabase.from("suppliers") as any).update({
      name: form.name, country: form.country, about: form.about,
      business_type: form.businessType || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      trade_type: form.tradeType || "both",
      categories: form.categories,
      verticals: form.verticals,
      manual_payment_enabled: form.manualPayEnabled,
      manual_payment_number: form.manualPayNumber || null,
      manual_payment_name: form.manualPayName || null,
      manual_payment_instructions: form.manualPayInstructions || null,
    }).eq("id", supplier.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-supplier"] }); }
  };

  return (
    <form onSubmit={save} className="px-4 py-4 space-y-5">
      {/* Banner */}
      <div>
        <p className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Banner</p>
        <button
          type="button"
          onClick={() => bannerRef.current?.click()}
          className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted hover:border-primary transition-colors group"
        >
          {form.banner ? (
            <img src={form.banner} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="w-8 h-8 mb-1" />
              <p className="text-xs font-medium">Tap to upload banner</p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            {uploading === "banner" ? (
              <CircleSpinner size={24} className="text-white" />
            ) : form.banner ? (
              <span className="opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-full bg-white/90 text-foreground text-xs font-bold transition-opacity">Change banner</span>
            ) : null}
          </div>
        </button>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
      </div>

      {/* Logo */}
      <div>
        <p className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Logo</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted hover:border-primary transition-colors flex items-center justify-center shrink-0"
          >
            {form.logo ? (
              <img src={form.logo} alt="Logo" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            )}
            {uploading === "logo" && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <CircleSpinner size={20} className="text-white" />
              </div>
            )}
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold">Store logo</p>
            <p className="text-[11px] text-muted-foreground">Square image, at least 200×200px</p>
            <button type="button" onClick={() => logoRef.current?.click()} className="text-xs font-bold text-primary mt-1">
              {form.logo ? "Replace" : "Upload"}
            </button>
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
      </div>

      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Store name" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
      <textarea value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="About your store" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />

      {/* Location pin */}
      <div>
        <p className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Store location</p>
        <LocationPicker
          lat={form.latitude}
          lng={form.longitude}
          address={form.locationAddress}
          onChange={handlePin}
        />
      </div>

      {/* Business details */}
      <div>
        <p className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Business details</p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {["individual", "company", "factory", "distributor"].map((t) => (
              <button key={t} type="button" onClick={() => setForm({ ...form, businessType: t })}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border capitalize ${form.businessType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                {t}
              </button>
            ))}
          </div>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (e.g. +263…)" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Business email" type="email" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website (optional)" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
        </div>
      </div>

      {/* Manual EcoCash payment */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Manual EcoCash payment</p>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.manualPayEnabled}
              onChange={(e) => setForm({ ...form, manualPayEnabled: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs font-bold">{form.manualPayEnabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
          Let buyers pay you directly via EcoCash and submit the transaction reference for you to confirm.
        </p>
        <div className="space-y-2">
          <input
            value={form.manualPayNumber}
            onChange={(e) => setForm({ ...form, manualPayNumber: e.target.value })}
            placeholder="EcoCash number (e.g. 077 123 4567)"
            className="w-full h-12 rounded-xl border bg-background px-4 text-sm"
            disabled={!form.manualPayEnabled}
          />
          <input
            value={form.manualPayName}
            onChange={(e) => setForm({ ...form, manualPayName: e.target.value })}
            placeholder="Recipient name (as it appears on EcoCash)"
            className="w-full h-12 rounded-xl border bg-background px-4 text-sm"
            disabled={!form.manualPayEnabled}
          />
          <textarea
            value={form.manualPayInstructions}
            onChange={(e) => setForm({ ...form, manualPayInstructions: e.target.value })}
            placeholder="Instructions for buyers (optional). e.g. 'Send the exact total, then paste your EC reference.'"
            rows={3}
            className="w-full rounded-xl border bg-background p-4 text-sm"
            disabled={!form.manualPayEnabled}
          />
        </div>
      </div>


      {/* Trade type */}
      <div>
        <p className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Trade type</p>
        <div className="flex flex-wrap gap-1.5">
          {(["retail", "wholesale", "both"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm({ ...form, tradeType: t })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border capitalize ${form.tradeType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
            >
              {t === "both" ? "Retail & Wholesale" : t}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Products with a minimum order quantity (MOQ) above 1 are auto-tagged as wholesale.
        </p>
      </div>

      {/* Category preferences */}
      <div>
        <p className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">What do you sell? <span className="text-muted-foreground/70 normal-case">({form.categories.length} selected)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const active = form.categories.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleCategory(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Verticals — what services this store provides */}
      <div data-step="verticals">
        <p className="text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wide">
          What do you provide? <span className="text-muted-foreground/70 normal-case">({form.verticals.length} selected)</span>
        </p>
        <p className="text-[11px] text-muted-foreground mb-2">
          Pick the services your store offers — only those will appear in MyStore.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {VERTICALS.filter((v) => v.forSupplier).map((v) => {
            const active = form.verticals.includes(v.slug);
            const Icon = v.icon;
            return (
              <button
                key={v.slug}
                type="button"
                onClick={() => toggleVertical(v.slug)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-bold border transition ${
                  active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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

// =================================================================
// Service / vertical management views
// =================================================================

function ServiceShell({
  title, items, isLoading, emptyHint, onAdd, renderItem,
}: {
  title: string;
  items: any[];
  isLoading: boolean;
  emptyHint: string;
  onAdd: () => void;
  renderItem: (it: any) => React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Button size="sm" onClick={onAdd} className="h-9 rounded-full px-4">
          <Plus className="w-4 h-4 mr-1" /> Add new
        </Button>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-7 h-7 text-muted-foreground" />}
          title="Nothing here yet"
          description={emptyHint}
          action={<Button onClick={onAdd}><Plus className="w-4 h-4 mr-1.5" /> Add your first listing</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2">{items.map(renderItem)}</div>
      )}
    </div>
  );
}

/* ---------------- Stays ---------------- */
function StaysServiceView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-stays", supplier?.id],
    enabled: !!supplier,
    queryFn: async () => {
      const { data } = await supabase.from("stays").select("*").eq("supplier_id", supplier!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this stay?")) return;
    const { error } = await supabase.from("stays").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-stays"] }); }
  };

  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState title="Create your store first" action={<Button asChild><Link to="/become-supplier">Open store</Link></Button>} />
      </div>
    );
  }

  return (
    <>
      <ServiceShell
        title={`${items.length} stays listed`}
        items={items}
        isLoading={isLoading}
        emptyHint="List a B&B, hotel room, factory tour or retreat for buyers visiting your country."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(s) => (
          <div key={s.id} className="bg-card border rounded-2xl shadow-card flex gap-3 p-3">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">
              {s.cover && <img src={s.cover} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{s.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.kind} · {s.city ?? "—"}{s.country ? `, ${s.country}` : ""}</p>
              <p className="text-xs font-bold mt-1">${Number(s.price_per_night).toFixed(0)}<span className="text-[10px] font-normal text-muted-foreground"> / night</span></p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(s); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(s.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && (
        <StayFormDialog
          supplierId={supplier.id}
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-stays"] }); qc.invalidateQueries({ queryKey: ["stays"] }); qc.invalidateQueries({ queryKey: ["home-stays"] }); }}
        />
      )}
    </>
  );
}

function StayFormDialog({ supplierId, initial, onClose, onSaved }: { supplierId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    kind: initial?.kind ?? "b&b",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    cover: initial?.cover ?? "",
    description: initial?.description ?? "",
    price_per_night: initial?.price_per_night ?? 80,
    bedrooms: initial?.bedrooms ?? 1,
    beds: initial?.beds ?? 1,
    baths: initial?.baths ?? 1,
    guests: initial?.guests ?? 2,
    superhost: initial?.superhost ?? false,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const payload = { ...form, supplier_id: supplierId, price_per_night: Number(form.price_per_night) };
    const { error } = initial
      ? await supabase.from("stays").update(payload).eq("id", initial.id)
      : await supabase.from("stays").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Updated" : "Listed 🎉");
    onSaved();
  };
  return (
    <FormSheet onClose={onClose} title={initial ? "Edit stay" : "List a new stay"}>
      <LabeledInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kind</label>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["b&b", "hotel", "apartment", "factory_tour", "retreat"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Price / night ($)" type="number" value={form.price_per_night} onChange={(v) => setForm({ ...form, price_per_night: Number(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <LabeledInput label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
      </div>
      <ImageUpload
        label="Cover photo"
        value={form.cover}
        onChange={(v) => setForm({ ...form, cover: v })}
        folder="stays"
        aspect="aspect-video"
        hint="Show the room, view, or building"
      />
      <div className="grid grid-cols-4 gap-2">
        <LabeledInput label="Bedrooms" type="number" value={form.bedrooms} onChange={(v) => setForm({ ...form, bedrooms: Number(v) || 1 })} />
        <LabeledInput label="Beds" type="number" value={form.beds} onChange={(v) => setForm({ ...form, beds: Number(v) || 1 })} />
        <LabeledInput label="Baths" type="number" value={form.baths} onChange={(v) => setForm({ ...form, baths: Number(v) || 1 })} />
        <LabeledInput label="Guests" type="number" value={form.guests} onChange={(v) => setForm({ ...form, guests: Number(v) || 1 })} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.superhost} onChange={(e) => setForm({ ...form, superhost: e.target.checked })} className="w-4 h-4" />
        Superhost badge
      </label>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : initial ? "Save changes" : "Publish stay"}</Button>
    </FormSheet>
  );
}

/* ---------------- Vehicles ---------------- */
function VehiclesServiceView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-vehicles", supplier?.id],
    enabled: !!supplier,
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("*").eq("supplier_id", supplier!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this vehicle?")) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-vehicles"] }); }
  };
  if (!supplier) return <div className="p-6"><EmptyState title="Create your store first" action={<Button asChild><Link to="/become-supplier">Open store</Link></Button>} /></div>;

  return (
    <>
      <ServiceShell
        title={`${items.length} vehicles listed`}
        items={items}
        isLoading={isLoading}
        emptyHint="Sell or showcase vehicles, EVs, fleet trucks, motorbikes or parts."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(v) => (
          <div key={v.id} className="bg-card border rounded-2xl shadow-card flex gap-3 p-3">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">{v.cover && <img src={v.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{v.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{v.kind} · {v.year ?? ""} {v.make ?? ""} {v.model ?? ""}</p>
              <p className="text-xs font-bold mt-1">${Number(v.price).toLocaleString()}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(v); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(v.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && (
        <VehicleFormDialog
          supplierId={supplier.id} initial={editing} onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-vehicles"] }); qc.invalidateQueries({ queryKey: ["vehicles"] }); }}
        />
      )}
    </>
  );
}

function VehicleFormDialog({ supplierId, initial, onClose, onSaved }: { supplierId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    kind: initial?.kind ?? "car",
    condition: initial?.condition ?? "used",
    make: initial?.make ?? "",
    model: initial?.model ?? "",
    year: initial?.year ?? new Date().getFullYear(),
    fuel: initial?.fuel ?? "petrol",
    transmission: initial?.transmission ?? "automatic",
    mileage_km: initial?.mileage_km ?? 0,
    price: initial?.price ?? 0,
    cover: initial?.cover ?? "",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    description: initial?.description ?? "",
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const payload: any = { ...form, supplier_id: supplierId, price: Number(form.price), year: Number(form.year), mileage_km: Number(form.mileage_km) };
    const { error } = initial
      ? await supabase.from("vehicles").update(payload).eq("id", initial.id)
      : await supabase.from("vehicles").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Updated" : "Listed 🎉");
    onSaved();
  };
  return (
    <FormSheet onClose={onClose} title={initial ? "Edit vehicle" : "List a vehicle"}>
      <LabeledInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kind</label>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["car","ev","truck","bike","parts"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Condition</label>
          <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["new","used","certified"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Year" type="number" value={form.year} onChange={(v) => setForm({ ...form, year: Number(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
        <LabeledInput label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fuel</label>
          <select value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["petrol","diesel","hybrid","electric","lpg"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trans.</label>
          <select value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["automatic","manual","cvt","dct"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Mileage km" type="number" value={form.mileage_km} onChange={(v) => setForm({ ...form, mileage_km: Number(v) || 0 })} />
      </div>
      <LabeledInput label="Price ($)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) || 0 })} />
      <ImageUpload
        label="Cover photo"
        value={form.cover}
        onChange={(v) => setForm({ ...form, cover: v })}
        folder="vehicles"
        aspect="aspect-video"
        hint="Hero shot of the vehicle"
      />
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <LabeledInput label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : initial ? "Save changes" : "Publish vehicle"}</Button>
    </FormSheet>
  );
}

/* ---------------- Industrial ---------------- */
function IndustrialServiceView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-industrial", supplier?.id],
    enabled: !!supplier,
    queryFn: async () => {
      const { data } = await supabase.from("industrial_listings").select("*").eq("supplier_id", supplier!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("industrial_listings").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-industrial"] }); }
  };
  if (!supplier) return <div className="p-6"><EmptyState title="Create your store first" action={<Button asChild><Link to="/become-supplier">Open store</Link></Button>} /></div>;
  return (
    <>
      <ServiceShell
        title={`${items.length} industrial listings`}
        items={items}
        isLoading={isLoading}
        emptyHint="Showcase machinery, raw materials, OEM capacity or industrial services."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(it) => (
          <div key={it.id} className="bg-card border rounded-2xl shadow-card flex gap-3 p-3">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">{it.cover && <img src={it.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{it.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{it.category}{it.subcategory ? ` · ${it.subcategory}` : ""}</p>
              <p className="text-xs font-bold mt-1">{it.price ? `$${Number(it.price).toLocaleString()}` : "Quote on request"}{it.unit ? ` / ${it.unit}` : ""}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(it); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(it.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && (
        <IndustrialFormDialog
          supplierId={supplier.id} initial={editing} onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-industrial"] }); qc.invalidateQueries({ queryKey: ["industrial"] }); }}
        />
      )}
    </>
  );
}

function IndustrialFormDialog({ supplierId, initial, onClose, onSaved }: { supplierId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    category: initial?.category ?? "machinery",
    subcategory: initial?.subcategory ?? "",
    cover: initial?.cover ?? "",
    description: initial?.description ?? "",
    moq: initial?.moq ?? 1,
    unit: initial?.unit ?? "piece",
    price: initial?.price ?? 0,
    lead_time: initial?.lead_time ?? "",
    capacity: initial?.capacity ?? "",
    ship_from: initial?.ship_from ?? "",
    country: initial?.country ?? "",
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const payload: any = { ...form, supplier_id: supplierId, price: Number(form.price) || null, moq: Number(form.moq) || null };
    const { error } = initial
      ? await supabase.from("industrial_listings").update(payload).eq("id", initial.id)
      : await supabase.from("industrial_listings").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Updated" : "Listed 🎉");
    onSaved();
  };
  return (
    <FormSheet onClose={onClose} title={initial ? "Edit listing" : "New industrial listing"}>
      <LabeledInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["machinery","materials","oem","services","components"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Subcategory" value={form.subcategory} onChange={(v) => setForm({ ...form, subcategory: v })} />
      </div>
      <ImageUpload
        label="Cover photo"
        value={form.cover}
        onChange={(v) => setForm({ ...form, cover: v })}
        folder="industrial"
        aspect="aspect-video"
        hint="Machine, material, or facility shot"
      />
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="MOQ" type="number" value={form.moq} onChange={(v) => setForm({ ...form, moq: Number(v) || 1 })} />
        <LabeledInput label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
        <LabeledInput label="Price ($)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Lead time" value={form.lead_time} onChange={(v) => setForm({ ...form, lead_time: v })} />
        <LabeledInput label="Capacity" value={form.capacity} onChange={(v) => setForm({ ...form, capacity: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Ship from" value={form.ship_from} onChange={(v) => setForm({ ...form, ship_from: v })} />
        <LabeledInput label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : initial ? "Save changes" : "Publish listing"}</Button>
    </FormSheet>
  );
}

/* ---------------- News (admin only) ---------------- */
function NewsServiceView() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setAllowed(!!data || (user.email || "").toLowerCase() === "kukistacks8@gmail.com");
    })();
  }, [navigate]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-news"],
    enabled: allowed === true,
    queryFn: async () => {
      const { data } = await supabase.from("news_articles").select("*").order("published_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("news_articles").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-news"] }); }
  };

  if (allowed === null) return <div className="p-8 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></div>;
  if (!allowed) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<Sparkles className="w-7 h-7 text-muted-foreground" />}
          title="Editorial access required"
          description="Publishing news is reserved for the PUBSTORE editorial team. Reach out to be added as a contributor."
          action={<Button variant="outline" asChild><Link to="/store">Back to store</Link></Button>}
        />
      </div>
    );
  }

  return (
    <>
      <ServiceShell
        title={`${items.length} articles`}
        items={items}
        isLoading={isLoading}
        emptyHint="Publish announcements, supplier features, market reports and editorial pieces."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(a) => (
          <div key={a.id} className="bg-card border rounded-2xl shadow-card flex gap-3 p-3">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">{a.cover && <img src={a.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{a.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{a.category} · {new Date(a.published_at).toLocaleDateString()}</p>
              {a.featured && <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">Featured</span>}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(a); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(a.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && (
        <NewsFormDialog initial={editing} onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-news"] }); qc.invalidateQueries({ queryKey: ["news"] }); }} />
      )}
    </>
  );
}

function NewsFormDialog({ initial, onClose, onSaved }: { initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    dek: initial?.dek ?? "",
    body: initial?.body ?? "",
    cover: initial?.cover ?? "",
    category: initial?.category ?? "marketplace",
    author: initial?.author ?? "PUBSTORE Editorial",
    read_minutes: initial?.read_minutes ?? 3,
    featured: initial?.featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const payload: any = { ...form, slug: form.slug.trim() || slugify(form.title), read_minutes: Number(form.read_minutes) || 3 };
    const { error } = initial
      ? await supabase.from("news_articles").update(payload).eq("id", initial.id)
      : await supabase.from("news_articles").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Updated" : "Published 📰");
    onSaved();
  };
  return (
    <FormSheet onClose={onClose} title={initial ? "Edit article" : "Publish a news article"}>
      <LabeledInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v, slug: form.slug || slugify(v) })} />
      <LabeledInput label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
      <LabeledInput label="Dek (subtitle)" value={form.dek} onChange={(v) => setForm({ ...form, dek: v })} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["marketplace","supplier","trade","industry","trends","editorial"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Author" value={form.author} onChange={(v) => setForm({ ...form, author: v })} />
        <LabeledInput label="Read min" type="number" value={form.read_minutes} onChange={(v) => setForm({ ...form, read_minutes: Number(v) || 3 })} />
      </div>
      <ImageUpload
        label="Cover photo"
        value={form.cover}
        onChange={(v) => setForm({ ...form, cover: v })}
        folder="news"
        aspect="aspect-video"
        hint="Hero image for the article"
      />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Body (markdown)</label>
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className="w-full rounded-xl border bg-background p-3 text-sm mt-1 font-mono" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4" />
        Feature this article on the homepage
      </label>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Publishing…" : initial ? "Save changes" : "Publish article"}</Button>
    </FormSheet>
  );
}

/* ---------------- Driver registration ---------------- */
function DriverServiceView() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-driver-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("driver_profiles").select("*").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    whatsapp: "",
    email: "",
    vehicle_class: "economy",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_year: new Date().getFullYear(),
    vehicle_plate: "",
    vehicle_photo: "",
    plate_photo: "",
    selfie_photo: "",
    license_photo: "",
    bio: "",
    city: "",
    country: "",
    active: true,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setForm({
        display_name: profile.display_name ?? "",
        phone: profile.phone ?? "",
        whatsapp: profile.whatsapp ?? "",
        email: profile.email ?? "",
        vehicle_class: profile.vehicle_class ?? "economy",
        vehicle_make: profile.vehicle_make ?? "",
        vehicle_model: profile.vehicle_model ?? "",
        vehicle_color: profile.vehicle_color ?? "",
        vehicle_year: profile.vehicle_year ?? new Date().getFullYear(),
        vehicle_plate: profile.vehicle_plate ?? "",
        vehicle_photo: profile.vehicle_photo ?? "",
        plate_photo: profile.plate_photo ?? "",
        selfie_photo: profile.selfie_photo ?? "",
        license_photo: profile.license_photo ?? "",
        bio: profile.bio ?? "",
        city: profile.city ?? "",
        country: profile.country ?? "",
        active: profile.active ?? true,
      });
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!userId) return;
    if (!form.vehicle_plate.trim()) { toast.error("Number plate is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    if (!form.vehicle_photo) { toast.error("Add a photo of your vehicle"); return; }
    if (!form.plate_photo) { toast.error("Add a photo of the number plate"); return; }
    setBusy(true);
    const payload = { ...form, user_id: userId, vehicle_year: Number(form.vehicle_year) || null };
    const { error } = profile
      ? await supabase.from("driver_profiles").update(payload).eq("user_id", userId)
      : await supabase.from("driver_profiles").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(profile ? "Driver profile updated" : "You're registered as a PUBSTORE driver 🚗");
    qc.invalidateQueries({ queryKey: ["my-driver-profile"] });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/20 p-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-soft">
            <Truck className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{profile ? "Your driver profile" : "Become a PUBSTORE driver"}</p>
            <p className="text-[11px] text-muted-foreground">
              {profile
                ? `Active · ${profile.trips ?? 0} trips · ★ ${Number(profile.rating ?? 5).toFixed(1)}`
                : "Earn by accepting fair-fare ride requests in your city"}
            </p>
          </div>
          {profile && (
            <Link to="/driver" className="h-9 px-3 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-card">
              Open driver mode
            </Link>
          )}
        </div>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contact</p>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Display name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <LabeledInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
        <LabeledInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <LabeledInput label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Vehicle</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Class</label>
          <select value={form.vehicle_class} onChange={(e) => setForm({ ...form, vehicle_class: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["moto","economy","comfort","xl"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Year" type="number" value={form.vehicle_year} onChange={(v) => setForm({ ...form, vehicle_year: Number(v) || 0 })} />
        <LabeledInput label="Color" value={form.vehicle_color} onChange={(v) => setForm({ ...form, vehicle_color: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Make" value={form.vehicle_make} onChange={(v) => setForm({ ...form, vehicle_make: v })} />
        <LabeledInput label="Model" value={form.vehicle_model} onChange={(v) => setForm({ ...form, vehicle_model: v })} />
      </div>
      <LabeledInput label="Number plate (required)" value={form.vehicle_plate} onChange={(v) => setForm({ ...form, vehicle_plate: v.toUpperCase() })} />

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Photos · required</p>
      <div className="grid grid-cols-2 gap-3">
        <ImageUpload
          label="Vehicle photo"
          value={form.vehicle_photo}
          onChange={(v) => setForm({ ...form, vehicle_photo: v })}
          folder="driver"
          aspect="aspect-square"
          hint="Side profile of the car"
        />
        <ImageUpload
          label="Number plate"
          value={form.plate_photo}
          onChange={(v) => setForm({ ...form, plate_photo: v })}
          folder="driver"
          aspect="aspect-square"
          hint="Clear, readable plate"
        />
        <ImageUpload
          label="Your selfie"
          value={form.selfie_photo}
          onChange={(v) => setForm({ ...form, selfie_photo: v })}
          folder="driver"
          aspect="aspect-square"
          hint="So riders recognize you"
        />
        <ImageUpload
          label="Driver license"
          value={form.license_photo}
          onChange={(v) => setForm({ ...form, license_photo: v })}
          folder="driver"
          aspect="aspect-square"
          hint="For verification only"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Short bio</label>
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" placeholder="A friendly note for riders" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
        Active — show me to riders looking for a driver
      </label>

      <Button onClick={save} disabled={busy} className="w-full h-12">
        {busy ? "Saving…" : profile ? "Save driver profile" : "Register as a driver"}
      </Button>
    </div>
  );
}

/* ---------------- Shared sheet ---------------- */
function FormSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card sm:rounded-3xl rounded-t-3xl shadow-elevated max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
          <p className="font-bold text-base">{title}</p>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Pro / Service provider ---------------- */
function ProServiceView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-pros", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("*").eq("user_id", userId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this provider profile?")) return;
    const { error } = await supabase.from("service_providers").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-pros"] }); }
  };
  if (!userId) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
  return (
    <>
      <ServiceShell
        title={`${items.length} pro profile(s)`}
        items={items}
        isLoading={isLoading}
        emptyHint="List your skills (plumbing, tutoring, design…) so customers can hire you."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(p: any) => (
          <div key={p.id} className="bg-card border rounded-2xl shadow-card p-3 flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">{p.cover && <img src={p.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.display_name}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{p.category} · {p.city ?? "—"}</p>
              {p.hourly_rate && <p className="text-xs font-bold mt-1">${p.hourly_rate}/hr</p>}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(p); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(p.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && <ProFormDialog userId={userId} initial={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-pros"] }); qc.invalidateQueries({ queryKey: ["service-providers"] }); qc.invalidateQueries({ queryKey: ["home-services"] }); }} />}
    </>
  );
}

function ProFormDialog({ userId, initial, onClose, onSaved }: { userId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    display_name: initial?.display_name ?? "",
    category: initial?.category ?? "plumber",
    bio: initial?.bio ?? "",
    hourly_rate: initial?.hourly_rate ?? "",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    cover: initial?.cover ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.display_name.trim()) { toast.error("Add your display name"); return; }
    setSaving(true);
    const payload = {
      user_id: userId,
      display_name: f.display_name.trim(),
      category: f.category,
      bio: f.bio || null,
      hourly_rate: f.hourly_rate ? Number(f.hourly_rate) : null,
      city: f.city || null,
      country: f.country || null,
      phone: f.phone || null,
      whatsapp: f.whatsapp || null,
      cover: f.cover || null,
    };
    const res = initial?.id
      ? await supabase.from("service_providers").update(payload).eq("id", initial.id)
      : await supabase.from("service_providers").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); onSaved();
  };
  return (
    <FormSheet title={initial ? "Edit provider profile" : "New provider profile"} onClose={onClose}>
      <ImageUpload value={f.cover} onChange={(v) => setF({ ...f, cover: v })} label="Cover photo" />
      <LabeledInput label="Display name" value={f.display_name} onChange={(v) => setF({ ...f, display_name: v })} />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
          {["plumber","electrician","mechanic","tutor","tailor","hairdresser","cleaner","painter","tiler","photographer","designer","marketing","other"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bio</label>
        <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Hourly rate ($)" type="number" value={f.hourly_rate} onChange={(v) => setF({ ...f, hourly_rate: v })} />
        <LabeledInput label="City" value={f.city} onChange={(v) => setF({ ...f, city: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
        <LabeledInput label="WhatsApp" value={f.whatsapp} onChange={(v) => setF({ ...f, whatsapp: v })} />
      </div>
      <Button onClick={save} disabled={saving} className="w-full h-11">{saving ? "Saving…" : "Save profile"}</Button>
    </FormSheet>
  );
}

/* ---------------- Properties ---------------- */
function PropertyServiceView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-properties", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("*").eq("owner_user_id", userId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-properties"] }); }
  };
  if (!userId) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
  return (
    <>
      <ServiceShell
        title={`${items.length} properties listed`}
        items={items}
        isLoading={isLoading}
        emptyHint="List apartments, houses, rooms, land or commercial spaces for rent or sale."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(p: any) => (
          <div key={p.id} className="bg-card border rounded-2xl shadow-card p-3 flex gap-3">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">{p.cover && <img src={p.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{p.listing_type} · {p.property_kind} · {p.city ?? "—"}</p>
              <p className="text-xs font-bold mt-1">${Number(p.price).toLocaleString()}{p.listing_type === "rent" ? `/${p.price_period}` : ""}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(p); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(p.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && <PropertyFormDialog userId={userId} initial={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-properties"] }); qc.invalidateQueries({ queryKey: ["properties"] }); qc.invalidateQueries({ queryKey: ["home-properties"] }); }} />}
    </>
  );
}

function PropertyFormDialog({ userId, initial, onClose, onSaved }: { userId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: initial?.title ?? "",
    listing_type: initial?.listing_type ?? "rent",
    property_kind: initial?.property_kind ?? "apartment",
    bedrooms: initial?.bedrooms ?? "",
    baths: initial?.baths ?? "",
    area_sqm: initial?.area_sqm ?? "",
    price: initial?.price ?? "",
    price_period: initial?.price_period ?? "month",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    address: initial?.address ?? "",
    description: initial?.description ?? "",
    cover: initial?.cover ?? "",
    contact_phone: initial?.contact_phone ?? "",
    contact_whatsapp: initial?.contact_whatsapp ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.title.trim() || !f.price) { toast.error("Title and price required"); return; }
    setSaving(true);
    const payload: any = {
      owner_user_id: userId,
      title: f.title.trim(),
      listing_type: f.listing_type,
      property_kind: f.property_kind,
      bedrooms: f.bedrooms ? Number(f.bedrooms) : null,
      baths: f.baths ? Number(f.baths) : null,
      area_sqm: f.area_sqm ? Number(f.area_sqm) : null,
      price: Number(f.price),
      price_period: f.price_period,
      city: f.city || null,
      country: f.country || null,
      address: f.address || null,
      description: f.description || null,
      cover: f.cover || null,
      contact_phone: f.contact_phone || null,
      contact_whatsapp: f.contact_whatsapp || null,
    };
    const res = initial?.id
      ? await supabase.from("properties").update(payload).eq("id", initial.id)
      : await supabase.from("properties").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); onSaved();
  };
  return (
    <FormSheet title={initial ? "Edit property" : "New property"} onClose={onClose}>
      <ImageUpload value={f.cover} onChange={(v) => setF({ ...f, cover: v })} label="Cover photo" />
      <LabeledInput label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Listing</label>
          <select value={f.listing_type} onChange={(e) => setF({ ...f, listing_type: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            <option value="rent">Rent</option><option value="sale">Sale</option><option value="shared">Shared</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</label>
          <select value={f.property_kind} onChange={(e) => setF({ ...f, property_kind: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            <option value="apartment">Apartment</option><option value="house">House</option><option value="room">Room</option><option value="land">Land</option><option value="commercial">Commercial</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Beds" type="number" value={f.bedrooms} onChange={(v) => setF({ ...f, bedrooms: v })} />
        <LabeledInput label="Baths" type="number" value={f.baths} onChange={(v) => setF({ ...f, baths: v })} />
        <LabeledInput label="m²" type="number" value={f.area_sqm} onChange={(v) => setF({ ...f, area_sqm: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Price ($)" type="number" value={f.price} onChange={(v) => setF({ ...f, price: v })} />
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period</label>
          <select value={f.price_period} onChange={(e) => setF({ ...f, price_period: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            <option value="month">/month</option><option value="year">/year</option><option value="total">total</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="City" value={f.city} onChange={(v) => setF({ ...f, city: v })} />
        <LabeledInput label="Country" value={f.country} onChange={(v) => setF({ ...f, country: v })} />
      </div>
      <LabeledInput label="Address" value={f.address} onChange={(v) => setF({ ...f, address: v })} />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Phone" value={f.contact_phone} onChange={(v) => setF({ ...f, contact_phone: v })} />
        <LabeledInput label="WhatsApp" value={f.contact_whatsapp} onChange={(v) => setF({ ...f, contact_whatsapp: v })} />
      </div>
      <Button onClick={save} disabled={saving} className="w-full h-11">{saving ? "Saving…" : "Save property"}</Button>
    </FormSheet>
  );
}

/* ---------------- Courier (logistics driver) ---------------- */
function CourierServiceView() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-courier-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("courier_profiles" as any).select("*").eq("user_id", userId!).maybeSingle();
      return data as any;
    },
  });

  const [form, setForm] = useState({
    display_name: "",
    company_name: "",
    phone: "",
    whatsapp: "",
    email: "",
    vehicle_type: "bike",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_plate: "",
    max_weight_kg: "",
    max_volume_m3: "",
    service_areas: "",
    city: "",
    country: "",
    currency: "USD",
    base_fee: "",
    per_km_fee: "",
    min_fee: "",
    free_delivery_above: "",
    weight_tiers: [] as WeightTier[],
    distance_discounts: [] as DistanceDiscount[],
    rate_notes: "",
    vehicle_photo: "",
    plate_photo: "",
    selfie_photo: "",
    license_photo: "",
    insurance_photo: "",
    bio: "",
    offers_supplier_partnerships: true,
    active: true,
  });
  const [hydrated, setHydrated] = useState(false);
  const [previewDistance, setPreviewDistance] = useState(10);
  const [previewWeight, setPreviewWeight] = useState(5);

  useEffect(() => {
    if (profile && !hydrated) {
      setForm({
        display_name: profile.display_name ?? "",
        company_name: profile.company_name ?? "",
        phone: profile.phone ?? "",
        whatsapp: profile.whatsapp ?? "",
        email: profile.email ?? "",
        vehicle_type: profile.vehicle_type ?? "bike",
        vehicle_make: profile.vehicle_make ?? "",
        vehicle_model: profile.vehicle_model ?? "",
        vehicle_plate: profile.vehicle_plate ?? "",
        max_weight_kg: profile.max_weight_kg ?? "",
        max_volume_m3: profile.max_volume_m3 ?? "",
        service_areas: (profile.service_areas ?? []).join(", "),
        city: profile.city ?? "",
        country: profile.country ?? "",
        currency: profile.currency ?? "USD",
        base_fee: profile.base_fee ?? "",
        per_km_fee: profile.per_km_fee ?? "",
        min_fee: profile.min_fee ?? "",
        free_delivery_above: profile.free_delivery_above ?? "",
        weight_tiers: Array.isArray(profile.weight_tiers) ? profile.weight_tiers : [],
        distance_discounts: Array.isArray(profile.distance_discounts) ? profile.distance_discounts : [],
        rate_notes: profile.rate_notes ?? "",
        vehicle_photo: profile.vehicle_photo ?? "",
        plate_photo: profile.plate_photo ?? "",
        selfie_photo: profile.selfie_photo ?? "",
        license_photo: profile.license_photo ?? "",
        insurance_photo: profile.insurance_photo ?? "",
        bio: profile.bio ?? "",
        offers_supplier_partnerships: profile.offers_supplier_partnerships ?? true,
        active: profile.active ?? true,
      });
      setHydrated(true);
    }
  }, [profile, hydrated]);


  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!userId) return;
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    if (!form.vehicle_photo) { toast.error("Add a photo of your vehicle"); return; }
    setBusy(true);
    const payload: any = {
      user_id: userId,
      display_name: form.display_name || null,
      company_name: form.company_name || null,
      phone: form.phone,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      vehicle_type: form.vehicle_type,
      vehicle_make: form.vehicle_make || null,
      vehicle_model: form.vehicle_model || null,
      vehicle_plate: form.vehicle_plate || null,
      max_weight_kg: form.max_weight_kg ? Number(form.max_weight_kg) : null,
      max_volume_m3: form.max_volume_m3 ? Number(form.max_volume_m3) : null,
      service_areas: form.service_areas ? form.service_areas.split(",").map((s) => s.trim()).filter(Boolean) : [],
      city: form.city || null,
      country: form.country || null,
      currency: form.currency || "USD",
      base_fee: form.base_fee ? Number(form.base_fee) : null,
      per_km_fee: form.per_km_fee ? Number(form.per_km_fee) : null,
      min_fee: form.min_fee ? Number(form.min_fee) : null,
      free_delivery_above: form.free_delivery_above ? Number(form.free_delivery_above) : null,
      weight_tiers: (form.weight_tiers || []).filter((t) => t && (t.flat || t.per_km || t.up_to_kg !== undefined)),
      distance_discounts: (form.distance_discounts || []).filter((d) => d && (d.above_km || d.percent)),
      rate_notes: form.rate_notes || null,
      vehicle_photo: form.vehicle_photo || null,
      plate_photo: form.plate_photo || null,
      selfie_photo: form.selfie_photo || null,
      license_photo: form.license_photo || null,
      insurance_photo: form.insurance_photo || null,
      bio: form.bio || null,
      offers_supplier_partnerships: form.offers_supplier_partnerships,
      active: form.active,
    };
    const { error } = profile
      ? await supabase.from("courier_profiles" as any).update(payload).eq("user_id", userId)
      : await supabase.from("courier_profiles" as any).insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(profile ? "Courier profile updated" : "You're registered as a courier 📦");
    qc.invalidateQueries({ queryKey: ["my-courier-profile"] });
  };

  // Partnerships inbox (this user is the courier)
  const { data: partnerships = [] } = useQuery({
    queryKey: ["my-courier-partnerships", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_courier_partnerships" as any)
        .select("*, suppliers(name, logo)")
        .eq("courier_user_id", userId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Discover suppliers — couriers can proactively request to partner.
  const [supplierSearch, setSupplierSearch] = useState("");
  const { data: discoverSuppliers = [] } = useQuery({
    queryKey: ["courier-discover-suppliers", userId, supplierSearch, partnerships.length],
    enabled: !!userId && !!profile,
    queryFn: async () => {
      let q = supabase.from("suppliers").select("id,name,logo,country,categories,owner_id").limit(20).order("created_at", { ascending: false });
      if (supplierSearch.trim()) q = q.ilike("name", `%${supplierSearch}%`);
      const { data } = await q;
      const taken = new Set(partnerships.map((p: any) => p.supplier_id));
      return ((data ?? []) as any[]).filter((s) => !taken.has(s.id) && s.owner_id !== userId);
    },
  });

  const requestPartnership = async (supplierId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("supplier_courier_partnerships" as any).insert({
      supplier_id: supplierId,
      courier_user_id: userId,
      initiated_by: "courier",
      message: "I'd like to handle deliveries for your store.",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Partnership request sent");
    qc.invalidateQueries({ queryKey: ["my-courier-partnerships"] });
    qc.invalidateQueries({ queryKey: ["courier-discover-suppliers"] });
  };


  const updatePartnership = async (id: string, status: string) => {
    const { error } = await supabase.from("supplier_courier_partnerships" as any).update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["my-courier-partnerships"] }); }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 via-rose-500/10 to-transparent border border-orange-500/20 p-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white flex items-center justify-center shadow-soft">
            <Truck className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{profile ? "Your courier profile" : "Become a courier"}</p>
            <p className="text-[11px] text-muted-foreground">
              {profile
                ? `Active · ${profile.deliveries_completed ?? 0} deliveries · ★ ${Number(profile.rating ?? 5).toFixed(1)}`
                : "Take last-mile, freight, and supplier delivery contracts — separate from ride-hailing"}
            </p>
          </div>
          {profile && (
            <Link to="/logistics" className="h-9 px-3 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center gap-1 shadow-card">
              Open requests
            </Link>
          )}
        </div>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contact</p>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Display name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <LabeledInput label="Company (optional)" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <LabeledInput label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
      </div>
      <LabeledInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <LabeledInput label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
      </div>
      <LabeledInput label="Service areas (comma separated)" value={form.service_areas} onChange={(v) => setForm({ ...form, service_areas: v })} />

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Vehicle & capacity</p>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle type</label>
        <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
          {["bike","car","van","truck","refrigerated_truck"].map((k) => <option key={k} value={k}>{k.replace("_"," ")}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Make" value={form.vehicle_make} onChange={(v) => setForm({ ...form, vehicle_make: v })} />
        <LabeledInput label="Model" value={form.vehicle_model} onChange={(v) => setForm({ ...form, vehicle_model: v })} />
      </div>
      <LabeledInput label="Number plate" value={form.vehicle_plate} onChange={(v) => setForm({ ...form, vehicle_plate: v.toUpperCase() })} />
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Max weight (kg)" type="number" value={form.max_weight_kg} onChange={(v) => setForm({ ...form, max_weight_kg: v })} />
        <LabeledInput label="Max volume (m³)" type="number" value={form.max_volume_m3} onChange={(v) => setForm({ ...form, max_volume_m3: v })} />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Pricing</p>
      <p className="text-[11px] text-muted-foreground -mt-2">Buyers see this rate when picking delivery at checkout. Add weight tiers for heavier shipments and discounts to reward long-distance routes.</p>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Currency</label>
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["USD","ZWL","ZAR","EUR","GBP","BWP","ZMW"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <LabeledInput label={`Base (${form.currency})`} type="number" value={form.base_fee} onChange={(v) => setForm({ ...form, base_fee: v })} />
        <LabeledInput label={`Per km (${form.currency})`} type="number" value={form.per_km_fee} onChange={(v) => setForm({ ...form, per_km_fee: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label={`Minimum fee (${form.currency})`} type="number" value={form.min_fee} onChange={(v) => setForm({ ...form, min_fee: v })} />
        <LabeledInput label={`Free over (${form.currency} subtotal)`} type="number" value={form.free_delivery_above} onChange={(v) => setForm({ ...form, free_delivery_above: v })} />
      </div>

      {/* Weight tiers */}
      <div className="rounded-2xl border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Weight className="w-4 h-4 text-primary" /><p className="font-bold text-sm">Weight tiers</p></div>
          <button type="button" onClick={() => setForm({ ...form, weight_tiers: [...form.weight_tiers, { up_to_kg: 5, flat: 0, per_km: Number(form.per_km_fee) || 0 }] })} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3 h-3" />Add tier</button>
        </div>
        <p className="text-[10px] text-muted-foreground">Heavier loads cost more. Leave "Up to kg" blank for the final tier ("and above").</p>
        {form.weight_tiers.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-2">Flat per-km rate applies to all weights.</p>}
        {form.weight_tiers.map((t, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <LabeledInput label="Up to kg" type="number" value={t.up_to_kg == null ? "" : String(t.up_to_kg)} onChange={(v) => {
              const next = [...form.weight_tiers]; next[idx] = { ...t, up_to_kg: v === "" ? null : Number(v) }; setForm({ ...form, weight_tiers: next });
            }} />
            <LabeledInput label={`Flat (${form.currency})`} type="number" value={String(t.flat ?? "")} onChange={(v) => {
              const next = [...form.weight_tiers]; next[idx] = { ...t, flat: Number(v) || 0 }; setForm({ ...form, weight_tiers: next });
            }} />
            <LabeledInput label={`Per km (${form.currency})`} type="number" value={String(t.per_km ?? "")} onChange={(v) => {
              const next = [...form.weight_tiers]; next[idx] = { ...t, per_km: Number(v) || 0 }; setForm({ ...form, weight_tiers: next });
            }} />
            <button type="button" onClick={() => setForm({ ...form, weight_tiers: form.weight_tiers.filter((_, i) => i !== idx) })} className="w-10 h-10 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {/* Distance discounts */}
      <div className="rounded-2xl border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Route className="w-4 h-4 text-primary" /><p className="font-bold text-sm">Long-distance discounts</p></div>
          <button type="button" onClick={() => setForm({ ...form, distance_discounts: [...form.distance_discounts, { above_km: 50, percent: 10 }] })} className="text-xs font-bold text-primary flex items-center gap-1"><Plus className="w-3 h-3" />Add discount</button>
        </div>
        <p className="text-[10px] text-muted-foreground">Reward longer trips. Discount applies to the per-km portion only.</p>
        {form.distance_discounts.map((d, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <LabeledInput label="Above km" type="number" value={String(d.above_km ?? "")} onChange={(v) => {
              const next = [...form.distance_discounts]; next[idx] = { ...d, above_km: Number(v) || 0 }; setForm({ ...form, distance_discounts: next });
            }} />
            <LabeledInput label="% off per-km" type="number" value={String(d.percent ?? "")} onChange={(v) => {
              const next = [...form.distance_discounts]; next[idx] = { ...d, percent: Math.min(100, Math.max(0, Number(v) || 0)) }; setForm({ ...form, distance_discounts: next });
            }} />
            <button type="button" onClick={() => setForm({ ...form, distance_discounts: form.distance_discounts.filter((_, i) => i !== idx) })} className="w-10 h-10 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {/* Live preview */}
      <div className="rounded-2xl border bg-muted/40 p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Rate preview</p>
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Test distance (km)" type="number" value={String(previewDistance)} onChange={(v) => setPreviewDistance(Number(v) || 0)} />
          <LabeledInput label="Test weight (kg)" type="number" value={String(previewWeight)} onChange={(v) => setPreviewWeight(Number(v) || 0)} />
        </div>
        {(() => {
          const quote = quoteCourierRate(
            {
              base_fee: form.base_fee ? Number(form.base_fee) : null,
              per_km_fee: form.per_km_fee ? Number(form.per_km_fee) : null,
              min_fee: form.min_fee ? Number(form.min_fee) : null,
              free_delivery_above: form.free_delivery_above ? Number(form.free_delivery_above) : null,
              currency: form.currency,
              weight_tiers: form.weight_tiers,
              distance_discounts: form.distance_discounts,
            },
            { distanceKm: previewDistance, weightKg: previewWeight }
          );
          return (
            <div className="rounded-xl bg-card border p-3">
              <p className="text-xl font-bold">{quote.currency} {quote.amount.toFixed(2)}</p>
              <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                {quote.breakdown.length === 0 ? <li>No charges configured.</li> : quote.breakdown.map((b, i) => <li key={i}>· {b}</li>)}
              </ul>
            </div>
          );
        })()}
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate notes (shown to buyers)</label>
        <textarea value={form.rate_notes} onChange={(e) => setForm({ ...form, rate_notes: e.target.value })} rows={2} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" placeholder="e.g. After-hours surcharge applies. Free returns within 24h." />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Photos · vehicle required</p>
      <div className="grid grid-cols-2 gap-3">
        <ImageUpload label="Vehicle photo *" value={form.vehicle_photo} onChange={(v) => setForm({ ...form, vehicle_photo: v })} folder="courier" aspect="aspect-square" />
        <ImageUpload label="Number plate" value={form.plate_photo} onChange={(v) => setForm({ ...form, plate_photo: v })} folder="courier" aspect="aspect-square" />
        <ImageUpload label="Selfie" value={form.selfie_photo} onChange={(v) => setForm({ ...form, selfie_photo: v })} folder="courier" aspect="aspect-square" />
        <ImageUpload label="License" value={form.license_photo} onChange={(v) => setForm({ ...form, license_photo: v })} folder="courier" aspect="aspect-square" />
        <ImageUpload label="Insurance" value={form.insurance_photo} onChange={(v) => setForm({ ...form, insurance_photo: v })} folder="courier" aspect="aspect-square" />
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Short bio</label>
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" placeholder="Tell suppliers and buyers about your service" />
      </div>

      <label className="flex items-center gap-2 text-sm rounded-xl border bg-muted/30 p-3">
        <input type="checkbox" checked={form.offers_supplier_partnerships} onChange={(e) => setForm({ ...form, offers_supplier_partnerships: e.target.checked })} className="w-4 h-4" />
        <span className="flex-1">
          <p className="font-bold">Open to supplier partnerships</p>
          <p className="text-[11px] text-muted-foreground">Suppliers can invite you as their dedicated delivery partner for goods.</p>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
        Active — show me to buyers and suppliers
      </label>

      <Button onClick={save} disabled={busy} className="w-full h-12">
        {busy ? "Saving…" : profile ? "Save courier profile" : "Register as a courier"}
      </Button>

      {profile && (
        <div className="pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Supplier partnerships</p>
          {partnerships.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-xs text-center text-muted-foreground">
              No partnership requests yet. Suppliers who want a dedicated courier will reach out here.
            </div>
          ) : (
            <div className="space-y-2">
              {partnerships.map((p: any) => (
                <div key={p.id} className="bg-card border rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0">
                    {p.suppliers?.logo && <img src={p.suppliers.logo} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{p.suppliers?.name ?? "Supplier"}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{p.status} · {p.initiated_by === "supplier" ? "invited you" : "you requested"}</p>
                    {p.agreed_rate && <p className="text-[11px] mt-0.5">{p.currency} {p.agreed_rate}</p>}
                  </div>
                  {p.status === "pending" && p.initiated_by === "supplier" && (
                    <div className="flex gap-1">
                      <button onClick={() => updatePartnership(p.id, "active")} className="h-8 px-3 rounded-full bg-emerald-500 text-white text-xs font-bold">Accept</button>
                      <button onClick={() => updatePartnership(p.id, "declined")} className="h-8 px-3 rounded-full bg-muted text-xs font-bold">Decline</button>
                    </div>
                  )}
                  {p.status === "active" && (
                    <button onClick={() => updatePartnership(p.id, "paused")} className="h-8 px-3 rounded-full bg-muted text-xs font-bold">Pause</button>
                  )}
                  {p.status === "paused" && (
                    <button onClick={() => updatePartnership(p.id, "active")} className="h-8 px-3 rounded-full bg-emerald-500 text-white text-xs font-bold">Resume</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Discover suppliers to partner with */}
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Discover suppliers</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Search suppliers by name"
                className="w-full h-11 pl-9 pr-3 rounded-xl border bg-background text-sm"
              />
            </div>
            {discoverSuppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-4 text-xs text-center text-muted-foreground">
                No suppliers match — try another name.
              </div>
            ) : (
              <div className="space-y-2">
                {discoverSuppliers.map((s: any) => (
                  <div key={s.id} className="bg-card border rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0">
                      {s.logo && <img src={s.logo} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{s.country ?? ""} {Array.isArray(s.categories) && s.categories.length ? `· ${s.categories.slice(0,2).join(", ")}` : ""}</p>
                    </div>
                    <Button size="sm" onClick={() => requestPartnership(s.id)} className="h-9 text-[11px]">
                      <Handshake className="w-3.5 h-3.5 mr-1" /> Request
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Finance products ---------------- */
function FinanceServiceView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-finance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("finance_products").select("*").eq("owner_user_id", userId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("finance_products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-finance"] }); }
  };
  if (!userId) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
  return (
    <>
      <ServiceShell
        title={`${items.length} products listed`}
        items={items}
        isLoading={isLoading}
        emptyHint="List loans, vehicle financing, working capital or insurance products."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(p: any) => (
          <div key={p.id} className="bg-card border rounded-2xl shadow-card p-3 flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">{p.cover && <img src={p.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{p.kind.replace("_"," ")} · {p.provider_name ?? "—"}</p>
              {p.interest_rate != null && <p className="text-xs font-bold mt-1">{p.interest_rate}% APR</p>}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(p); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(p.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && <FinanceFormDialog userId={userId} initial={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-finance"] }); qc.invalidateQueries({ queryKey: ["finance-products"] }); qc.invalidateQueries({ queryKey: ["home-finance"] }); }} />}
    </>
  );
}

function FinanceFormDialog({ userId, initial, onClose, onSaved }: { userId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: initial?.title ?? "",
    kind: initial?.kind ?? "loan",
    provider_name: initial?.provider_name ?? "",
    description: initial?.description ?? "",
    min_amount: initial?.min_amount ?? "",
    max_amount: initial?.max_amount ?? "",
    interest_rate: initial?.interest_rate ?? "",
    term_months: initial?.term_months ?? "",
    cover: initial?.cover ?? "",
    contact_phone: initial?.contact_phone ?? "",
    contact_whatsapp: initial?.contact_whatsapp ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const payload: any = {
      owner_user_id: userId,
      title: f.title.trim(),
      kind: f.kind,
      provider_name: f.provider_name || null,
      description: f.description || null,
      min_amount: f.min_amount ? Number(f.min_amount) : null,
      max_amount: f.max_amount ? Number(f.max_amount) : null,
      interest_rate: f.interest_rate ? Number(f.interest_rate) : null,
      term_months: f.term_months ? Number(f.term_months) : null,
      cover: f.cover || null,
      contact_phone: f.contact_phone || null,
      contact_whatsapp: f.contact_whatsapp || null,
    };
    const res = initial?.id
      ? await supabase.from("finance_products").update(payload).eq("id", initial.id)
      : await supabase.from("finance_products").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); onSaved();
  };
  return (
    <FormSheet title={initial ? "Edit finance product" : "New finance product"} onClose={onClose}>
      <ImageUpload value={f.cover} onChange={(v) => setF({ ...f, cover: v })} label="Cover image" />
      <LabeledInput label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kind</label>
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
          <option value="loan">Personal loan</option>
          <option value="vehicle_financing">Vehicle financing</option>
          <option value="working_capital">Working capital</option>
          <option value="insurance">Insurance</option>
        </select>
      </div>
      <LabeledInput label="Provider name" value={f.provider_name} onChange={(v) => setF({ ...f, provider_name: v })} />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Min amount ($)" type="number" value={f.min_amount} onChange={(v) => setF({ ...f, min_amount: v })} />
        <LabeledInput label="Max amount ($)" type="number" value={f.max_amount} onChange={(v) => setF({ ...f, max_amount: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="APR (%)" type="number" value={f.interest_rate} onChange={(v) => setF({ ...f, interest_rate: v })} />
        <LabeledInput label="Term (months)" type="number" value={f.term_months} onChange={(v) => setF({ ...f, term_months: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Phone" value={f.contact_phone} onChange={(v) => setF({ ...f, contact_phone: v })} />
        <LabeledInput label="WhatsApp" value={f.contact_whatsapp} onChange={(v) => setF({ ...f, contact_whatsapp: v })} />
      </div>
      <Button onClick={save} disabled={saving} className="w-full h-11">{saving ? "Saving…" : "Save product"}</Button>
    </FormSheet>
  );
}

/* ---------------- Car rentals ---------------- */
function CarRentalServiceView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-car-rentals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("car_rentals").select("*").eq("owner_user_id", userId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this rental listing?")) return;
    const { error } = await supabase.from("car_rentals").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-car-rentals"] }); }
  };
  if (!userId) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;
  return (
    <>
      <ServiceShell
        title={`${items.length} rentals listed`}
        items={items}
        isLoading={isLoading}
        emptyHint="List a vehicle for self-drive rental — set price per day, free mileage, rules and penalties."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(p: any) => (
          <div key={p.id} className="bg-card border rounded-2xl shadow-card p-3 flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">{p.cover && <img src={p.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize truncate">{p.vehicle_class} · {p.transmission} · {p.seats} seats</p>
              <p className="text-xs font-bold mt-1 tabular-nums">${p.price_per_day}/day · {p.unlimited_km ? "Unlimited km" : `${p.free_km_per_day}km/day`}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(p); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(p.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && <CarRentalFormDialog userId={userId} initial={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-car-rentals"] }); qc.invalidateQueries({ queryKey: ["car-rentals"] }); qc.invalidateQueries({ queryKey: ["home-car-rentals"] }); }} />}
    </>
  );
}

function CarRentalFormDialog({ userId, initial, onClose, onSaved }: { userId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: initial?.title ?? "",
    make: initial?.make ?? "",
    model: initial?.model ?? "",
    year: initial?.year ?? "",
    vehicle_class: initial?.vehicle_class ?? "economy",
    transmission: initial?.transmission ?? "automatic",
    fuel: initial?.fuel ?? "petrol",
    seats: initial?.seats ?? 5,
    cover: initial?.cover ?? "",
    description: initial?.description ?? "",
    // Pricing
    price_per_day: initial?.price_per_day ?? "",
    price_per_week: initial?.price_per_week ?? "",
    price_per_month: initial?.price_per_month ?? "",
    weekend_surcharge_pct: initial?.weekend_surcharge_pct ?? "",
    deposit: initial?.deposit ?? 0,
    // Mileage
    free_km_per_day: initial?.free_km_per_day ?? 200,
    unlimited_km: initial?.unlimited_km ?? false,
    extra_km_fee: initial?.extra_km_fee ?? "",
    // Eligibility
    min_age: initial?.min_age ?? 21,
    max_age: initial?.max_age ?? "",
    min_license_years: initial?.min_license_years ?? 1,
    young_driver_age_threshold: initial?.young_driver_age_threshold ?? 25,
    young_driver_fee: initial?.young_driver_fee ?? "",
    international_license_ok: initial?.international_license_ok ?? true,
    cross_border_allowed: initial?.cross_border_allowed ?? false,
    cross_border_fee: initial?.cross_border_fee ?? "",
    cross_border_countries: (initial?.cross_border_countries ?? []).join(", "),
    required_documents: (initial?.required_documents ?? ["national_id", "drivers_license"]).join(", "),
    // Booking
    min_rental_days: initial?.min_rental_days ?? 1,
    max_rental_days: initial?.max_rental_days ?? "",
    advance_booking_hours: initial?.advance_booking_hours ?? 4,
    pickup_locations: (initial?.pickup_locations ?? []).join(", "),
    delivery_available: initial?.delivery_available ?? false,
    delivery_fee: initial?.delivery_fee ?? "",
    fuel_policy: initial?.fuel_policy ?? "full_to_full",
    smoking_allowed: initial?.smoking_allowed ?? false,
    pets_allowed: initial?.pets_allowed ?? false,
    // Penalties
    late_return_fee_per_hour: initial?.late_return_fee_per_hour ?? "",
    cleaning_fee: initial?.cleaning_fee ?? "",
    smoking_penalty: initial?.smoking_penalty ?? "",
    pet_penalty: initial?.pet_penalty ?? "",
    damage_excess: initial?.damage_excess ?? "",
    cancellation_policy: initial?.cancellation_policy ?? "flexible",
    cancellation_fee: initial?.cancellation_fee ?? "",
    custom_rules: (initial?.custom_rules ?? []).join("\n"),
    custom_penalties: JSON.stringify(initial?.custom_penalties ?? [], null, 0),
    // Insurance
    insurance_included: initial?.insurance_included ?? true,
    insurance_provider: initial?.insurance_provider ?? "",
    // Features
    features: (initial?.features ?? []).join(", "),
    // Location
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    contact_phone: initial?.contact_phone ?? "",
    contact_whatsapp: initial?.contact_whatsapp ?? "",
  });
  const [saving, setSaving] = useState(false);

  const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    if (!f.title.trim()) { toast.error("Title required"); return; }
    if (!f.price_per_day) { toast.error("Price per day required"); return; }

    let custom_penalties: any[] = [];
    try { custom_penalties = f.custom_penalties ? JSON.parse(f.custom_penalties) : []; }
    catch { toast.error("Custom penalties must be valid JSON"); return; }

    setSaving(true);
    const payload: any = {
      owner_user_id: userId,
      title: f.title.trim(),
      make: f.make || null,
      model: f.model || null,
      year: f.year ? Number(f.year) : null,
      vehicle_class: f.vehicle_class,
      transmission: f.transmission,
      fuel: f.fuel,
      seats: Number(f.seats) || 5,
      cover: f.cover || null,
      description: f.description || null,
      price_per_day: Number(f.price_per_day),
      price_per_week: f.price_per_week ? Number(f.price_per_week) : null,
      price_per_month: f.price_per_month ? Number(f.price_per_month) : null,
      weekend_surcharge_pct: f.weekend_surcharge_pct ? Number(f.weekend_surcharge_pct) : null,
      deposit: Number(f.deposit) || 0,
      free_km_per_day: Number(f.free_km_per_day) || 0,
      unlimited_km: f.unlimited_km,
      extra_km_fee: f.extra_km_fee ? Number(f.extra_km_fee) : null,
      min_age: Number(f.min_age) || 21,
      max_age: f.max_age ? Number(f.max_age) : null,
      min_license_years: Number(f.min_license_years) || 1,
      young_driver_age_threshold: f.young_driver_age_threshold ? Number(f.young_driver_age_threshold) : null,
      young_driver_fee: f.young_driver_fee ? Number(f.young_driver_fee) : null,
      international_license_ok: f.international_license_ok,
      cross_border_allowed: f.cross_border_allowed,
      cross_border_fee: f.cross_border_fee ? Number(f.cross_border_fee) : null,
      cross_border_countries: splitList(f.cross_border_countries),
      required_documents: splitList(f.required_documents),
      min_rental_days: Number(f.min_rental_days) || 1,
      max_rental_days: f.max_rental_days ? Number(f.max_rental_days) : null,
      advance_booking_hours: Number(f.advance_booking_hours) || 0,
      pickup_locations: splitList(f.pickup_locations),
      delivery_available: f.delivery_available,
      delivery_fee: f.delivery_fee ? Number(f.delivery_fee) : null,
      fuel_policy: f.fuel_policy,
      smoking_allowed: f.smoking_allowed,
      pets_allowed: f.pets_allowed,
      late_return_fee_per_hour: f.late_return_fee_per_hour ? Number(f.late_return_fee_per_hour) : null,
      cleaning_fee: f.cleaning_fee ? Number(f.cleaning_fee) : null,
      smoking_penalty: f.smoking_penalty ? Number(f.smoking_penalty) : null,
      pet_penalty: f.pet_penalty ? Number(f.pet_penalty) : null,
      damage_excess: f.damage_excess ? Number(f.damage_excess) : null,
      cancellation_policy: f.cancellation_policy,
      cancellation_fee: f.cancellation_fee ? Number(f.cancellation_fee) : null,
      custom_rules: splitList(f.custom_rules),
      custom_penalties,
      insurance_included: f.insurance_included,
      insurance_provider: f.insurance_provider || null,
      features: splitList(f.features),
      city: f.city || null,
      country: f.country || null,
      contact_phone: f.contact_phone || null,
      contact_whatsapp: f.contact_whatsapp || null,
    };
    const res = initial?.id
      ? await supabase.from("car_rentals").update(payload).eq("id", initial.id)
      : await supabase.from("car_rentals").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); onSaved();
  };

  return (
    <FormSheet title={initial ? "Edit car rental" : "List a car for rent"} onClose={onClose}>
      <ImageUpload value={f.cover} onChange={(v) => setF({ ...f, cover: v })} label="Cover photo" />

      <SectionHeader>Vehicle</SectionHeader>
      <LabeledInput label="Listing title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Make" value={f.make} onChange={(v) => setF({ ...f, make: v })} />
        <LabeledInput label="Model" value={f.model} onChange={(v) => setF({ ...f, model: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Year" type="number" value={f.year} onChange={(v) => setF({ ...f, year: v })} />
        <LabeledInput label="Seats" type="number" value={f.seats} onChange={(v) => setF({ ...f, seats: v })} />
        <LabeledSelect label="Class" value={f.vehicle_class} onChange={(v) => setF({ ...f, vehicle_class: v })}
          options={["economy","compact","suv","luxury","exotic","van","bakkie","ev"]} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledSelect label="Transmission" value={f.transmission} onChange={(v) => setF({ ...f, transmission: v })} options={["automatic","manual"]} />
        <LabeledSelect label="Fuel" value={f.fuel} onChange={(v) => setF({ ...f, fuel: v })} options={["petrol","diesel","hybrid","electric"]} />
      </div>
      <LabeledInput label="Features (comma-separated)" value={f.features} onChange={(v) => setF({ ...f, features: v })} />
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>

      <SectionHeader>Pricing</SectionHeader>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="$/day *" type="number" value={f.price_per_day} onChange={(v) => setF({ ...f, price_per_day: v })} />
        <LabeledInput label="$/week" type="number" value={f.price_per_week} onChange={(v) => setF({ ...f, price_per_week: v })} />
        <LabeledInput label="$/month" type="number" value={f.price_per_month} onChange={(v) => setF({ ...f, price_per_month: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Weekend surcharge %" type="number" value={f.weekend_surcharge_pct} onChange={(v) => setF({ ...f, weekend_surcharge_pct: v })} />
        <LabeledInput label="Refundable deposit" type="number" value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} />
      </div>

      <SectionHeader>Mileage policy</SectionHeader>
      <ToggleField label="Unlimited km" value={f.unlimited_km} onChange={(v) => setF({ ...f, unlimited_km: v })} />
      {!f.unlimited_km && (
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Free km / day" type="number" value={f.free_km_per_day} onChange={(v) => setF({ ...f, free_km_per_day: v })} />
          <LabeledInput label="Extra km fee ($)" type="number" value={f.extra_km_fee} onChange={(v) => setF({ ...f, extra_km_fee: v })} />
        </div>
      )}

      <SectionHeader>Eligibility</SectionHeader>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Min age" type="number" value={f.min_age} onChange={(v) => setF({ ...f, min_age: v })} />
        <LabeledInput label="Max age" type="number" value={f.max_age} onChange={(v) => setF({ ...f, max_age: v })} />
        <LabeledInput label="License (yrs)" type="number" value={f.min_license_years} onChange={(v) => setF({ ...f, min_license_years: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Young driver age <" type="number" value={f.young_driver_age_threshold} onChange={(v) => setF({ ...f, young_driver_age_threshold: v })} />
        <LabeledInput label="Young driver fee/day" type="number" value={f.young_driver_fee} onChange={(v) => setF({ ...f, young_driver_fee: v })} />
      </div>
      <LabeledInput label="Required docs (comma)" value={f.required_documents} onChange={(v) => setF({ ...f, required_documents: v })} />
      <ToggleField label="International license accepted" value={f.international_license_ok} onChange={(v) => setF({ ...f, international_license_ok: v })} />
      <ToggleField label="Cross-border driving allowed" value={f.cross_border_allowed} onChange={(v) => setF({ ...f, cross_border_allowed: v })} />
      {f.cross_border_allowed && (
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Cross-border fee" type="number" value={f.cross_border_fee} onChange={(v) => setF({ ...f, cross_border_fee: v })} />
          <LabeledInput label="Allowed countries (comma)" value={f.cross_border_countries} onChange={(v) => setF({ ...f, cross_border_countries: v })} />
        </div>
      )}

      <SectionHeader>Booking & pickup</SectionHeader>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Min days" type="number" value={f.min_rental_days} onChange={(v) => setF({ ...f, min_rental_days: v })} />
        <LabeledInput label="Max days" type="number" value={f.max_rental_days} onChange={(v) => setF({ ...f, max_rental_days: v })} />
        <LabeledInput label="Notice (hrs)" type="number" value={f.advance_booking_hours} onChange={(v) => setF({ ...f, advance_booking_hours: v })} />
      </div>
      <LabeledInput label="Pickup locations (comma)" value={f.pickup_locations} onChange={(v) => setF({ ...f, pickup_locations: v })} />
      <LabeledSelect label="Fuel policy" value={f.fuel_policy} onChange={(v) => setF({ ...f, fuel_policy: v })} options={["full_to_full","prepaid","same_level"]} />
      <ToggleField label="Delivery available" value={f.delivery_available} onChange={(v) => setF({ ...f, delivery_available: v })} />
      {f.delivery_available && (
        <LabeledInput label="Delivery fee" type="number" value={f.delivery_fee} onChange={(v) => setF({ ...f, delivery_fee: v })} />
      )}

      <SectionHeader>Rules & penalties</SectionHeader>
      <div className="grid grid-cols-2 gap-2">
        <ToggleField label="Smoking allowed" value={f.smoking_allowed} onChange={(v) => setF({ ...f, smoking_allowed: v })} />
        <ToggleField label="Pets allowed" value={f.pets_allowed} onChange={(v) => setF({ ...f, pets_allowed: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Smoking penalty" type="number" value={f.smoking_penalty} onChange={(v) => setF({ ...f, smoking_penalty: v })} />
        <LabeledInput label="Pet penalty" type="number" value={f.pet_penalty} onChange={(v) => setF({ ...f, pet_penalty: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <LabeledInput label="Late return $/hr" type="number" value={f.late_return_fee_per_hour} onChange={(v) => setF({ ...f, late_return_fee_per_hour: v })} />
        <LabeledInput label="Cleaning fee" type="number" value={f.cleaning_fee} onChange={(v) => setF({ ...f, cleaning_fee: v })} />
        <LabeledInput label="Damage excess" type="number" value={f.damage_excess} onChange={(v) => setF({ ...f, damage_excess: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledSelect label="Cancellation" value={f.cancellation_policy} onChange={(v) => setF({ ...f, cancellation_policy: v })} options={["flexible","moderate","strict"]} />
        <LabeledInput label="Cancel fee" type="number" value={f.cancellation_fee} onChange={(v) => setF({ ...f, cancellation_fee: v })} />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custom rules (one per line)</label>
        <textarea value={f.custom_rules} onChange={(e) => setF({ ...f, custom_rules: e.target.value })} rows={3} placeholder={"No off-road driving\nReturn with empty boot"} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custom penalties (JSON)</label>
        <textarea value={f.custom_penalties} onChange={(e) => setF({ ...f, custom_penalties: e.target.value })} rows={2} placeholder='[{"label":"Lost key","amount":150}]' className="w-full rounded-xl border bg-background p-3 text-xs font-mono mt-1" />
      </div>

      <SectionHeader>Insurance & contact</SectionHeader>
      <ToggleField label="Insurance included" value={f.insurance_included} onChange={(v) => setF({ ...f, insurance_included: v })} />
      <LabeledInput label="Insurance provider" value={f.insurance_provider} onChange={(v) => setF({ ...f, insurance_provider: v })} />
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="City" value={f.city} onChange={(v) => setF({ ...f, city: v })} />
        <LabeledInput label="Country" value={f.country} onChange={(v) => setF({ ...f, country: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Phone" value={f.contact_phone} onChange={(v) => setF({ ...f, contact_phone: v })} />
        <LabeledInput label="WhatsApp" value={f.contact_whatsapp} onChange={(v) => setF({ ...f, contact_whatsapp: v })} />
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-11 mt-2">{saving ? "Saving…" : "Save listing"}</Button>
    </FormSheet>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 -mx-1 sticky">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/70 border-b pb-1">{children}</p>
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
      </select>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between border rounded-xl px-3 py-2.5 cursor-pointer">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
    </label>
  );
}

/* ---------------- Agro ---------------- */
function AgroServiceView() {
  const qc = useQueryClient();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-agro", supplier?.id],
    enabled: !!supplier,
    queryFn: async () => {
      const { data } = await supabase.from("agro_listings").select("*").eq("supplier_id", supplier!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("agro_listings").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["my-agro"] }); qc.invalidateQueries({ queryKey: ["agro"] }); qc.invalidateQueries({ queryKey: ["home-agro"] }); }
  };
  if (!supplier) return <div className="p-6"><EmptyState title="Create your store first" action={<Button asChild><Link to="/become-supplier">Open store</Link></Button>} /></div>;
  return (
    <>
      <ServiceShell
        title={`${items.length} agro listings`}
        items={items}
        isLoading={isLoading}
        emptyHint="List produce, machinery, inputs, livestock, agri-services or open a co-investment project."
        onAdd={() => { setEditing(null); setOpen(true); }}
        renderItem={(it) => (
          <div key={it.id} className="bg-card border rounded-2xl shadow-card flex gap-3 p-3">
            <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">{it.cover && <img src={it.cover} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{it.title}</p>
              <p className="text-[11px] text-muted-foreground truncate capitalize">{it.kind}{it.subcategory ? ` · ${it.subcategory}` : ""}{it.organic ? " · organic" : ""}</p>
              <p className="text-xs font-bold mt-1">
                {it.kind === "project"
                  ? `Goal $${Number(it.funding_goal || 0).toLocaleString()} · ${Math.round(((it.funding_raised || 0) / (it.funding_goal || 1)) * 100)}% funded`
                  : `${it.price ? `$${Number(it.price).toLocaleString()}` : "Quote"}${it.unit ? ` / ${it.unit}` : ""}`}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => { setEditing(it); setOpen(true); }} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(it.id)} className="w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      />
      {open && (
        <AgroFormDialog
          supplierId={supplier.id} initial={editing} onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-agro"] }); qc.invalidateQueries({ queryKey: ["agro"] }); qc.invalidateQueries({ queryKey: ["home-agro"] }); }}
        />
      )}
    </>
  );
}

function AgroFormDialog({ supplierId, initial, onClose, onSaved }: { supplierId: string; initial: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    kind: initial?.kind ?? "produce",
    subcategory: initial?.subcategory ?? "",
    cover: initial?.cover ?? "",
    description: initial?.description ?? "",
    moq: initial?.moq ?? 1,
    unit: initial?.unit ?? "kg",
    price: initial?.price ?? 0,
    harvest_season: initial?.harvest_season ?? "",
    lead_time: initial?.lead_time ?? "",
    capacity: initial?.capacity ?? "",
    ship_from: initial?.ship_from ?? "",
    country: initial?.country ?? "",
    region: initial?.region ?? "",
    organic: initial?.organic ?? false,
    certifications: (initial?.certifications ?? []).join(", "),
    funding_goal: initial?.funding_goal ?? 0,
    funding_raised: initial?.funding_raised ?? 0,
    project_status: initial?.project_status ?? "open",
  });
  const [busy, setBusy] = useState(false);
  const isProject = form.kind === "project";
  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const payload: any = {
      supplier_id: supplierId,
      title: form.title,
      kind: form.kind,
      subcategory: form.subcategory || null,
      cover: form.cover || null,
      description: form.description || null,
      moq: Number(form.moq) || null,
      unit: form.unit || null,
      price: isProject ? null : (Number(form.price) || null),
      harvest_season: form.harvest_season || null,
      lead_time: form.lead_time || null,
      capacity: form.capacity || null,
      ship_from: form.ship_from || null,
      country: form.country || null,
      region: form.region || null,
      organic: !!form.organic,
      certifications: String(form.certifications).split(",").map((s) => s.trim()).filter(Boolean),
      funding_goal: isProject ? (Number(form.funding_goal) || null) : null,
      funding_raised: isProject ? (Number(form.funding_raised) || 0) : 0,
      project_status: isProject ? (form.project_status || "open") : null,
    };
    const { error } = initial
      ? await supabase.from("agro_listings").update(payload).eq("id", initial.id)
      : await supabase.from("agro_listings").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(initial ? "Updated" : "Listed 🌱");
    onSaved();
  };
  return (
    <FormSheet onClose={onClose} title={initial ? "Edit agro listing" : "New agro listing"}>
      <LabeledInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kind</label>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
            {["produce","equipment","inputs","livestock","services","project"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <LabeledInput label="Subcategory" value={form.subcategory} onChange={(v) => setForm({ ...form, subcategory: v })} />
      </div>
      <ImageUpload
        label="Cover photo"
        value={form.cover}
        onChange={(v) => setForm({ ...form, cover: v })}
        folder="agro"
        aspect="aspect-video"
        hint="Field, harvest, equipment or project visual"
      />
      {!isProject && (
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="MOQ" type="number" value={form.moq} onChange={(v) => setForm({ ...form, moq: Number(v) || 1 })} />
          <LabeledInput label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
          <LabeledInput label="Price ($)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) || 0 })} />
        </div>
      )}
      {isProject && (
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="Funding goal ($)" type="number" value={form.funding_goal} onChange={(v) => setForm({ ...form, funding_goal: Number(v) || 0 })} />
          <LabeledInput label="Raised ($)" type="number" value={form.funding_raised} onChange={(v) => setForm({ ...form, funding_raised: Number(v) || 0 })} />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
            <select value={form.project_status} onChange={(e) => setForm({ ...form, project_status: e.target.value })} className="w-full h-11 rounded-xl border bg-background px-3 text-sm mt-1">
              {["open","funded","in_progress","closed"].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Harvest season" value={form.harvest_season} onChange={(v) => setForm({ ...form, harvest_season: v })} />
        <LabeledInput label="Lead time" value={form.lead_time} onChange={(v) => setForm({ ...form, lead_time: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Capacity" value={form.capacity} onChange={(v) => setForm({ ...form, capacity: v })} />
        <LabeledInput label="Ship from" value={form.ship_from} onChange={(v) => setForm({ ...form, ship_from: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
        <LabeledInput label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
      </div>
      <LabeledInput label="Certifications (comma-separated)" value={form.certifications} onChange={(v) => setForm({ ...form, certifications: v })} />
      <label className="flex items-center justify-between gap-2 py-2">
        <span className="text-sm font-medium">Organic</span>
        <input type="checkbox" checked={!!form.organic} onChange={(e) => setForm({ ...form, organic: e.target.checked })} className="w-4 h-4" />
      </label>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border bg-background p-3 text-sm mt-1" />
      </div>
      <Button onClick={save} disabled={busy} className="w-full h-12">{busy ? "Saving…" : initial ? "Save changes" : "Publish listing"}</Button>
    </FormSheet>
  );
}
