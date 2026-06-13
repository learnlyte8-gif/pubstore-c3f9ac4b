import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type AdPlacement = "banner" | "inline" | "interstitial" | "rewarded";

export type ServedAd = {
  id: string;
  product_id: string | null;
  supplier_id: string | null;
  placement: AdPlacement;
  pricing_mode: "flat_boost" | "cpc";
  max_bid_cpc: number;
  creative: {
    headline?: string;
    tagline?: string;
    image?: string;
    video?: string;
    cta?: string;
  };
};

export function useAd(placement: AdPlacement, ctx?: { category?: string; country?: string; interests?: string[] }) {
  return useQuery({
    queryKey: ["ad", placement, ctx?.category ?? null, ctx?.country ?? null, (ctx?.interests ?? []).join(",")],
    staleTime: 60_000,
    queryFn: async (): Promise<ServedAd | null> => {
      const { data, error } = await sb.rpc("serve_ad", {
        _placement: placement,
        _category: ctx?.category ?? null,
        _country: ctx?.country ?? null,
        _interests: ctx?.interests ?? [],
        _limit: 1,
      });
      if (error || !data || data.length === 0) return null;
      return data[0] as ServedAd;
    },
  });
}

export function useAds(placement: AdPlacement, limit = 5, ctx?: { category?: string; country?: string; interests?: string[] }) {
  return useQuery({
    queryKey: ["ads", placement, limit, ctx?.category ?? null, ctx?.country ?? null, (ctx?.interests ?? []).join(",")],
    staleTime: 60_000,
    queryFn: async (): Promise<ServedAd[]> => {
      const { data, error } = await sb.rpc("serve_ad", {
        _placement: placement,
        _category: ctx?.category ?? null,
        _country: ctx?.country ?? null,
        _interests: ctx?.interests ?? [],
        _limit: limit,
      });
      if (error || !data) return [];
      return data as ServedAd[];
    },
  });
}

export async function trackAdEvent(campaignId: string, event: "impression" | "click", placement: AdPlacement) {
  try {
    await sb.rpc("track_ad_event", { _campaign_id: campaignId, _event: event, _placement: placement });
  } catch { /* ignore */ }
}

export async function rewardAdView(campaignId: string): Promise<{ ok: boolean; points: number; error?: string }> {
  const { data, error } = await sb.rpc("reward_ad_view", { _campaign_id: campaignId });
  if (error) return { ok: false, points: 0, error: error.message };
  return { ok: !!data?.ok, points: Number(data?.points ?? 0), error: data?.error };
}

/** Fires an impression beacon exactly once when the ad mounts. */
export function useAdImpression(ad: ServedAd | null | undefined) {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!ad) return;
    if (fired.current === ad.id) return;
    fired.current = ad.id;
    trackAdEvent(ad.id, "impression", ad.placement);
  }, [ad?.id]);
}
