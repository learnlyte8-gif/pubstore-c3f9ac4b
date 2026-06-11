import { Link } from "react-router-dom";
import { Sparkles, Play } from "lucide-react";
import type { Product } from "@/data/products";

/**
 * AdReel — animated "video-like" reel placeholder for a product's AI ad.
 * Uses a Ken-Burns zoom on the product image with the AI-generated headline
 * and tagline overlaid. Replaceable later with a real video URL.
 */
interface Props {
  product: Product;
  variant?: "full" | "tile";
  className?: string;
}

export default function AdReel({ product, variant = "full", className = "" }: Props) {
  const headline = product.adHeadline || product.title;
  const tagline = product.adTagline || (product.description ?? "").slice(0, 90);

  if (variant === "tile") {
    return (
      <Link
        to={`/product/${product.id}`}
        className={`relative shrink-0 w-40 aspect-[9/16] rounded-2xl overflow-hidden bg-muted shadow-elevated group ${className}`}
      >
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover animate-[reel-zoom_8s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-gradient-to-r from-fuchsia-500 to-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Sparkles className="w-3 h-3" /> Reel
        </span>
        <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-foreground flex items-center justify-center">
          <Play className="w-3.5 h-3.5 fill-current" />
        </span>
        <div className="absolute inset-x-2 bottom-2 text-white">
          <p className="text-sm font-extrabold leading-tight line-clamp-2 drop-shadow">{headline}</p>
          {tagline && (
            <p className="text-[10px] opacity-90 leading-snug line-clamp-2 mt-0.5">{tagline}</p>
          )}
          <p className="text-xs font-bold mt-1">${product.price.toFixed(2)}</p>
        </div>
      </Link>
    );
  }

  return (
    <div className={`relative aspect-[16/10] rounded-2xl overflow-hidden bg-muted shadow-elevated ${className}`}>
      <img
        src={product.image}
        alt={product.title}
        className="absolute inset-0 w-full h-full object-cover animate-[reel-zoom_8s_ease-in-out_infinite_alternate]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-gradient-to-r from-fuchsia-500 to-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
        <Sparkles className="w-3.5 h-3.5" /> AI Reel
      </span>
      <div className="absolute inset-x-4 bottom-4 text-white">
        <p className="text-xl sm:text-2xl font-extrabold leading-tight drop-shadow">{headline}</p>
        {tagline && <p className="text-sm opacity-95 mt-1 line-clamp-2">{tagline}</p>}
      </div>
    </div>
  );
}
