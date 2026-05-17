import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SaveKind =
  | "agro"
  | "stay"
  | "property"
  | "service"
  | "industrial"
  | "car-rental"
  | "freelance"
  | "logistics"
  | "finance"
  | "news";

export type SaveSnapshot = { title?: string; image?: string | null; href?: string; meta?: Record<string, any> };

const cache = new Map<SaveKind, Set<string>>();
const listeners = new Set<() => void>();

function notify() { listeners.forEach((fn) => fn()); }

export function useSaves(kind: SaveKind) {
  const [, force] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (!userId) { cache.set(kind, new Set()); notify(); return; }
    let mounted = true;
    supabase.from("saved_items").select("item_id").eq("user_id", userId).eq("item_kind", kind).then(({ data }) => {
      if (!mounted) return;
      cache.set(kind, new Set((data ?? []).map((r: any) => String(r.item_id))));
      notify();
    });
    return () => { mounted = false; };
  }, [userId, kind]);

  const set = cache.get(kind) ?? new Set<string>();

  const toggle = useCallback(
    async (itemId: string, snapshot?: SaveSnapshot) => {
      if (!userId) { toast.error("Sign in to save items"); return false; }
      const s = cache.get(kind) ?? new Set<string>();
      if (s.has(itemId)) {
        s.delete(itemId); cache.set(kind, s); notify();
        await supabase.from("saved_items").delete().eq("user_id", userId).eq("item_kind", kind).eq("item_id", itemId);
        return false;
      }
      s.add(itemId); cache.set(kind, s); notify();
      await supabase.from("saved_items").insert({
        user_id: userId,
        item_kind: kind,
        item_id: itemId,
        title: snapshot?.title ?? null,
        image: snapshot?.image ?? null,
        href: snapshot?.href ?? null,
        meta: snapshot?.meta ?? {},
      });
      toast.success("Saved to wishlist");
      return true;
    },
    [userId, kind],
  );

  return {
    isSaved: (id: string) => set.has(id),
    toggle,
    userId,
  };
}
