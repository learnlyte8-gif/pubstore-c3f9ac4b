import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ShoppingBag, Star, UserPlus, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime activity (orders, reviews, follows, live streams)
 * and shows a small floating toast for each new event.
 *
 * Mounted once at the app shell so it works on every page.
 */
export default function LiveActivityToaster() {
  // Skip events that happened before this component mounted, so a refresh
  // doesn't trigger a flood of "old" notifications.
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    const recent = (ts: string) => new Date(ts).getTime() >= startedAt.current - 1000;

    const ch = supabase
      .channel("global-live-activity-toasts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (p) => {
        const row = p.new as { id: string; created_at: string; supplier_id: string };
        if (!recent(row.created_at)) return;
        const { data: sup } = await supabase
          .from("suppliers").select("name,country").eq("id", row.supplier_id).maybeSingle();
        toast(
          `New order placed with ${sup?.name ?? "a supplier"}`,
          {
            description: sup?.country ? `Buyer in ${sup.country}` : undefined,
            icon: <ShoppingBag className="w-4 h-4 text-primary" />,
            duration: 4000,
          },
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, async (p) => {
        const row = p.new as { id: string; created_at: string; rating: number; product_id: string };
        if (!recent(row.created_at)) return;
        const { data: prod } = await supabase
          .from("products").select("title").eq("id", row.product_id).maybeSingle();
        toast(
          `New ${row.rating}★ review`,
          {
            description: prod?.title ?? "A product",
            icon: <Star className="w-4 h-4 text-amber-500" />,
            duration: 4000,
          },
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "followers" }, async (p) => {
        const row = p.new as { id: string; created_at: string; supplier_id: string };
        if (!recent(row.created_at)) return;
        const { data: sup } = await supabase
          .from("suppliers").select("name").eq("id", row.supplier_id).maybeSingle();
        toast(
          `New follower for ${sup?.name ?? "a supplier"}`,
          {
            icon: <UserPlus className="w-4 h-4 text-destructive" />,
            duration: 3500,
          },
        );
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_streams" }, async (p) => {
        const row = p.new as { id: string; started_at: string; supplier_id: string; title: string };
        if (!recent(row.started_at)) return;
        const { data: sup } = await supabase
          .from("suppliers").select("name").eq("id", row.supplier_id).maybeSingle();
        toast(
          `${sup?.name ?? "A supplier"} just went live`,
          {
            description: row.title,
            icon: <Radio className="w-4 h-4 text-emerald-500" />,
            action: { label: "Watch", onClick: () => { window.location.href = `/live/${row.id}`; } },
            duration: 6000,
          },
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  return null;
}
