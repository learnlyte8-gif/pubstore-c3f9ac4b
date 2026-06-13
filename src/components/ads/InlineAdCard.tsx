import { Link } from "react-router-dom";
import { useAd, useAdImpression, trackAdEvent } from "@/hooks/useAds";
import SponsoredBadge from "./SponsoredBadge";

export default function InlineAdCard({ ctx, className = "" }: { ctx?: { category?: string; country?: string; interests?: string[] }; className?: string }) {
  const { data: ad } = useAd("inline", ctx);
  useAdImpression(ad);
  if (!ad) return null;

  const c = ad.creative ?? {};
  const href = ad.product_id ? `/product/${ad.product_id}` : ad.supplier_id ? `/supplier/${ad.supplier_id}` : "#";

  return (
    <Link
      to={href}
      onClick={() => trackAdEvent(ad.id, "click", "inline")}
      className={`relative block rounded-2xl overflow-hidden bg-card border shadow-card hover:shadow-elevated transition ${className}`}
    >
      <div className="aspect-square bg-muted">
        {c.image && <img src={c.image} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="p-2">
        <div className="flex items-center justify-between mb-1">
          <SponsoredBadge />
          {c.cta && <span className="text-[10px] font-bold text-primary">{c.cta} →</span>}
        </div>
        <p className="text-xs font-bold leading-tight line-clamp-2">{c.headline || "Featured"}</p>
        {c.tagline && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{c.tagline}</p>}
      </div>
    </Link>
  );
}
