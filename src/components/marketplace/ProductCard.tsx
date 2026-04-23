import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Star, Plus, Truck, ShieldCheck, Award, Timer } from "lucide-react";
import { toast } from "sonner";
import { type Product, discountPct } from "@/data/products";
import { useShop } from "@/store/shop";
import { supabase } from "@/integrations/supabase/client";

const fmtPrice = (n: number) => `$${n.toFixed(2)}`;
const fmtSold = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+ sold` : `${n} sold`;

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
  // Hide internal "Imported · …" badges from public product cards.
  const displayBadge =
    product.badge && !/^imported/i.test(product.badge) ? product.badge : null;
  const supplierVerified = product.supplierVerified === true;
  const supplierGold = product.supplierGold === true;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  if (variant === "compact") {
    return (
      <Link to={`/product/${product.id}`} className="shrink-0 w-36 group block">
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted shadow-card group-hover:shadow-elevated transition">
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          {off > 0 && (
            <span className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
              -{off}%
            </span>
          )}
          <button
            onClick={handleLike}
            aria-label="Wishlist"
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
          </button>
          {countdown && (
            <span className={`absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center gap-0.5 tabular-nums ${countdown.urgent ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-foreground/85 text-background"}`}>
              <Timer className="w-3 h-3" />
              {countdown.h > 0 ? `${countdown.h}h ` : ""}{pad(countdown.m)}:{pad(countdown.s)}
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <p className="text-[11px] font-bold text-destructive">{fmtPrice(product.price)}</p>
          <p className="text-xs font-bold tracking-tight line-clamp-2 leading-snug mt-0.5">{product.title}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/product/${product.id}`}
      className="group rounded-xl overflow-hidden bg-card border border-border shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition block"
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {displayBadge && badgeStyle[displayBadge as NonNullable<Product["badge"]>] && (
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded ${badgeStyle[displayBadge as NonNullable<Product["badge"]>]}`}>
            {displayBadge}
          </span>
        )}
        {off > 0 && (
          <span className="absolute top-2 right-10 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
            -{off}%
          </span>
        )}
        <button
          onClick={handleLike}
          aria-label="Wishlist"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/85 backdrop-blur flex items-center justify-center"
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
        </button>
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
          <span className="text-base font-bold text-destructive">{fmtPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-[11px] text-muted-foreground line-through">
              {fmtPrice(product.originalPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{fmtSold(product.sold)}</span>
        </div>

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
  );
}
