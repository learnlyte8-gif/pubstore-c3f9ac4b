import { Link } from "react-router-dom";
import { useAd, useAdImpression, trackAdEvent } from "@/hooks/useAds";
import SponsoredBadge from "./SponsoredBadge";
import BannerAd from "@/components/marketplace/BannerAd";
import { ChevronRight } from "lucide-react";

/**
 * Real ad-served banner; falls back to trending products if no campaign fills.
 */
export default function BannerAdSlot({ ctx }: { ctx?: { category?: string; country?: string; interests?: string[] } }) {
  const { data: ad } = useAd("banner", ctx);
  useAdImpression(ad);

  if (!ad) return <BannerAd />;

  const c = ad.creative ?? {};
  const href = ad.product_id ? `/product/${ad.product_id}` : ad.supplier_id ? `/supplier/${ad.supplier_id}` : "#";

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-3 pointer-events-none lg:hidden">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <Link
          to={href}
          onClick={() => trackAdEvent(ad.id, "click", "banner")}
          className="relative flex items-center gap-3 p-2 pr-10 rounded-2xl bg-gradient-to-r from-primary via-primary to-purple-600 text-primary-foreground shadow-elevated overflow-hidden"
          aria-label={c.headline || "Sponsored"}
        >
          <SponsoredBadge className="absolute top-1 left-2 !bg-white/25 !text-white" />
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/10 shrink-0 ring-2 ring-white/40">
            <img src={c.image || "/placeholder.svg"} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="flex-1 min-w-0 mt-2">
            <p className="text-sm font-bold truncate leading-tight">{c.headline || "Sponsored"}</p>
            {c.tagline && <p className="text-[11px] opacity-90 truncate">{c.tagline}</p>}
            <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold bg-white/20 rounded-full px-1.5 py-0.5">
              {c.cta || "Shop"} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
