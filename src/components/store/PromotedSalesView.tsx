import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePromotedSales } from "@/hooks/usePromote";
import CircleSpinner from "@/components/CircleSpinner";
import EmptyState from "@/components/EmptyState";

const money = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  available: "bg-primary/10 text-primary",
  paid: "bg-secondary text-secondary-foreground",
  reversed: "bg-destructive/10 text-destructive",
};

export default function PromotedSalesView() {
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("suppliers")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      setSupplierId(data?.id ?? null);
    })();
  }, []);

  const { data: rows = [], isLoading } = usePromotedSales(supplierId);

  const total = rows.reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);
  const paidOut = rows.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);

  if (isLoading) return <div className="p-8 text-center"><CircleSpinner size={28} /></div>;

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Promoted sales" value={String(rows.length)} />
        <Stat label="Commission owed" value={money(total - paidOut)} />
        <Stat label="Commission paid" value={money(paidOut)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No promoted sales yet" description="Turn on Promote & Earn on a product so promoters can share it." />
      ) : (
        <div className="rounded-xl border divide-y">
          {rows.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 p-3">
              {r.product?.image ? (
                <img src={r.product.image} alt={r.product?.title ?? "Product"} className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{r.product?.title ?? "Product"}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Promoted by {r.promoter?.display_name ?? r.promoter?.username ?? "a promoter"} · {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums">{money(r.commission_amount)}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? "bg-muted"}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
