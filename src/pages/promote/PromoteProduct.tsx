import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, Download, MessageCircle, Facebook, Twitter, Send, Check, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { commissionPerUnit, mapProduct, type Product } from "@/data/products";
import { usePromoterProfile, usePromotionLink } from "@/hooks/usePromote";
import {
  channelShareUrl, copyToClipboard, money, shareMessage, shareUrlForCode, type ShareChannel,
} from "@/lib/promote";
import { downloadAdCreative } from "@/lib/adCreative";
import PromoterAdStudio from "@/components/promote/PromoterAdStudio";

const sb = supabase as any;

const CHANNELS: { key: ShareChannel; label: string; icon: any; className: string }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, className: "bg-[hsl(142_70%_40%)] text-white" },
  { key: "facebook", label: "Facebook", icon: Facebook, className: "bg-[hsl(221_44%_41%)] text-white" },
  { key: "x", label: "X", icon: Twitter, className: "bg-foreground text-background" },
  { key: "telegram", label: "Telegram", icon: Send, className: "bg-[hsl(200_80%_45%)] text-white" },
];

export default function PromoteProduct() {
  const { id } = useParams();
  const { profile } = usePromoterProfile();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["promote-product", id],
    enabled: !!id,
    queryFn: async (): Promise<Product | null> => {
      const { data } = await sb
        .from("products")
        .select("*, suppliers(name, verified, gold, country, city, location_address, latitude, longitude, trade_type, email)")
        .eq("id", id)
        .maybeSingle();
      return data ? mapProduct(data) : null;
    },
  });

  const linkQuery = usePromotionLink(id, "link");
  const link = linkQuery.data;
  const url = link ? shareUrlForCode(link.code) : "";
  const per = product ? commissionPerUnit(product) : 0;
  const text = product ? shareMessage({ title: product.title, price: product.price, originalPrice: product.originalPrice, url }) : "";

  const share = async (channel: ShareChannel) => {
    if (!url) return;
    const target = channelShareUrl(channel, text, url);
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    if (!url) return;
    const ok = await copyToClipboard(text);
    if (!ok) return toast.error("Could not copy — long-press the link to copy it.");
    setCopied(true);
    toast.success("Link and message copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = async () => {
    if (!product) return;
    setDownloading(true);
    try {
      await downloadAdCreative(
        {
          headline: product.title,
          subhead: "Shop it on PUBSTORE",
          badge: product.originalPrice && product.originalPrice > product.price ? "Deal" : null,
          cta: "Shop now",
          price: product.price,
          originalPrice: product.originalPrice ?? null,
          imageUrl: product.image,
          imageUrls: product.gallery ?? null,
          format: "square",
          style: { layout: "product-card" },
        },
        `pubstore-${product.id}.png`,
      );
      toast.success("Image saved — share it with your link");
    } catch {
      toast.error("Could not create the image. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!product) return <div className="p-6 text-sm text-muted-foreground">Product not found.</div>;

  const linkError = (linkQuery.error as any)?.message as string | undefined;

  return (
    <div className="pb-28 lg:pb-10 max-w-3xl mx-auto">
      <header className="px-4 pt-4 pb-3 flex items-center gap-2">
        <Link to="/promote" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-extrabold text-lg">Promote this product</h1>
      </header>

      <div className="px-4 space-y-4">
        <div className="rounded-3xl border bg-card overflow-hidden">
          <div className="flex gap-3 p-3">
            <img src={product.image} alt={product.title} className="w-24 h-24 rounded-2xl object-cover bg-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold line-clamp-2">{product.title}</p>
              <p className="text-lg font-extrabold mt-1">{money(product.price)}</p>
              <Link to={`/product/${product.id}`} className="text-xs font-bold text-primary">View product</Link>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t divide-x text-center">
            <div className="p-3">
              <p className="text-[11px] text-muted-foreground">Commission</p>
              <p className="text-sm font-bold">
                {product.commissionType === "fixed" ? money(product.commissionValue ?? 0) : `${product.commissionValue ?? 0}%`}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[11px] text-muted-foreground">You earn per sale</p>
              <p className="text-sm font-bold text-primary">{money(per)}</p>
            </div>
            <div className="p-3">
              <p className="text-[11px] text-muted-foreground">Available after</p>
              <p className="text-sm font-bold">{product.commissionReleaseDays ?? 7} days</p>
            </div>
          </div>
        </div>

        {profile?.frozen ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Your promoter account is on hold, so new links are paused.
          </div>
        ) : linkError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{linkError}</div>
        ) : (
          <>
            <div className="rounded-3xl border bg-card p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-muted px-3 py-2.5 text-xs font-mono">
                  {linkQuery.isLoading ? "Creating your link…" : url}
                </code>
                <Button size="icon" variant="secondary" onClick={copy} disabled={!url} aria-label="Copy link">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Anyone who buys within 7 days of clicking your link earns you {money(per)} per item.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">Share</p>
              <Button
                onClick={() => share("whatsapp")}
                disabled={!url}
                className="w-full h-14 rounded-2xl text-base font-extrabold bg-[hsl(142_70%_40%)] hover:bg-[hsl(142_70%_35%)] text-white"
              >
                <MessageCircle className="w-5 h-5 mr-2" /> Share on WhatsApp
              </Button>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.filter((c) => c.key !== "whatsapp").map((c) => (
                  <button
                    key={c.key}
                    onClick={() => share(c.key)}
                    disabled={!url}
                    className={`h-12 rounded-2xl text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${c.className}`}
                  >
                    <c.icon className="w-4 h-4" /> {c.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-12 rounded-2xl font-bold" onClick={copy} disabled={!url}>
                  <Copy className="w-4 h-4 mr-2" /> Copy for Instagram / TikTok
                </Button>
                <Button variant="secondary" className="h-12 rounded-2xl font-bold" onClick={downloadImage} disabled={downloading}>
                  {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download image
                </Button>
              </div>
            </div>

            <PromoterAdStudio product={product} />

            <div className="rounded-2xl border bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
              Share honestly: use the real price and photos shown here, never claim to be PUBSTORE or the seller, and don't spam.
              Buying through your own link earns nothing, and commissions are reversed if the order is refunded.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
