import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapProduct, type Product } from "@/data/products";

const sb = supabase as any;

export type PromoterProfile = {
  user_id: string;
  code: string;
  level: number;
  risk_score: number;
  risk_band: "low" | "medium" | "high";
  frozen: boolean;
  frozen_reason: string | null;
  accepted_terms_at: string | null;
  currency: string;
};

export type PromotionLink = {
  id: string;
  promotion_id: string;
  promoter_id: string;
  product_id: string | null;
  code: string;
  channel: string;
  campaign: string | null;
  clicks: number;
  created_at: string;
};

export type Commission = {
  id: string;
  ref_code: string | null;
  promoter_id: string;
  order_id: string;
  product_id: string | null;
  commission_type: string;
  commission_rate: number;
  commission_base: number;
  commission_amount: number;
  status: "pending" | "confirmed" | "available" | "paid" | "cancelled" | "reversed";
  created_at: string;
  available_at: string | null;
  paid_at: string | null;
  note: string | null;
};

export type EarningsSummary = {
  total_earned: number;
  pending_amount: number;
  confirming_amount: number;
  available_amount: number;
  paid_amount: number;
  reversed_amount: number;
  sales_count: number;
  sales_revenue: number;
};

const EMPTY_SUMMARY: EarningsSummary = {
  total_earned: 0, pending_amount: 0, confirming_amount: 0, available_amount: 0,
  paid_amount: 0, reversed_amount: 0, sales_count: 0, sales_revenue: 0,
};

export function useAuthUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return userId;
}

/** The signed-in user's promoter account, created on first use. */
export function usePromoterProfile(enabled = true) {
  const userId = useAuthUserId();
  const query = useQuery({
    queryKey: ["promoter-profile", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<PromoterProfile | null> => {
      const { data, error } = await sb.rpc("promoter_ensure_profile");
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as PromoterProfile;
    },
  });
  return { userId, profile: query.data ?? null, isLoading: query.isLoading, error: query.error, refresh: query.refetch };
}

export type PromoteSort = "earning" | "converting" | "trending" | "new" | "deals";

const SORT_LABEL: Record<PromoteSort, string> = {
  earning: "Top earning",
  converting: "Best converting",
  trending: "Trending",
  new: "New",
  deals: "Hot deals",
};
export const PROMOTE_SORTS = Object.entries(SORT_LABEL).map(([key, label]) => ({
  key: key as PromoteSort,
  label,
}));

/** Products the seller has opened up for promotion. */
export function usePromotableProducts(sort: PromoteSort = "earning", search = "", category = "") {
  return useQuery({
    queryKey: ["promotable-products", sort, search, category],
    queryFn: async (): Promise<Product[]> => {
      let q = sb
        .from("products")
        .select("*, suppliers(name, verified, gold, country, city, location_address, latitude, longitude, trade_type, email)")
        .eq("promote_enabled", true)
        .eq("active", true)
        .gt("commission_value", 0)
        .limit(60);
      const searching = !!search.trim();
      if (searching) q = q.ilike("title", `%${search.trim()}%`);
      if (category) q = q.eq("category_slug", category);

      // Match the admin ads studio: while searching, always show newest first.
      if (searching) q = q.order("created_at", { ascending: false });
      else if (sort === "new") q = q.order("created_at", { ascending: false });
      else if (sort === "trending") q = q.order("sold", { ascending: false });
      else if (sort === "converting") q = q.order("review_count", { ascending: false });
      else if (sort === "deals") q = q.order("original_price", { ascending: false, nullsFirst: false });
      else q = q.order("commission_value", { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      const mapped = (data ?? []).map((p: any) => mapProduct(p));
      if (sort === "earning" && !searching) {
        return mapped.sort((a, b) => {
          const ca = a.commissionType === "fixed" ? (a.commissionValue ?? 0) : a.price * ((a.commissionValue ?? 0) / 100);
          const cb = b.commissionType === "fixed" ? (b.commissionValue ?? 0) : b.price * ((b.commissionValue ?? 0) / 100);
          return cb - ca;
        });
      }
      return mapped;
    },
  });
}

/** Creates (or reuses) the promoter's short link for a product. */
export function usePromotionLink(productId: string | undefined, channel = "link") {
  const userId = useAuthUserId();
  return useQuery({
    queryKey: ["promotion-link", userId, productId, channel],
    enabled: !!userId && !!productId,
    retry: false,
    queryFn: async (): Promise<PromotionLink> => {
      const { data, error } = await sb.rpc("promote_get_link", {
        _product_id: productId,
        _channel: channel,
        _campaign: null,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as PromotionLink;
    },
  });
}

/** Every link the promoter has created, with clicks, orders and earnings. */
export function useMyPromotions() {
  const userId = useAuthUserId();
  return useQuery({
    queryKey: ["my-promotions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: links }, { data: comms }] = await Promise.all([
        sb.from("promotion_links").select("*").eq("promoter_id", userId).order("created_at", { ascending: false }).limit(200),
        sb.from("commissions").select("link_id, commission_amount, status").eq("promoter_id", userId),
      ]);
      const productIds = Array.from(new Set((links ?? []).map((l: any) => l.product_id).filter(Boolean)));
      const { data: prods } = productIds.length
        ? await sb.from("products").select("id,title,image,price").in("id", productIds)
        : { data: [] };
      const pmap = new Map((prods ?? []).map((p: any) => [p.id, p]));
      const stats = new Map<string, { orders: number; earned: number }>();
      for (const c of comms ?? []) {
        if (!c.link_id) continue;
        const s = stats.get(c.link_id) ?? { orders: 0, earned: 0 };
        if (c.status !== "cancelled" && c.status !== "reversed") {
          s.orders += 1;
          s.earned += Number(c.commission_amount ?? 0);
        }
        stats.set(c.link_id, s);
      }
      return (links ?? []).map((l: any) => ({
        ...l,
        product: pmap.get(l.product_id) ?? null,
        orders: stats.get(l.id)?.orders ?? 0,
        earned: stats.get(l.id)?.earned ?? 0,
      }));
    },
  });
}

/** Earnings summary, commission rows and payout history. */
export function usePromoterEarnings() {
  const userId = useAuthUserId();
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ["promoter-earnings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<EarningsSummary> => {
      const { data } = await sb
        .from("promoter_earnings_summary")
        .select("*")
        .eq("promoter_id", userId)
        .maybeSingle();
      if (!data) return EMPTY_SUMMARY;
      return {
        total_earned: Number(data.total_earned ?? 0),
        pending_amount: Number(data.pending_amount ?? 0),
        confirming_amount: Number(data.confirming_amount ?? 0),
        available_amount: Number(data.available_amount ?? 0),
        paid_amount: Number(data.paid_amount ?? 0),
        reversed_amount: Number(data.reversed_amount ?? 0),
        sales_count: Number(data.sales_count ?? 0),
        sales_revenue: Number(data.sales_revenue ?? 0),
      };
    },
  });

  const commissions = useQuery({
    queryKey: ["promoter-commissions", userId],
    enabled: !!userId,
    queryFn: async (): Promise<(Commission & { product?: any })[]> => {
      const { data } = await sb
        .from("commissions")
        .select("*")
        .eq("promoter_id", userId)
        .order("created_at", { ascending: false })
        .limit(120);
      const ids = Array.from(new Set((data ?? []).map((c: any) => c.product_id).filter(Boolean)));
      const { data: prods } = ids.length
        ? await sb.from("products").select("id,title,image").in("id", ids)
        : { data: [] };
      const pmap = new Map((prods ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((c: any) => ({ ...c, product: pmap.get(c.product_id) ?? null }));
    },
  });

  const payouts = useQuery({
    queryKey: ["promoter-payouts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await sb
        .from("promoter_payouts")
        .select("*")
        .eq("promoter_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const refresh = useCallback(() => {
    ["promoter-earnings", "promoter-commissions", "promoter-payouts", "my-promotions"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k, userId] }),
    );
    qc.invalidateQueries({ queryKey: ["wallet", userId] });
  }, [qc, userId]);

  const withdraw = useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await sb.rpc("promoter_withdraw_earnings", { _amount: amount });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  return {
    userId,
    summary: summary.data ?? EMPTY_SUMMARY,
    commissions: commissions.data ?? [],
    payouts: payouts.data ?? [],
    isLoading: summary.isLoading || commissions.isLoading,
    refresh,
    withdraw,
  };
}

/** Seller view: sales generated by promoters on the seller's own products. */
export function usePromotedSales(supplierId: string | null | undefined) {
  return useQuery({
    queryKey: ["promoted-sales", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data } = await sb
        .from("commissions")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = data ?? [];
      const promoterIds = Array.from(new Set(rows.map((r: any) => r.promoter_id)));
      const productIds = Array.from(new Set(rows.map((r: any) => r.product_id).filter(Boolean)));
      const [{ data: profs }, { data: prods }] = await Promise.all([
        promoterIds.length ? sb.from("profiles").select("user_id,display_name,username,avatar_url").in("user_id", promoterIds) : Promise.resolve({ data: [] }),
        productIds.length ? sb.from("products").select("id,title,image").in("id", productIds) : Promise.resolve({ data: [] }),
      ]);
      const pmap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const prodMap = new Map((prods ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({
        ...r,
        promoter: pmap.get(r.promoter_id) ?? null,
        product: prodMap.get(r.product_id) ?? null,
      }));
    },
  });
}
