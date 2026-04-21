import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X, Flame, ChevronRight } from "lucide-react";
import { useProducts } from "@/hooks/useCatalog";

/**
 * Sticky banner advertising trending products. Sits just above the bottom nav.
 * Auto-rotates between the top selling/rated products. Dismissible per session.
 */
export default function BannerAd() {
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);
  const { data: hot = [] } = useProducts({ limit: 8, sortBy: "sold" as any });

  useEffect(() => {
    if (sessionStorage.getItem("pubstore-banner-ad-dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (hot.length < 2) return;
    const t = setInterval(() => setIdx((v) => (v + 1) % hot.length), 4500);
    return () => clearInterval(t);
  }, [hot.length]);

  if (dismissed || hot.length === 0) return null;
  const p = hot[idx];
  if (!p) return null;

  const discount =
    p.originalPrice && p.originalPrice > p.price
      ? Math.round((1 - p.price / p.originalPrice) * 100)
      : null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-3 pointer-events-none lg:hidden">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <Link
          to={`/product/${p.id}`}
          className="relative flex items-center gap-3 p-2 pr-10 rounded-2xl bg-gradient-to-r from-primary via-primary to-purple-600 text-primary-foreground shadow-elevated overflow-hidden animate-fade-in"
          style={{ animationDuration: "300ms" }}
          aria-label={`Trending: ${p.title}`}
        >
          {/* Sponsored chip */}
          <span className="absolute top-1 left-2 text-[8px] font-bold uppercase tracking-wider bg-white/25 backdrop-blur px-1.5 py-px rounded-full">
            Ad · Trending
          </span>

          {/* Product image */}
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/10 shrink-0 ring-2 ring-white/40">
            <img
              src={p.image || "/placeholder.svg"}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {discount && (
              <span className="absolute bottom-0 left-0 right-0 bg-amber-500 text-black text-[9px] font-extrabold text-center py-0.5">
                -{discount}%
              </span>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0 mt-2">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase opacity-90">
              <Flame className="w-3 h-3" />
              <span>Hot deal · {p.sold ?? 0} sold</span>
            </div>
            <p className="text-sm font-bold truncate leading-tight">{p.title}</p>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span>${Number(p.price).toFixed(2)}</span>
              {p.originalPrice && p.originalPrice > p.price && (
                <span className="line-through opacity-70">
                  ${Number(p.originalPrice).toFixed(2)}
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5">
                Shop <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              sessionStorage.setItem("pubstore-banner-ad-dismissed", "1");
              setDismissed(true);
            }}
            aria-label="Dismiss ad"
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Sparkle accent */}
          <Sparkles className="absolute -right-2 -bottom-2 w-12 h-12 opacity-15" />
        </Link>
      </div>
    </div>
  );
}
