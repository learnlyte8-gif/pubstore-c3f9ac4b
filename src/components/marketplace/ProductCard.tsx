import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Star, Plus, Truck, ShieldCheck, Award, Timer, Package, MapPin, Map as MapIcon, CreditCard, Smartphone, Wallet, Banknote, Send, Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { type Product, discountPct } from "@/data/products";
import { useShop } from "@/store/shop";
import { supabase } from "@/integrations/supabase/client";
import { useUserLocation, distanceKm, formatDistance } from "@/hooks/useUserLocation";
import { logProductClick } from "@/hooks/usePersonalizationLog";
import ShareToChatSheet from "@/components/chat/ShareToChatSheet";
import type { ChatAttachment } from "@/components/chat/AttachmentCard";
import InquiryGateDialog from "@/components/marketplace/InquiryGateDialog";
import { getInquiryStatus } from "@/lib/inquiryGate";
import visaLogo from "@/assets/payments/visa.svg";
import mastercardLogo from "@/assets/payments/mastercard.svg";
import paypalLogo from "@/assets/payments/paypal.svg";
import ecocashLogo from "@/assets/payments/ecocash.svg";

function PayLogo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        title={alt}
        className="inline-flex items-center justify-center h-4 px-1 rounded-sm bg-muted text-foreground/70 text-[8px] font-extrabold leading-none ring-1 ring-border"
      >
        {alt}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      title={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-4 w-auto object-contain bg-white rounded-sm p-0.5 ring-1 ring-border"
    />
  );
}

const fmtPrice = (n: number) => `$${n.toFixed(2)}`;
const fmtSold = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+ sold` : `${n} sold`;

// Estimate delivery date from a free-form lead time string like "3-5 days", "2 weeks", "24h".
function estimateDeliveryDate(leadTime?: string): { label: string; range: string } | null {
  if (!leadTime || leadTime === "—") return { label: "Delivery", range: deliveryRange(1, 7) };
  const s = leadTime.toLowerCase();
  const nums = s.match(/\d+/g)?.map(Number) ?? [];
  let minDays = nums[0] ?? 3;
  let maxDays = nums[1] ?? minDays + 4;
  if (/week/.test(s)) { minDays *= 7; maxDays *= 7; }
  else if (/month/.test(s)) { minDays *= 30; maxDays *= 30; }
  else if (/hour|hr|\bh\b/.test(s)) { minDays = 1; maxDays = 2; }
  return { label: "Delivery", range: deliveryRange(minDays, maxDays) };
}
function deliveryRange(minDays: number, maxDays: number): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const now = new Date();
  const a = new Date(now); a.setDate(now.getDate() + minDays);
  const b = new Date(now); b.setDate(now.getDate() + maxDays);
  return `${fmt(a)} – ${fmt(b)}`;
}

const pad = (n: number) => n.toString().padStart(2, "0");
function useDealCountdown(endsAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s, urgent: ms < 1000 * 60 * 60 };
}

const badgeStyle: Record<NonNullable<Product["badge"]>, string> = {
  Hot: "bg-destructive text-destructive-foreground",
  New: "bg-primary text-primary-foreground",
  Deal: "bg-foreground text-background",
  Top: "bg-amber-500 text-white",
};

interface Props {
  product: Product;
  variant?: "grid" | "compact";
}

export default function ProductCard({ product, variant = "grid" }: Props) {
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const liked = isWishlisted(product.id);
  const off = discountPct(product);
  const countdown = useDealCountdown(product.dealEndsAt);
  const userLoc = useUserLocation();
  const [shareOpen, setShareOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setBuyerId(data.user?.id ?? null));
  }, []);

  const shareAttachment: ChatAttachment = {
    kind: "product",
    id: product.id,
    title: product.title,
    image: product.image,
    price: product.price,
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareOpen(true);
  };
  // Hide internal "Imported · …" badges from public product cards.
  const displayBadge =
    product.badge && !/^imported/i.test(product.badge) ? product.badge : null;
  const supplierVerified = product.supplierVerified === true;
  const supplierGold = product.supplierGold === true;

  const rawShipFrom = product.shipFrom && product.shipFrom !== "—" ? product.shipFrom : null;
  const supplierLocLabel = product.supplierLocation || rawShipFrom;
  const distLabel =
    userLoc && product.supplierLat != null && product.supplierLng != null
      ? formatDistance(distanceKm(userLoc.lat, userLoc.lng, product.supplierLat, product.supplierLng))
      : null;

  const mapsUrl = (() => {
    if (product.supplierLat != null && product.supplierLng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${product.supplierLat},${product.supplierLng}`;
    }
    if (supplierLocLabel) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplierLocLabel)}`;
    }
    return null;
  })();

  const handleViewMap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mapsUrl) window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!buyerId) {
      setInquiryOpen(true);
      return;
    }
    const status = await getInquiryStatus(buyerId, product.id);
    if (status !== "approved") {
      setInquiryOpen(true);
      return;
    }
    addToCart(product.id, 1);
    toast.success("Added to cart", { description: product.title });
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to save items", { description: "Create a free account to like products." });
      return;
    }
    const wasLiked = liked;
    await toggleWishlist(product.id);
    if (wasLiked) toast("Removed from wishlist");
    else toast.success("Saved to wishlist", { description: product.title });
  };

  const images = (product.gallery && product.gallery.length > 0 ? product.gallery : [product.image]).filter(Boolean) as string[];
  const videoUrl = product.videoUrl ?? null;
  const isPlayableVideoFile = !!videoUrl && /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(videoUrl);
  const hasVideoBadge = !!videoUrl;
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (isPlayableVideoFile || images.length < 2) return;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % images.length), 2000);
    return () => clearInterval(t);
  }, [images.length, isPlayableVideoFile]);

  if (variant === "compact") {
    return (
      <>
      <Link to={`/product/${product.id}`} onClick={() => logProductClick(product, "card-compact")} className="shrink-0 w-36 group block">
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted shadow-card group-hover:shadow-elevated transition">
          {isPlayableVideoFile ? (
            <video
              src={videoUrl!}
              poster={images[0]}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={product.title}
                loading="lazy"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === slideIdx ? "opacity-100" : "opacity-0"}`}
              />
            ))
          )}
          {hasVideoBadge && !isPlayableVideoFile && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
              <span className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-4 h-4 fill-current text-foreground" />
              </span>
            </span>
          )}
          {off > 0 && (
            <span className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
              -{off}%
            </span>
          )}
          {product.adHasReel && (
            <span className={`absolute ${off > 0 ? "top-7" : "top-1.5"} left-1.5 inline-flex items-center gap-0.5 bg-gradient-to-r from-fuchsia-500 to-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse`}>
              <Sparkles className="w-2.5 h-2.5" /> Reel
            </span>
          )}


          {product.moq && product.moq > 1 && (
            <span className="absolute bottom-1.5 left-1.5 bg-background/90 backdrop-blur text-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-border inline-flex items-center gap-0.5">
              <Package className="w-2.5 h-2.5" />
              MOQ {product.moq}
            </span>
          )}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            <button
              onClick={handleShare}
              aria-label="Share"
              className="w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center active:scale-90 transition"
            >
              <Send className="w-3.5 h-3.5 text-foreground" />
            </button>
            <button
              onClick={handleLike}
              aria-label="Wishlist"
              className="w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center active:scale-90 transition"
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
            </button>
          </div>
          {countdown && (
            <span className={`absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center gap-0.5 tabular-nums ${countdown.urgent ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-foreground/85 text-background"}`}>
              <Timer className="w-3 h-3" />
              {countdown.h > 0 ? `${countdown.h}h ` : ""}{pad(countdown.m)}:{pad(countdown.s)}
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <p className="price text-[12px] text-destructive">
            {fmtPrice(product.price)}
            <span className="text-muted-foreground font-semibold">/{product.unit || "unit"}</span>
          </p>
          <p className="text-xs font-bold tracking-tight line-clamp-2 leading-snug mt-0.5">{product.title}</p>
          {(() => {
            const d = estimateDeliveryDate(product.leadTime);
            return d ? (
              <p className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-0.5">
                <Truck className="w-2.5 h-2.5" /> {d.range}
              </p>
            ) : null;
          })()}
          {(supplierLocLabel || distLabel) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-0.5 max-w-full">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{supplierLocLabel ?? "Nearby"}</span>
              {distLabel && <span className="font-semibold text-foreground shrink-0">· {distLabel}</span>}
            </p>
          )}
        </div>
      </Link>
      <ShareToChatSheet open={shareOpen} onClose={() => setShareOpen(false)} attachment={shareAttachment} />
      <InquiryGateDialog
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        productId={product.id}
        productTitle={product.title}
        supplierId={product.supplierId}
        buyerId={buyerId}
        onSent={() => {}}
      />
      </>
    );
  }

  return (
    <>
    <Link
      to={`/product/${product.id}`}
      onClick={() => logProductClick(product, "card")}
      className="group rounded-xl overflow-hidden bg-card border border-border shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition block"
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        {isPlayableVideoFile ? (
          <video
            src={videoUrl!}
            poster={images[0]}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={product.title}
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === slideIdx ? "opacity-100" : "opacity-0"}`}
            />
          ))
        )}
        {hasVideoBadge && !isPlayableVideoFile && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
            <span className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-soft">
              <Play className="w-5 h-5 fill-current text-foreground" />
            </span>
          </span>
        )}
        {displayBadge && badgeStyle[displayBadge as NonNullable<Product["badge"]>] && (
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded ${badgeStyle[displayBadge as NonNullable<Product["badge"]>]}`}>
            {displayBadge}
          </span>
        )}
        {product.adHasReel && (
          <span
            className={`absolute ${displayBadge ? "top-9" : "top-2"} left-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-to-r from-fuchsia-500 to-primary text-white shadow-soft animate-pulse`}
            title="AI ad reel"
          >
            <Sparkles className="w-3 h-3" /> Reel
          </span>
        )}

        {off > 0 && (
          <span className="absolute top-2 right-10 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
            -{off}%
          </span>
        )}
        {product.moq && product.moq > 1 && (
          <span className="absolute bottom-2 left-2 bg-background/90 backdrop-blur text-foreground text-[10px] font-bold px-2 py-0.5 rounded-full border border-border shadow-card inline-flex items-center gap-1">
            <Package className="w-3 h-3" />
            MOQ {product.moq}{product.unit ? ` ${product.unit}` : ""}
          </span>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button
            onClick={handleShare}
            aria-label="Share"
            className="w-8 h-8 rounded-full bg-background/85 backdrop-blur flex items-center justify-center active:scale-90 transition shadow-soft"
          >
            <Send className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={handleLike}
            aria-label="Wishlist"
            className="w-8 h-8 rounded-full bg-background/85 backdrop-blur flex items-center justify-center active:scale-90 transition shadow-soft"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
          </button>
        </div>
        {countdown && (
          <span className={`absolute bottom-2 left-2 right-2 text-[10px] font-bold px-2 py-1 rounded flex items-center justify-center gap-1 tabular-nums ${countdown.urgent ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-foreground/85 text-background"}`}>
            <Timer className="w-3 h-3" />
            Ends in {countdown.h > 0 ? `${countdown.h}h ` : ""}{pad(countdown.m)}:{pad(countdown.s)}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="text-xs font-bold tracking-tight leading-snug line-clamp-2">{product.title}</p>
        {product.description && product.title.length < 45 && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1 mt-0.5">
            {product.description}
          </p>
        )}

        <div className="flex items-baseline gap-1.5 mt-1.5">
          <span className="price text-2xl font-black text-destructive tracking-tight leading-none">{fmtPrice(product.price)}</span>
          <span className="text-[10px] text-muted-foreground font-semibold">/{product.unit || "unit"}</span>
          {product.originalPrice && (
            <span className="text-[11px] text-muted-foreground line-through">
              {fmtPrice(product.originalPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold border border-emerald-500/20"
            title="Trade Assurance — buyer protection on payment, on-time shipment, and quality"
          >
            <ShieldCheck className="w-3 h-3" /> Trade Assurance
          </span>
          <div className="inline-flex items-center gap-1 text-muted-foreground" aria-label="Accepted payment methods">
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" title="Visa" loading="lazy" className="h-4 w-auto object-contain bg-white rounded-sm p-0.5 ring-1 ring-border" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" title="Mastercard" loading="lazy" className="h-4 w-auto object-contain bg-white rounded-sm p-0.5 ring-1 ring-border" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Paypal_2014_logo.png" alt="PayPal" title="PayPal" loading="lazy" className="h-4 w-auto object-contain bg-white rounded-sm p-0.5 ring-1 ring-border" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Ecocash_logo.png/320px-Ecocash_logo.png" alt="EcoCash" title="EcoCash" loading="lazy" className="h-4 w-auto object-contain bg-white rounded-sm p-0.5 ring-1 ring-border" />
            <span title="Wallet" className="inline-flex items-center justify-center h-4 px-1 rounded-sm bg-amber-500/15 text-amber-600">
              <Wallet className="w-3 h-3" />
            </span>
            <span title="Cash on delivery" className="inline-flex items-center justify-center h-4 px-1 rounded-sm bg-muted text-foreground/70">
              <Banknote className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{fmtSold(product.sold)}</span>
        </div>

        {(() => {
          const d = estimateDeliveryDate(product.leadTime);
          return d ? (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
              <Truck className="w-3 h-3 text-primary" />
              <span>Get it <span className="font-semibold text-foreground">{d.range}</span></span>
            </div>
          ) : null;
        })()}

        {(supplierLocLabel || distLabel) && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground min-w-0">
            <MapPin className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate">{supplierLocLabel ?? "Nearby supplier"}</span>
            {distLabel && (
              <span className="ml-1 font-bold text-foreground tabular-nums shrink-0">{distLabel}</span>
            )}
            {mapsUrl && (
              <button
                type="button"
                onClick={handleViewMap}
                aria-label="View supplier on map"
                className="ml-auto inline-flex items-center gap-0.5 text-primary font-semibold hover:underline shrink-0"
              >
                <MapIcon className="w-3 h-3" /> Map
              </button>
            )}
          </div>
        )}

        {(product.freeShipping || supplierVerified || supplierGold) && (
          <div className="flex items-center gap-1.5 mt-1 text-[10px] flex-wrap">
            {supplierVerified && (
              <span className="inline-flex items-center gap-0.5 text-primary font-semibold">
                <ShieldCheck className="w-3 h-3" /> Verified
              </span>
            )}
            {supplierGold && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                <Award className="w-3 h-3" /> Gold
              </span>
            )}
            {product.freeShipping && (
              <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                <Truck className="w-3 h-3" /> Free
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleAdd}
          aria-label="Add to cart"
          className="mt-2 w-full h-8 rounded-lg bg-foreground text-background text-xs font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </Link>
    <ShareToChatSheet open={shareOpen} onClose={() => setShareOpen(false)} attachment={shareAttachment} />
    <InquiryGateDialog
      open={inquiryOpen}
      onClose={() => setInquiryOpen(false)}
      productId={product.id}
      productTitle={product.title}
      supplierId={product.supplierId}
      buyerId={buyerId}
      onSent={() => {}}
    />
    </>
  );
}
