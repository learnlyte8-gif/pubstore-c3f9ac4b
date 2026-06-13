import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, ChevronRight } from "lucide-react";
import { useAd, useAdImpression, trackAdEvent } from "@/hooks/useAds";
import SponsoredBadge from "./SponsoredBadge";

const SESSION_KEY = "pubstore.interstitial.shown";
const NAV_KEY = "pubstore.interstitial.navs";
const NAV_THRESHOLD = 4;

/**
 * Shows a full-screen ad after N navigations in a session, once per session.
 * Skippable after 3 seconds.
 */
export default function InterstitialAdManager() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const { data: ad, refetch } = useAd("interstitial");
  useAdImpression(open ? ad : null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    const navs = Number(sessionStorage.getItem(NAV_KEY) ?? "0") + 1;
    sessionStorage.setItem(NAV_KEY, String(navs));
    if (navs < NAV_THRESHOLD) return;
    if (/^\/(auth|onboarding|live\/|pay\/|cart|product\/)/.test(location.pathname)) return;
    refetch().then(({ data }) => {
      if (!data) return;
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
      setCanSkip(false);
      setTimeout(() => setCanSkip(true), 3000);
    });
  }, [location.pathname, refetch]);

  if (!open || !ad) return null;

  const c = ad.creative ?? {};
  const href = ad.product_id ? `/product/${ad.product_id}` : ad.supplier_id ? `/supplier/${ad.supplier_id}` : "#";

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      <div className="absolute top-3 left-3 z-10">
        <SponsoredBadge className="!bg-white/15 !text-white" />
      </div>
      <button
        type="button"
        onClick={() => canSkip && setOpen(false)}
        disabled={!canSkip}
        className="absolute top-3 right-3 z-10 px-3 h-9 rounded-full bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
      >
        {canSkip ? (<><X className="w-3.5 h-3.5" /> Skip</>) : "Skip in 3s"}
      </button>

      <Link
        to={href}
        onClick={() => { trackAdEvent(ad.id, "click", "interstitial"); setOpen(false); }}
        className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center"
      >
        {c.image && (
          <img src={c.image} alt="" className="w-full max-w-sm aspect-square rounded-3xl object-cover shadow-2xl" />
        )}
        <h2 className="text-2xl font-extrabold mt-6 max-w-md">{c.headline || "Featured offer"}</h2>
        {c.tagline && <p className="text-sm opacity-80 mt-2 max-w-md">{c.tagline}</p>}
        <span className="mt-6 inline-flex items-center gap-2 px-6 h-12 rounded-full bg-white text-black font-bold">
          {c.cta || "Shop now"} <ChevronRight className="w-4 h-4" />
        </span>
      </Link>
    </div>
  );
}
