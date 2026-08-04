import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMySupplier } from "@/data/products";

const sb = supabase as any;

export type SupplierFeature =
  | "basic_analytics"
  | "full_analytics"
  | "bulk_import"
  | "live_selling"
  | "ads"
  | "coupons"
  | "priority_placement"
  | "featured_badge"
  | "priority_support"
  | "top_placement";

export const FEATURE_LABEL: Record<string, string> = {
  full_analytics: "Full analytics",
  bulk_import: "Bulk & auto import",
  live_selling: "Live selling",
  ads: "PUBSTORE Ads",
  coupons: "Coupons & promos",
  priority_placement: "Priority search placement",
  featured_badge: "Featured store badge",
  priority_support: "Priority support",
  top_placement: "Top search placement",
};

export type SupplierPlan = {
  code: string;
  name: string;
  price_usd: number;
  commission_rate: number;
  product_limit: number | null;
  perks: string[];
  features: string[];
  sort: number;
};

export type SupplierSubscription = {
  supplier_id: string;
  plan_code: string;
  started_at: string;
  renews_at: string | null;
};

export type SupplierCommission = {
  id: string;
  order_id: string;
  plan_code: string | null;
  gross: number;
  rate: number;
  commission: number;
  net: number;
  created_at: string;
};

export function useSupplierPlan() {
  const qc = useQueryClient();

  const supplierQ = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const supplierId = supplierQ.data?.id as string | undefined;

  const plansQ = useQuery({
    queryKey: ["supplier-plans"],
    queryFn: async (): Promise<SupplierPlan[]> => {
      const { data } = await sb
        .from("supplier_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort");
      return (data ?? []).map((p: any) => ({
        ...p,
        price_usd: Number(p.price_usd),
        commission_rate: Number(p.commission_rate),
        perks: Array.isArray(p.perks) ? p.perks : [],
        features: Array.isArray(p.features) ? p.features : [],
      })) as SupplierPlan[];
    },
  });

  const subQ = useQuery({
    queryKey: ["supplier-subscription", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierSubscription | null> => {
      const { data } = await sb
        .from("supplier_subscriptions")
        .select("*")
        .eq("supplier_id", supplierId!)
        .maybeSingle();
      return (data ?? null) as SupplierSubscription | null;
    },
  });

  const commissionsQ = useQuery({
    queryKey: ["supplier-commissions", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierCommission[]> => {
      const { data } = await sb
        .from("supplier_commissions")
        .select("*")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).map((c: any) => ({
        ...c,
        gross: Number(c.gross),
        rate: Number(c.rate),
        commission: Number(c.commission),
        net: Number(c.net),
      })) as SupplierCommission[];
    },
  });

  const productCountQ = useQuery({
    queryKey: ["supplier-product-count", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { count } = await sb
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId!);
      return count ?? 0;
    },
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["supplier-subscription", supplierId] });
    qc.invalidateQueries({ queryKey: ["supplier-commissions", supplierId] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-tx"] });
  }, [qc, supplierId]);

  const subscribe = useMutation({
    mutationFn: async (planCode: string) => {
      const { data, error } = await sb.rpc("supplier_subscribe_plan", { _plan_code: planCode });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: refresh,
  });

  const plans = plansQ.data ?? [];
  const lapsed = !!subQ.data?.renews_at && new Date(subQ.data.renews_at) <= new Date();
  const activeCode = subQ.data && !lapsed ? subQ.data.plan_code : "free";
  const plan = plans.find((p) => p.code === activeCode) ?? plans.find((p) => p.code === "free") ?? null;
  const features = plan?.features ?? [];
  const can = (feature: SupplierFeature) => features.includes(feature);
  const limit = plan?.product_limit ?? null;
  const productCount = productCountQ.data ?? 0;
  const atProductLimit = limit != null && productCount >= limit;
  /** Cheapest active plan that unlocks a given feature. */
  const upgradeFor = (feature: SupplierFeature) =>
    plans.find((p) => p.features.includes(feature)) ?? null;

  return {
    supplier: supplierQ.data ?? null,
    plans,
    plan,
    planCode: activeCode,
    subscription: subQ.data ?? null,
    lapsed,
    commissions: commissionsQ.data ?? [],
    productCount,
    productLimit: limit,
    atProductLimit,
    features,
    can,
    upgradeFor,
    loading: plansQ.isLoading || supplierQ.isLoading || subQ.isLoading,
    subscribe,
    refresh,
  };
}
