import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Plus, Trash2, Download, Copy, Upload, Loader2, Image as ImageIcon,
  Film, Check, Search, Link2, Move,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConsolePage, Card, Field, SkeletonList, Empty, StatusBadge, fmt } from "@/components/admin/ui";
import { aiFunctionHeaders } from "@/lib/aiAuth";
import { ensureUploadIdentity } from "@/lib/uploadAuth";
import { adCreativeDataUrl, downloadAdCreative, type AdStyle, type AdOffsets } from "@/lib/adCreative";
import AdLayoutEditor from "@/components/admin/AdLayoutEditor";
import { downloadAdVideo } from "@/lib/adVideo";

const sb = supabase as any;

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "pinterest", label: "Pinterest" },
  { id: "threads", label: "Threads" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

const TABS = ["Ads", "Create", "Templates", "Media library", "Accounts"] as const;
type Tab = (typeof TABS)[number];

type Template = {
  id: string; name: string; format: "square" | "vertical"; description: string | null;
  caption_prompt: string | null; style: AdStyle; active: boolean;
};
type Ad = {
  id: string; product_id: string | null; template_id: string | null;
  format: "square" | "vertical"; status: string;
  headline: string | null; subhead: string | null; badge: string | null;
  caption: string | null; hashtags: string[]; cta: string | null;
  image_url: string | null; image_urls: string[]; video_url: string | null;
  price: number | null; original_price: number | null;
  layout: AdOffsets | null;
  platforms: string[]; scheduled_at: string | null; created_at: string;
};
type Product = { id: string; title: string; price: number | null; original_price: number | null; image: string | null; gallery: string[] | null; video_url: string | null };
type MediaItem = { id: string; kind: string; url: string; title: string | null; tags: string[]; created_at: string };
type Account = { id: string; platform: string; username: string; display_name: string | null; profile_url: string | null; active: boolean };

const input =
  "w-full h-9 rounded-md border bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-primary/30";
const area =
  "w-full rounded-md border bg-background p-3 text-[13px] outline-none focus:ring-2 focus:ring-primary/30";

export default function SocialAdsPanel() {
  const [tab, setTab] = useState<Tab>("Ads");

  return (
    <ConsolePage
      title="Social ad studio"
      description="Generate ads from your products, keep reusable media and templates, then download ready-to-post creatives for TikTok, Instagram and more."
    >
      <div className="flex gap-1 overflow-x-auto mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 h-8 rounded-full text-[12px] font-medium border whitespace-nowrap ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Ads" && <AdsList />}
      {tab === "Create" && <CreateAds onDone={() => setTab("Ads")} />}
      {tab === "Templates" && <Templates />}
      {tab === "Media library" && <MediaLibrary />}
      {tab === "Accounts" && <Accounts />}
    </ConsolePage>
  );
}

/* ------------------------------------------------------------------ Create */

function CreateAds({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram"]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = sb.from("products").select("id, title, price, original_price, image, gallery, video_url").eq("active", true).order("created_at", { ascending: false }).limit(60);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    const { data } = await query;
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [q]);
  useEffect(() => {
    sb.from("ad_templates").select("*").eq("active", true).order("format").then(({ data }: any) => {
      setTemplates((data ?? []) as Template[]);
      if (data?.[0]) setTemplateId(data[0].id);
    });
  }, []);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 10 ? (toast.error("Up to 10 products at a time"), p) : [...p, id]));

  const generate = async () => {
    if (picked.length === 0) return toast.error("Pick at least one product");
    if (platforms.length === 0) return toast.error("Pick at least one platform");
    setBusy(true);
    try {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate-social-ad`,
        {
          method: "POST",
          headers: await aiFunctionHeaders(),
          body: JSON.stringify({ productIds: picked, templateId: templateId || null, platforms }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not generate the ads");
      toast.success(`${body.ads?.length ?? 0} ad${body.ads?.length === 1 ? "" : "s"} created`);
      setPicked([]);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Template">
            <select className={input} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.format}</option>
              ))}
            </select>
          </Field>
          <Field label="Platforms">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatforms((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={`px-2.5 h-7 rounded-full text-[11px] font-medium border ${
                    platforms.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input className={`${input} pl-8`} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button onClick={generate} disabled={busy || picked.length === 0}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Generate {picked.length > 0 ? `(${picked.length})` : ""}
          </Button>
        </div>
      </Card>

      {loading ? (
        <SkeletonList />
      ) : products.length === 0 ? (
        <Empty label="No products found" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {products.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`text-left rounded-xl border bg-card overflow-hidden shadow-sm transition ${on ? "ring-2 ring-primary border-primary" : "hover:bg-muted/40"}`}
              >
                <div className="relative aspect-square bg-muted">
                  {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}
                  {on && (
                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {p.video_url && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-background/85 text-[9px] font-bold inline-flex items-center gap-1">
                      <Film className="w-2.5 h-2.5" /> video
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[12px] font-medium line-clamp-2">{p.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{fmt(Number(p.price ?? 0))}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- Ads */

function AdsList() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: adRows }, { data: tpl }] = await Promise.all([
      sb.from("social_ads").select("*").order("created_at", { ascending: false }).limit(120),
      sb.from("ad_templates").select("*"),
    ]);
    const list = (adRows ?? []) as Ad[];
    setAds(list);
    setTemplates((tpl ?? []) as Template[]);
    const ids = Array.from(new Set(list.map((a) => a.product_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: prods } = await sb.from("products").select("id, title, price, original_price, image, gallery, video_url").in("id", ids);
      const map: Record<string, Product> = {};
      for (const p of prods ?? []) map[p.id] = p as Product;
      setProducts(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (filter === "all" ? ads : ads.filter((a) => a.status === filter)), [ads, filter]);

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {["all", "draft", "ready", "posted", "archived"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 h-7 rounded-full text-[12px] font-medium border capitalize ${
              filter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-[12px] font-medium px-2 h-7 rounded-md hover:bg-muted">Refresh</button>
      </div>

      {shown.length === 0 ? (
        <Empty label="No ads yet — use the Create tab to generate some from your products." />
      ) : (
        <div className="grid gap-4 grid-cols-1">
          {shown.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              product={ad.product_id ? products[ad.product_id] : undefined}
              template={templates.find((t) => t.id === ad.template_id)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdCard({ ad, product, template, onChanged }: { ad: Ad; product?: Product; template?: Template; onChanged: () => void }) {
  const [draft, setDraft] = useState(ad);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [makingVideo, setMakingVideo] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(8);
  const [editingLayout, setEditingLayout] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    sb.from("social_accounts").select("*").eq("active", true).then(({ data }: any) => setAccounts((data ?? []) as Account[]));
  }, []);

  const creative = useMemo(
    () => ({
      headline: draft.headline,
      subhead: draft.subhead,
      badge: draft.badge,
      cta: draft.cta,
      price: draft.price ?? product?.price ?? null,
      originalPrice: draft.original_price ?? product?.original_price ?? null,
      imageUrl: draft.image_url,
      imageUrls: draft.image_urls?.length
        ? draft.image_urls
        : [draft.image_url, product?.image, ...(product?.gallery ?? [])].filter((url): url is string => Boolean(url)),
      format: draft.format,
      style: template?.style ?? {},
      offsets: draft.layout ?? {},
    }),
    [draft, product, template],
  );

  useEffect(() => {
    let alive = true;
    setRendering(true);
    adCreativeDataUrl(creative)
      .then((url) => { if (alive) { setPreview(url); setRendering(false); } })
      .catch(() => { if (alive) setRendering(false); });
    return () => { alive = false; };
  }, [creative]);

  const save = async (patch: Partial<Ad> = {}) => {
    setSaving(true);
    const next = { ...draft, ...patch };
    const { error } = await sb.from("social_ads").update({
      headline: next.headline, subhead: next.subhead, badge: next.badge,
      caption: next.caption, cta: next.cta, hashtags: next.hashtags,
      status: next.status, platforms: next.platforms, scheduled_at: next.scheduled_at,
      image_url: next.image_url, image_urls: next.image_urls, format: next.format,
      price: next.price, original_price: next.original_price,
      layout: next.layout ?? {},
    } as any).eq("id", ad.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDraft(next);
    toast.success("Ad saved");
    onChanged();
  };

  const remove = async () => {
    const { error } = await sb.from("social_ads").delete().eq("id", ad.id);
    if (error) return toast.error(error.message);
    toast.success("Ad deleted");
    onChanged();
  };

  const captionBlock = [draft.caption ?? "", (draft.hashtags ?? []).map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");

  return (
    <Card className="p-4 space-y-3">
      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] items-start">
        <div className="w-full max-w-[420px] mx-auto md:mx-0 space-y-2">
          {editingLayout ? (
            <AdLayoutEditor
              creative={creative}
              offsets={draft.layout ?? {}}
              onChange={(next) => setDraft({ ...draft, layout: next })}
            />
          ) : (
            <div className="rounded-xl overflow-hidden border bg-muted">
              {rendering ? (
                <div className="aspect-square flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : preview ? (
                <a href={preview} target="_blank" rel="noreferrer" title="Open full size">
                  <img src={preview} alt="Ad preview" className="w-full" />
                </a>
              ) : (
                <div className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground">No preview</div>
              )}
            </div>
          )}
          <Button size="sm" variant={editingLayout ? "default" : "outline"} className="w-full" onClick={() => setEditingLayout((v) => !v)}>
            <Move className="w-3.5 h-3.5 mr-1" /> {editingLayout ? "Done moving" : "Move things around"}
          </Button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={draft.status} />
            <span className="text-[11px] text-muted-foreground">{template?.name ?? draft.format}</span>
            <button onClick={remove} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Delete ad">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[13px] font-medium line-clamp-1">{product?.title ?? "No product"}</p>
          <input className={input} value={draft.headline ?? ""} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="Headline" />
          <input className={input} value={draft.subhead ?? ""} onChange={(e) => setDraft({ ...draft, subhead: e.target.value })} placeholder="Subhead" />
          <div className="grid grid-cols-3 gap-2">
            <input className={input} value={draft.badge ?? ""} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="Badge" />
            <input className={input} value={draft.cta ?? ""} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} placeholder="Button text" />
            <select className={input} value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as any })}>
              <option value="square">Square post</option>
              <option value="vertical">Vertical reel</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={input}
              type="number"
              step="0.01"
              min="0"
              value={draft.price ?? ""}
              onChange={(e) => setDraft({ ...draft, price: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder={`Price on image${product?.price != null ? ` (product ${fmt(Number(product.price))})` : ""}`}
            />
            <input
              className={input}
              type="number"
              step="0.01"
              min="0"
              value={draft.original_price ?? ""}
              onChange={(e) => setDraft({ ...draft, original_price: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="Was price (crossed out)"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Leave the prices empty to use the product price.</p>
        </div>
      </div>


      <textarea className={area} rows={4} value={draft.caption ?? ""} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} placeholder="Caption" />
      <input
        className={input}
        value={(draft.hashtags ?? []).join(" ")}
        onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean) })}
        placeholder="hashtags separated by spaces"
      />

      <div className="flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setDraft({ ...draft, platforms: draft.platforms.includes(p.id) ? draft.platforms.filter((x) => x !== p.id) : [...draft.platforms, p.id] })}
            className={`px-2.5 h-7 rounded-full text-[11px] font-medium border ${
              draft.platforms.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {accounts.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Posting as: {accounts.filter((a) => draft.platforms.includes(a.platform)).map((a) => `@${a.username}`).join(", ") || "no matching account linked"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => save()} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => save({ status: draft.status === "ready" ? "draft" : "ready" })}>
          {draft.status === "ready" ? "Back to draft" : "Mark ready"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadAdCreative(creative, `pubstore-${draft.format}-${ad.id.slice(0, 8)}.png`)}
        >
          <Download className="w-3.5 h-3.5 mr-1" /> Download image
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={makingVideo}
          onClick={async () => {
            setMakingVideo(true);
            try {
              await downloadAdVideo(creative, `pubstore-${draft.format}-${ad.id.slice(0, 8)}`, { seconds: videoSeconds });
              toast.success("Video downloaded");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setMakingVideo(false);
            }
          }}
        >
          {makingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Film className="w-3.5 h-3.5 mr-1" />}
          {makingVideo ? `Recording ${videoSeconds}s…` : "Make video"}
        </Button>
        <select
          className="h-8 rounded-md border bg-background px-2 text-[12px]"
          value={videoSeconds}
          disabled={makingVideo}
          onChange={(e) => setVideoSeconds(Number(e.target.value))}
          aria-label="Video length"
        >
          {[5, 8, 15, 30, 45, 60, 90, 120].map((sec) => (
            <option key={sec} value={sec}>{sec < 60 ? `${sec}s` : `${sec / 60}m`}</option>
          ))}
        </select>
        <Button

          size="sm"
          variant="outline"
          onClick={() => { navigator.clipboard.writeText(captionBlock); toast.success("Caption copied"); }}
        >
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy caption
        </Button>
        {draft.video_url && (
          <a href={draft.video_url} target="_blank" rel="noreferrer" className="text-[12px] font-medium inline-flex items-center gap-1 px-2 h-8 rounded-md hover:bg-muted">
            <Film className="w-3.5 h-3.5" /> Product video
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={() => save({ status: "posted" })}>Mark posted</Button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- Templates */

function Templates() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", format: "square", layout: "deal", description: "", caption_prompt: "", bg: "#0f172a", accent: "#22c55e", text: "#ffffff" });
  const [sampleImages, setSampleImages] = useState<string[]>([]);

  useEffect(() => {
    sb.from("products").select("image").eq("active", true).not("image", "is", null).limit(6)
      .then(({ data }: any) => setSampleImages(((data ?? []) as { image: string }[]).map((r) => r.image)));
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("ad_templates").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Template[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name the template");
    const { error } = await sb.from("ad_templates").insert({
      name: form.name.trim(),
      format: form.format,
      description: form.description || null,
      caption_prompt: form.caption_prompt || null,
      style: { bg: form.bg, accent: form.accent, text: form.text, layout: form.layout },
    });
    if (error) return toast.error(error.message);
    setForm({ ...form, name: "", description: "", caption_prompt: "" });
    toast.success("Template added");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("ad_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name"><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Flash sale — vertical" /></Field>
          <Field label="Format">
            <select className={input} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="square">Square post (1:1)</option>
              <option value="vertical">Vertical reel (9:16)</option>
            </select>
          </Field>
          <Field label="Layout">
            <select className={input} value={form.layout} onChange={(e) => setForm({ ...form, layout: e.target.value })}>
              <option value="deal">Bold deal</option>
              <option value="clean">Clean product</option>
              <option value="hero-five">One image + five</option>
              <option value="staggered">Staggered gallery</option>
              <option value="marketplace">Marketplace wholesale</option>
              <option value="catalog">Pubstore catalog grid</option>
            </select>
          </Field>
        </div>
        <Field label="Description"><input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the creative looks like" /></Field>
        <Field label="Copy guidance"><input className={input} value={form.caption_prompt} onChange={(e) => setForm({ ...form, caption_prompt: e.target.value })} placeholder="Tone and angle for the caption" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Background"><input type="color" className="h-9 w-full rounded-md border bg-background" value={form.bg} onChange={(e) => setForm({ ...form, bg: e.target.value })} /></Field>
          <Field label="Accent"><input type="color" className="h-9 w-full rounded-md border bg-background" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} /></Field>
          <Field label="Text"><input type="color" className="h-9 w-full rounded-md border bg-background" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>
        </div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Add template</Button>
      </Card>

      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No templates yet" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="p-3 space-y-2">
              <TemplatePreview template={t} sampleImages={sampleImages} />
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{t.format === "vertical" ? "Vertical reel" : "Square post"} · {(t.style?.layout ?? "deal").replace(/-/g, " ")}</p>
                </div>
                <button onClick={() => remove(t.id)} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
              {t.description && <p className="text-[12px] text-muted-foreground line-clamp-2">{t.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatePreview({ template, sampleImages }: { template: Template; sampleImages: string[] }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adCreativeDataUrl({
      headline: "Wireless earbuds",
      subhead: "Compact picks · ready to ship",
      badge: "50% OFF",
      cta: "Shop now",
      price: 1.32,
      originalPrice: 2.64,
      imageUrls: sampleImages,
      format: template.format,
      style: template.style ?? {},
    })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, [template, sampleImages]);

  return (
    <div className="rounded-lg overflow-hidden border bg-muted">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size"><img src={url} alt={`${template.name} preview`} className="w-full" /></a>
      ) : (
        <div className="aspect-square flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Media library */

function MediaLibrary() {
  const [rows, setRows] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [urlForm, setUrlForm] = useState({ url: "", title: "", kind: "image", tags: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("ad_media_library").select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data ?? []) as MediaItem[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const insert = async (item: { url: string; kind: string; title?: string | null; tags?: string[]; bytes?: number | null }) => {
    const { error } = await sb.from("ad_media_library").insert({
      url: item.url, kind: item.kind, title: item.title ?? null, tags: item.tags ?? [], bytes: item.bytes ?? null,
    });
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const identity = await ensureUploadIdentity();
    if (identity.error) return toast.error(identity.error);
    setBusy(true);
    for (const file of Array.from(files).slice(0, 12)) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${identity.userId}/ad-media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
      if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
      const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      await insert({ url, kind: file.type.startsWith("video") ? "video" : "image", title: file.name, bytes: file.size });
    }
    setBusy(false);
    toast.success("Media added");
    load();
  };

  const addUrl = async () => {
    if (!/^https?:\/\//i.test(urlForm.url.trim())) return toast.error("Paste a full https link");
    const ok = await insert({
      url: urlForm.url.trim(),
      kind: urlForm.kind,
      title: urlForm.title || null,
      tags: urlForm.tags.split(/[\s,]+/).filter(Boolean),
    });
    if (ok) { setUrlForm({ url: "", title: "", kind: "image", tags: "" }); toast.success("Media added"); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("ad_media_library").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />} Upload files
          </Button>
          <span className="text-[12px] text-muted-foreground">Photos and videos you can reuse in any ad.</span>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />

        <div className="grid gap-2 sm:grid-cols-[1fr,150px,150px,auto]">
          <input className={input} placeholder="…or paste a media link" value={urlForm.url} onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })} />
          <input className={input} placeholder="Title" value={urlForm.title} onChange={(e) => setUrlForm({ ...urlForm, title: e.target.value })} />
          <select className={input} value={urlForm.kind} onChange={(e) => setUrlForm({ ...urlForm, kind: e.target.value })}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="logo">Logo</option>
            <option value="audio">Audio</option>
          </select>
          <Button variant="outline" onClick={addUrl}><Link2 className="w-4 h-4 mr-1" /> Add</Button>
        </div>
      </Card>

      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="Your media library is empty" /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {rows.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="relative aspect-square bg-muted">
                {m.kind === "video" ? (
                  <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <img src={m.url} alt={m.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
                )}
                <button onClick={() => remove(m.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/85 border flex items-center justify-center hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full bg-background/85 text-[9px] font-bold inline-flex items-center gap-1">
                  {m.kind === "video" ? <Film className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />} {m.kind}
                </span>
              </div>
              <div className="p-2">
                <p className="text-[11px] truncate">{m.title ?? "Untitled"}</p>
                <button
                  className="text-[11px] text-primary font-medium mt-0.5"
                  onClick={() => { navigator.clipboard.writeText(m.url); toast.success("Link copied"); }}
                >
                  Copy link
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Accounts */

function Accounts() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ platform: "tiktok", username: "", display_name: "", profile_url: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("social_accounts").select("*").order("platform");
    setRows((data ?? []) as Account[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const username = form.username.replace(/^@/, "").trim();
    if (!username) return toast.error("Enter the username");
    const { error } = await sb.from("social_accounts").insert({
      platform: form.platform,
      username,
      display_name: form.display_name || null,
      profile_url: form.profile_url || null,
    });
    if (error) return toast.error(/duplicate/i.test(error.message) ? "That account is already linked" : error.message);
    setForm({ platform: form.platform, username: "", display_name: "", profile_url: "" });
    toast.success("Account linked");
    load();
  };

  const toggle = async (a: Account) => {
    const { error } = await sb.from("social_accounts").update({ active: !a.active }).eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("social_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-[160px,1fr,1fr,auto]">
          <select className={input} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input className={input} placeholder="@username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className={input} placeholder="Profile link (optional)" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} />
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Link</Button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Linking an account records where each ad is meant to go. Ads are downloaded and posted by you — automatic posting needs an approved business API from each platform.
        </p>
      </Card>

      {loading ? <SkeletonList /> : rows.length === 0 ? <Empty label="No accounts linked yet" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <Card key={a.id} className="p-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center uppercase">
                {a.platform.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">@{a.username}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{a.platform}{a.active ? "" : " · paused"}</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => toggle(a)} className="text-[11px] font-medium px-2 h-7 rounded-md hover:bg-muted">
                  {a.active ? "Pause" : "Activate"}
                </button>
                <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
