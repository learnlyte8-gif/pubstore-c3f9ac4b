import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import { guestInterests } from "@/lib/guest";

/**
 * Map free-form interest labels (chosen at onboarding) to canonical category
 * slugs used by products.category_slug. Keep this in sync with the
 * INTERESTS list in src/pages/Onboarding.tsx.
 */
const INTEREST_TO_SLUG: Record<string, string> = {
  electronics: "electronics",
  fashion: "fashion",
  beauty: "beauty",
  home: "home",
  "home & garden": "home",
  garden: "home",
  sports: "sports",
  toys: "toys",
  automotive: "automotive",
  auto: "automotive",
  industrial: "industrial",
  agriculture: "agriculture",
  packaging: "packaging",
  office: "office",
  health: "health",
  pets: "health",
  jewelry: "fashion",
  footwear: "fashion",
  handmade: "fashion",
  art: "fashion",
  books: "office",
  groceries: "agriculture",
};

export function interestToSlug(label: string): string | null {
  return INTEREST_TO_SLUG[label.trim().toLowerCase()] ?? null;
}

export function interestsToSlugs(interests: string[] | null | undefined): string[] {
  if (!interests?.length) return [];
  return Array.from(
    new Set(interests.map(interestToSlug).filter((s): s is string => !!s)),
  );
}

/** Live profile interests for the signed-in user. */
export function useMyInterests() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["my-interests", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("interests")
        .eq("user_id", userId!)
        .maybeSingle();
      return data?.interests ?? [];
    },
  });

  const save = useCallback(
    async (next: string[]) => {
      if (!userId) return;
      await supabase.from("profiles").update({ interests: next }).eq("user_id", userId);
      query.refetch();
    },
    [userId, query],
  );

  return { interests: query.data ?? [], isLoading: query.isLoading, save, userId };
}

/**
 * Derive extra interest slugs from products in the user's wishlist (the
 * categories they save reveal what they care about).
 */
export function useWishlistInterestSlugs(): string[] {
  const { wishlist } = useShop();
  const { data = [] } = useQuery({
    queryKey: ["wishlist-categories", wishlist.sort().join(",")],
    enabled: wishlist.length > 0,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("products")
        .select("category_slug")
        .in("id", wishlist);
      const slugs = (data ?? [])
        .map((r) => r.category_slug)
        .filter((s): s is string => !!s);
      return Array.from(new Set(slugs));
    },
  });
  return data;
}

/**
 * Re-rank a product list so items matching the supplied category slugs
 * appear first, preserving the original order within each bucket.
 */
export function prioritizeByCategories<T extends { category: string }>(
  products: T[],
  prioritySlugs: string[],
): T[] {
  if (!prioritySlugs.length) return products;
  const set = new Set(prioritySlugs);
  const matched: T[] = [];
  const rest: T[] = [];
  for (const p of products) (set.has(p.category) ? matched : rest).push(p);
  return [...matched, ...rest];
}
