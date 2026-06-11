import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Tier = "bronze" | "silver" | "gold";

export type TierInfo = {
  buyer_tier: Tier;
  supplier_tier: Tier;
  buyer_points: number;
  supplier_points: number;
  next_threshold: number;
};

const sb = supabase as any;

export function useUserTier(userId?: string | null) {
  const [info, setInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (uid?: string | null) => {
    const target = uid ?? userId;
    if (!target) { setInfo(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await sb.rpc("get_user_tier_info", { _user_id: target });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setInfo(row as TierInfo);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) { setLoading(false); return; }
    refresh(userId);
  }, [userId, refresh]);

  return { info, loading, refresh };
}

export function useMyTier() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);
  return useUserTier(uid);
}
