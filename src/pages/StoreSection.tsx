import { useEffect, useRef, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, TrendingUp, Eye, ShoppingBag, DollarSign, Star, Megaphone, Truck, Package, Settings, Image as ImageIcon, X, Loader2, Link2, Download, Sparkles, Percent, Check, Pencil, Trash2, CheckSquare, Square, Tag, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProducts, fetchMySupplier, fetchCategories } from "@/data/products";
import EmptyState from "@/components/EmptyState";
import LocationPicker from "@/components/LocationPicker";
import { useImportJob, type BulkCandidate, type ImportedProduct, type MarkupMode } from "@/store/importJob";

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
      {section === "product-edit" && sub && <EditProductView productId={sub} />}
      {key === "orders" && <OrdersView />}
      {key === "analytics" && <AnalyticsView />}
      {key === "promote" && <PromoteView />}
      {key === "reviews" && <ReviewsView />}
      {key === "shipping" && <ShippingView />}
      {key === "profile" && <ProfileView />}
      {key === "settings" && <SettingsView />}
      {key === "import" && <ImportView />}
    </div>
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
  const [mode, setMode] = useState<"single" | "bulk">("single");

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

  if (email === null) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;

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
      <div className="flex bg-muted rounded-full p-1">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 h-9 rounded-full text-xs font-bold transition ${mode === m ? "bg-background shadow-card" : "text-muted-foreground"}`}
          >
            {m === "single" ? "Single URL" : "Bulk import"}
          </button>
        ))}
      </div>

      {/* Markup controls — shared */}
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

      {mode === "single" ? (
        <SingleImport markupMode={markupMode} markupValue={Number(markupValue) || 0} qc={qc} navigate={navigate} />
      ) : (
        <BulkImport markupMode={markupMode} markupValue={Number(markupValue) || 0} qc={qc} />
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
      const { data, error } = await supabase.functions.invoke("import-product", { body: { url: url.trim() } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const p = (data as any)?.product as ImportedProduct | undefined;
      if (!p) throw new Error("Nothing returned");
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

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="px-4 py-4 space-y-3 pb-32">
      {!selectMode ? (
        <div className="flex gap-2">
          <Button asChild className="flex-1 h-11">
            <Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add product</Link>
          </Button>
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
              {cats.map((c: any) => (
                <button
                  key={c.slug}
                  onClick={() => bulkAssignCategory(c.slug)}
                  disabled={working}
                  className="h-12 rounded-xl border bg-background hover:bg-primary/10 hover:border-primary text-sm font-bold transition disabled:opacity-50 truncate px-3"
                >
                  {c.name}
                </button>
              ))}
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
  });
  const [gallery, setGallery] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
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

      const uploaded: string[] = [];
      for (const file of newFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, {
          cacheControl: "3600", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
        uploaded.push(publicUrl);
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

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;
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
      </div>

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
  const [form, setForm] = useState({
    name: "", country: "", about: "", logo: "", banner: "",
    latitude: null as number | null, longitude: null as number | null, locationAddress: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

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
    });
  }, [supplier]);

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
