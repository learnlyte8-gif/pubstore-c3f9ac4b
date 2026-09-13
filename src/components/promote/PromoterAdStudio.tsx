import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Film, Loader2, Move, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  adCreativeDataUrl, downloadAdCreative, type AdCreative, type AdOffsets, type AdStyle,
} from "@/lib/adCreative";
import { downloadAdVideo } from "@/lib/adVideo";
import AdLayoutEditor from "@/components/admin/AdLayoutEditor";
import type { Product } from "@/data/products";

const sb = supabase as any;

type Template = {
  id: string;
  name: string;
  format: "square" | "vertical";
  style: AdStyle;
};

const field =
  "w-full h-10 rounded-xl border bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-primary/30";

const LENGTHS = [5, 8, 15, 30, 60, 120];

/**
 * The same ad engine the admin studio uses, scoped to one product so promoters
 * can design a post or reel for the product they are sharing and download it.
 */
export default function PromoterAdStudio({ product }: { product: Product }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [format, setFormat] = useState<"square" | "vertical">("square");
  const [headline, setHeadline] = useState(product.title);
  const [subhead, setSubhead] = useState("Shop it on PUBSTORE");
  const [badge, setBadge] = useState(
    product.originalPrice && product.originalPrice > product.price ? "Deal" : "New",
  );
  const [cta, setCta] = useState("Shop now");
  const [price, setPrice] = useState<string>(String(product.price ?? ""));
  const [originalPrice, setOriginalPrice] = useState<string>(
    product.originalPrice ? String(product.originalPrice) : "",
  );
  const [offsets, setOffsets] = useState<AdOffsets>({});
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(8);

  useEffect(() => {
    sb.from("ad_templates")
      .select("id, name, format, style")
      .eq("active", true)
      .order("name")
      .then(({ data }: any) => {
        const list = (data ?? []) as Template[];
        setTemplates(list);
        if (list[0]) {
          setTemplateId(list[0].id);
          setFormat(list[0].format);
        }
      });
  }, []);

  const template = templates.find((t) => t.id === templateId);

  const creative: AdCreative = useMemo(
    () => ({
      headline,
      subhead,
      badge: badge || null,
      cta,
      price: price === "" ? product.price : Number(price),
      originalPrice: originalPrice === "" ? null : Number(originalPrice),
      imageUrl: product.image,
      imageUrls: [product.image, ...(product.gallery ?? [])].filter(Boolean) as string[],
      format,
      style: template?.style ?? { layout: "product-card" },
      offsets,
    }),
    [headline, subhead, badge, cta, price, originalPrice, product, format, template, offsets],
  );

  useEffect(() => {
    let alive = true;
    setRendering(true);
    adCreativeDataUrl(creative)
      .then((url) => { if (alive) { setPreview(url); setRendering(false); } })
      .catch(() => { if (alive) setRendering(false); });
    return () => { alive = false; };
  }, [creative]);

  const saveImage = async () => {
    setBusy(true);
    try {
      await downloadAdCreative(creative, `pubstore-${format}-${product.id.slice(0, 8)}.png`);
      toast.success("Image saved — post it with your link");
    } catch {
      toast.error("Could not create the image. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveVideo = async () => {
    setBusy(true);
    try {
      await downloadAdVideo(creative, `pubstore-${format}-${product.id.slice(0, 8)}`, { seconds });
      toast.success("Video saved — post it with your link");
    } catch (e) {
      toast.error((e as Error).message || "Could not create the video.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border bg-card p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" /> Make an ad
      </p>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,300px)_1fr] items-start">
        <div className="w-full max-w-[360px] mx-auto sm:mx-0 space-y-2">
          {editing ? (
            <AdLayoutEditor creative={creative} offsets={offsets} onChange={setOffsets} />
          ) : (
            <div className="rounded-2xl overflow-hidden border bg-muted">
              {rendering ? (
                <div className="aspect-square flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : preview ? (
                <img src={preview} alt="Ad preview" className="w-full" />
              ) : (
                <div className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground">
                  No preview
                </div>
              )}
            </div>
          )}
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            className="w-full rounded-xl"
            onClick={() => setEditing((v) => !v)}
          >
            <Move className="w-3.5 h-3.5 mr-1" /> {editing ? "Done moving" : "Move things around"}
          </Button>
        </div>

        <div className="space-y-2 min-w-0">
          <select
            className={field}
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templates.find((x) => x.id === e.target.value);
              if (t) setFormat(t.format);
            }}
          >
            {templates.length === 0 && <option value="">Loading designs…</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.format === "vertical" ? "reel" : "post"}</option>
            ))}
          </select>
          <select className={field} value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="square">Square post</option>
            <option value="vertical">Vertical reel</option>
          </select>
          <input className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" />
          <input className={field} value={subhead} onChange={(e) => setSubhead(e.target.value)} placeholder="Subhead" />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge" />
            <input className={field} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Button text" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={field}
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price on image"
            />
            <input
              className={field}
              type="number"
              step="0.01"
              min="0"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="Was price"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Keep the real price and photos — honest ads convert better and keep your account in good standing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-12 rounded-2xl font-bold" onClick={saveImage} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Download image
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 h-12 rounded-2xl font-bold" onClick={saveVideo} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
            Video
          </Button>
          <select
            className="h-12 rounded-2xl border bg-background px-2 text-[12px] font-bold"
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            aria-label="Video length"
          >
            {LENGTHS.map((s) => (
              <option key={s} value={s}>{s < 60 ? `${s}s` : `${s / 60}m`}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
