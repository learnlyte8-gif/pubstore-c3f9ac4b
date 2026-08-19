import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download, X, Check, AlertCircle } from "lucide-react";
import CircleSpinner from "@/components/CircleSpinner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchMySupplier } from "@/data/products";
import { toast } from "sonner";

export type ParsedRow = {
  title: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  moq: number;
  unit: string;
  lead_time: string | null;
  ship_from: string | null;
  category_slug: string | null;
  free_shipping: boolean;
  video_url: string | null;
  images: string[];
  status: "pending" | "saving" | "done" | "error";
  error?: string;
};

// Accept many spellings for each column so people can use their own sheets.
const ALIASES: Record<string, string[]> = {
  title: ["title", "name", "product", "product name", "product_title"],
  description: ["description", "desc", "details", "body", "about"],
  price: ["price", "sale price", "our price", "selling price", "amount"],
  original_price: ["original price", "original_price", "compare price", "compare_at_price", "was price", "rrp", "msrp"],
  moq: ["moq", "min order", "minimum order", "min_qty"],
  unit: ["unit", "units", "uom"],
  lead_time: ["lead time", "lead_time", "shipping time", "delivery time"],
  ship_from: ["ship from", "ship_from", "origin", "location", "country"],
  category_slug: ["category", "category slug", "category_slug", "cat"],
  free_shipping: ["free shipping", "free_shipping", "freeshipping"],
  video_url: ["video", "video url", "video_url", "videos", "video link"],
  images: ["image", "images", "image url", "imageurl", "imageurls", "image urls", "image_urls", "photos", "gallery", "picture", "pictures"],
};

function normalizeKey(raw: string) {
  const k = String(raw || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  for (const [field, list] of Object.entries(ALIASES)) {
    if (list.includes(k)) return field;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

function splitUrls(v: unknown): string[] {
  if (v == null) return [];
  return String(v)
    .split(/[\n,;|]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 8);
}

export function rowsFromSheet(records: Record<string, unknown>[]): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const rec of records) {
    const mapped: Record<string, unknown> = {};
    const extraImages: string[] = [];
    for (const [rawKey, value] of Object.entries(rec)) {
      const field = normalizeKey(rawKey);
      if (field === "images") {
        extraImages.push(...splitUrls(value));
      } else if (field) {
        if (mapped[field] == null || mapped[field] === "") mapped[field] = value;
      } else if (/^image\s*\d+$/i.test(rawKey.trim())) {
        extraImages.push(...splitUrls(value));
      }
    }
    const title = String(mapped.title ?? "").trim();
    if (!title) continue;
    out.push({
      title: title.slice(0, 200),
      description: mapped.description ? String(mapped.description).slice(0, 4000) : null,
      price: toNumber(mapped.price),
      original_price: toNumber(mapped.original_price),
      moq: toNumber(mapped.moq) ?? 1,
      unit: mapped.unit ? String(mapped.unit) : "piece",
      lead_time: mapped.lead_time ? String(mapped.lead_time) : null,
      ship_from: mapped.ship_from ? String(mapped.ship_from) : null,
      category_slug: mapped.category_slug ? String(mapped.category_slug).trim().toLowerCase() : null,
      free_shipping: toBool(mapped.free_shipping),
      video_url: mapped.video_url && /^https?:\/\//i.test(String(mapped.video_url).trim())
        ? String(mapped.video_url).trim()
        : null,
      images: Array.from(new Set(extraImages)),
      status: "pending",
    });
  }
  return out;
}

const TEMPLATE_HEADERS = [
  "title", "description", "price", "original_price", "moq", "unit",
  "lead_time", "ship_from", "category_slug", "free_shipping", "video_url", "image_urls",
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    [
      "Wireless earbuds Pro", "Bluetooth 5.3, 40h battery", 24.99, 39.99, 1, "piece",
      "7-15 days", "Zimbabwe", "electronics", "yes", "https://example.com/demo.mp4",
      "https://example.com/a.jpg, https://example.com/b.jpg",
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.writeFile(wb, "pubstore-product-import-template.xlsx");
}

export default function ExcelProductImport({ onDone }: { onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const addImages = (index: number) => {
    const raw = drafts[index];
    if (!raw?.trim()) return;
    const urls = splitUrls(raw);
    setDrafts((p) => ({ ...p, [index]: "" }));
    if (!urls.length) {
      toast.error("Enter a valid http(s) image URL");
      return;
    }
    setRows((p) =>
      p.map((x, i) =>
        i === index ? { ...x, images: Array.from(new Set([...x.images, ...urls])).slice(0, 8) } : x
      )
    );
  };

  const removeImage = (index: number, imgIdx: number) => {
    setRows((p) =>
      p.map((x, i) => (i === index ? { ...x, images: x.images.filter((_, k) => k !== imgIdx) } : x))
    );
  };


  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = rowsFromSheet(records);
      if (!parsed.length) {
        toast.error("No usable rows found — make sure there is a 'title' column");
      } else {
        toast.success(`${parsed.length} product(s) ready to import`);
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read that file");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const importAll = async () => {
    const queue = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.status === "pending" || r.status === "error");
    if (!queue.length) return;
    setBusy(true);
    try {
      const supplier = await fetchMySupplier();
      if (!supplier) { toast.error("Create your store first"); return; }

      let ok = 0;
      for (const { r, i } of queue) {
        setRows((p) => p.map((x, idx) => (idx === i ? { ...x, status: "saving", error: undefined } : x)));
        const { error } = await supabase.from("products").insert({
          supplier_id: supplier.id,
          title: r.title,
          description: r.description,
          image: r.images[0] ?? null,
          gallery: r.images,
          video_url: r.video_url,
          price: r.price ?? 0,
          original_price: r.original_price,
          moq: r.moq,
          unit: r.unit,
          lead_time: r.lead_time,
          ship_from: r.ship_from ?? supplier.country ?? null,
          category_slug: r.category_slug,
          free_shipping: r.free_shipping,
          active: r.price != null && r.price > 0,
        });
        if (error) {
          setRows((p) => p.map((x, idx) => (idx === i ? { ...x, status: "error", error: error.message } : x)));
        } else {
          ok++;
          setRows((p) => p.map((x, idx) => (idx === i ? { ...x, status: "done" } : x)));
        }
      }
      toast.success(`Imported ${ok}/${queue.length} product(s)`);
      if (ok) onDone?.();
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Import from Excel / CSV</p>
          <p className="text-[11px] text-muted-foreground">
            Bulk-add products with image URLs, video links, prices and categories.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-10" disabled={parsing} onClick={() => fileRef.current?.click()}>
          {parsing ? <><CircleSpinner size={14} className="mr-2" /> Reading…</> : <><FileSpreadsheet className="w-4 h-4 mr-1.5" /> Choose file</>}
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1.5" /> Template
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground truncate">{fileName} · {rows.length} row(s)</p>
            <button type="button" className="text-[11px] font-bold text-muted-foreground" onClick={() => { setRows([]); setFileName(""); }}>
              Clear
            </button>
          </div>

          <div className="max-h-[26rem] overflow-auto rounded-xl border divide-y">
            {rows.map((r, i) => (
              <div key={i} className="p-2 space-y-2">
                <div className="flex items-center gap-2">
                  {r.images[0] ? (
                    <img src={r.images[0]} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.price != null ? `$${r.price.toFixed(2)}` : "no price → draft"}
                      {r.category_slug ? ` · ${r.category_slug}` : ""}
                      {r.images.length ? ` · ${r.images.length} image(s)` : " · no images"}
                      {r.video_url ? " · video" : ""}
                    </p>
                    {r.error && <p className="text-[10px] text-destructive truncate">{r.error}</p>}
                  </div>
                  <span className="shrink-0">
                    {r.status === "saving" && <CircleSpinner size={14} />}
                    {r.status === "done" && <Check className="w-4 h-4 text-emerald-600" />}
                    {r.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                    {r.status === "pending" && <X className="w-3.5 h-3.5 text-muted-foreground opacity-0" />}
                  </span>
                </div>

                {r.status !== "done" && (
                  <div className="pl-12 space-y-1.5">
                    {r.images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.images.map((url, imgIdx) => (
                          <span key={url + imgIdx} className="relative group">
                            <img src={url} alt="" loading="lazy" className="w-9 h-9 rounded-md object-cover bg-muted border" />
                            <button
                              type="button"
                              aria-label="Remove image"
                              onClick={() => removeImage(i, imgIdx)}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background border flex items-center justify-center shadow-sm"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      value={drafts[i] ?? ""}
                      onChange={(e) => setDrafts((p) => ({ ...p, [i]: e.target.value }))}
                      onBlur={() => addImages(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addImages(i); }
                      }}
                      placeholder="Paste image URL(s) — comma or newline separated"
                      className="w-full h-8 px-2.5 rounded-lg border bg-background text-[11px]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>


          <Button type="button" className="w-full h-11" disabled={busy || !rows.some((r) => r.status !== "done")} onClick={importAll}>
            {busy ? <><CircleSpinner size={14} className="mr-2" /> Importing…</> : `Import ${pending || rows.filter((r) => r.status === "error").length} product(s)`}
          </Button>
        </>
      )}
    </div>
  );
}
