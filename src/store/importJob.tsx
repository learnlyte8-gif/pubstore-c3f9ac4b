import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMySupplier } from "@/data/products";
import { toast } from "sonner";
import { importProductFromUrl } from "@/lib/importProduct";

export type ImportedProduct = {
  title: string;
  price: number | null;
  original_price: number | null;
  currency: string | null;
  description: string;
  images: string[];
  source: string;
  source_url: string;
  moq?: number | null;
  unit?: string | null;
  category_slug?: string | null;
};

export type BulkCandidate = {
  url: string;
  title: string;
  image: string | null;
  price: number | null;
  source: string;
  status: "pending" | "importing" | "done" | "skipped" | "error";
  error?: string;
  productId?: string;
  category_slug?: string | null;
};

export type MarkupMode = "percent" | "flat" | "none";

function applyMarkup(price: number | null, mode: MarkupMode, value: number): number | null {
  if (price == null || isNaN(price)) return price;
  if (mode === "none" || !value) return Math.round(price * 100) / 100;
  const v = Number(value) || 0;
  const out = mode === "percent" ? price * (1 + v / 100) : price + v;
  return Math.round(out * 100) / 100;
}

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

type StartArgs = {
  items: BulkCandidate[];
  markupMode: MarkupMode;
  markupValue: number;
  sourceLabel?: string;
  onProductSaved?: () => void;
};

type ImportJobState = {
  running: boolean;
  items: BulkCandidate[];
  done: number;
  total: number;
  sourceLabel?: string;
  startedAt?: number;
  finishedAt?: number;
};

type Ctx = {
  state: ImportJobState;
  start: (args: StartArgs) => Promise<void>;
  dismiss: () => void;
  updateItem: (idx: number, patch: Partial<BulkCandidate>) => void;
  setItems: (items: BulkCandidate[]) => void;
};

const ImportJobContext = createContext<Ctx | null>(null);

const initial: ImportJobState = { running: false, items: [], done: 0, total: 0 };

export function ImportJobProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImportJobState>(initial);
  const cancelRef = useRef(false);

  const updateItem = useCallback((idx: number, patch: Partial<BulkCandidate>) => {
    setState((s) => ({ ...s, items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }, []);

  const setItems = useCallback((items: BulkCandidate[]) => {
    setState((s) => ({ ...s, items }));
  }, []);

  const dismiss = useCallback(() => {
    if (state.running) return;
    setState(initial);
  }, [state.running]);

  const start = useCallback(async ({ items, markupMode, markupValue, sourceLabel, onProductSaved }: StartArgs) => {
    if (state.running) {
      toast.error("An import is already running");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const supplier = await fetchMySupplier();
    if (!supplier) { toast.error("Create your store first"); return; }

    const queue = items.map((it, i) => ({ it, i })).filter(({ it }) => it.status === "pending");
    if (queue.length === 0) return;

    cancelRef.current = false;
    setState({
      running: true,
      items,
      done: 0,
      total: queue.length,
      sourceLabel,
      startedAt: Date.now(),
    });

    let done = 0;
    for (const { it, i } of queue) {
      if (cancelRef.current) break;
      setState((s) => ({ ...s, items: s.items.map((x, idx) => (idx === i ? { ...x, status: "importing" } : x)) }));
      try {
        const p = await importProductFromUrl(it.url);

        // Prefer extractor price, then the price captured in the listing preview.
        const basePrice = p.price ?? it.price ?? null;
        const marked = applyMarkup(basePrice, markupMode, markupValue);
        // If nothing could be found, save as a draft priced at 0 so the user can edit
        // and publish later instead of losing the whole row to an error.
        const finalPrice = marked ?? 0;
        const isDraft = basePrice == null;
        // Show a small "discount" by making original_price slightly higher than our price.
        // Bump between 8–18% above final price, rounded to look natural (.99).
        const bumpPct = 0.08 + Math.random() * 0.10;
        const inflated = finalPrice > 0
          ? Math.max(finalPrice + 1, Math.round(finalPrice * (1 + bumpPct)) - 0.01)
          : null;

        const imagePool = (p.images && p.images.length > 0)
          ? p.images
          : (it.image ? [it.image] : []);
        const stored = await mirrorImages(user.id, imagePool, `bulk-${i}`);

        const { data: product, error: insErr } = await supabase.from("products").insert({
          supplier_id: supplier.id,
          title: (it.title?.trim() || p.title || "Imported product").slice(0, 200),
          description: p.description || null,
          image: stored[0] ?? null,
          gallery: stored,
          price: finalPrice,
          original_price: basePrice ?? null,
          moq: p.moq ?? 1,
          unit: p.unit ?? "piece",
          category_slug: it.category_slug ?? p.category_slug ?? null,
          ship_from: supplier.country ?? null,
          active: !isDraft,
        }).select("id").single();
        if (insErr) throw insErr;

        setState((s) => ({ ...s, items: s.items.map((x, idx) => (idx === i ? { ...x, status: "done", productId: product.id } : x)) }));
        onProductSaved?.();
      } catch (err: any) {
        setState((s) => ({ ...s, items: s.items.map((x, idx) => (idx === i ? { ...x, status: "error", error: err?.message ?? "Failed" } : x)) }));
      }
      done++;
      setState((s) => ({ ...s, done }));
    }

    setState((s) => ({ ...s, running: false, finishedAt: Date.now() }));
    toast.success(`Bulk import finished · ${done}/${queue.length} processed`);
  }, [state.running]);

  // Warn user before leaving while a job is running
  useEffect(() => {
    if (!state.running) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.running]);

  const value = useMemo(() => ({ state, start, dismiss, updateItem, setItems }), [state, start, dismiss, updateItem, setItems]);

  return <ImportJobContext.Provider value={value}>{children}</ImportJobContext.Provider>;
}

export function useImportJob() {
  const ctx = useContext(ImportJobContext);
  if (!ctx) throw new Error("useImportJob must be used inside ImportJobProvider");
  return ctx;
}

export { applyMarkup };
