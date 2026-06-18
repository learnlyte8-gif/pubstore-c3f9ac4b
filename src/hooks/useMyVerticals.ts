import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { guestVerticals } from "@/lib/guest";

/**
 * Live "verticals" preference for the signed-in user, with a guest-mode
 * localStorage fallback. Verticals are the high-level service categories
 * (shop, jobs, stays, agro, …) the user wants in their feed.
 */
export function useMyVerticals() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [guestData, setGuestData] = useState<string[]>(() => guestVerticals.get());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["my-verticals", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("verticals")
        .eq("user_id", userId!)
        .maybeSingle();
      return ((data as any)?.verticals ?? []) as string[];
    },
  });

  const save = useCallback(
    async (next: string[]) => {
      if (!userId) {
        guestVerticals.set(next);
        setGuestData(next);
        return;
      }
      await (supabase.from("profiles") as any).update({ verticals: next }).eq("user_id", userId);
      query.refetch();
    },
    [userId, query],
  );

  const verticals = userId ? (query.data ?? []) : guestData;
  const isLoading = userId ? query.isLoading : !authReady;
  return { verticals, isLoading, save, userId };
}
