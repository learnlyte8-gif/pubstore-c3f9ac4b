import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapProduct, mapSupplier, type Product, type Supplier } from "@/data/products";

export function useAuthUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return userId;
}

/** IDs of suppliers the current user follows. */
export function useFollowingSupplierIds() {
  const userId = useAuthUserId();
  return useQuery({
    queryKey: ["following-supplier-ids", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("followers")
        .select("supplier_id")
        .eq("user_id", userId!);
      return (data ?? []).map((r) => r.supplier_id as string);
    },
  });
}

/** Products from suppliers the current user follows + supplier lookup map. */
export function useFollowingFeed(limit = 60) {
  const { data: ids = [] } = useFollowingSupplierIds();
  return useQuery({
    queryKey: ["following-feed", ids, limit],
    enabled: ids.length > 0,
    queryFn: async (): Promise<{ products: Product[]; suppliers: Supplier[] }> => {
      const [{ data: prods }, { data: sups }] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .in("supplier_id", ids)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase.from("suppliers").select("*").in("id", ids),
      ]);
      return {
        products: (prods ?? []).map((p) => mapProduct(p as Parameters<typeof mapProduct>[0])),
        suppliers: (sups ?? []).map((s) => mapSupplier(s as Parameters<typeof mapSupplier>[0])),
      };
    },
  });
}
