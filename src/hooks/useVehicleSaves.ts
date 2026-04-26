import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Lightweight per-user vehicle save (wishlist) */
export function useVehicleSaves() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setIds(new Set()); return; }
    let mounted = true;
    supabase.from("vehicle_saves").select("vehicle_id").eq("user_id", userId).then(({ data }) => {
      if (!mounted) return;
      setIds(new Set((data ?? []).map((r: any) => r.vehicle_id)));
    });
    return () => { mounted = false; };
  }, [userId]);

  const toggle = useCallback(async (vehicleId: string) => {
    if (!userId) return false;
    if (ids.has(vehicleId)) {
      await supabase.from("vehicle_saves").delete().eq("user_id", userId).eq("vehicle_id", vehicleId);
      setIds((prev) => { const n = new Set(prev); n.delete(vehicleId); return n; });
      return false;
    }
    await supabase.from("vehicle_saves").insert({ user_id: userId, vehicle_id: vehicleId });
    setIds((prev) => new Set(prev).add(vehicleId));
    return true;
  }, [userId, ids]);

  return { savedIds: ids, isSaved: (id: string) => ids.has(id), toggle, userId };
}
