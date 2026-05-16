import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, X, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { sendCartUnlockMessage } from "@/lib/inquiryGate";

type Inquiry = {
  id: string;
  product_id: string;
  product_title: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type Props = { buyerId: string; supplierId: string; userId: string };

export default function InquiryApprovalPanel({ buyerId, supplierId, userId }: Props) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("product_inquiries")
      .select("id,product_id,product_title,message,status,created_at")
      .eq("buyer_id", buyerId)
      .eq("supplier_id", supplierId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Inquiry[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`inq-panel:${supplierId}:${buyerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_inquiries", filter: `supplier_id=eq.${supplierId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId, supplierId]);

  const decide = async (id: string, status: "approved" | "declined") => {
    setBusy(id);
    const item = items.find((x) => x.id === id);
    const { error } = await supabase
      .from("product_inquiries")
      .update({ status, decided_at: new Date().toISOString(), decided_by: userId })
      .eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    if (status === "approved" && item) {
      await sendCartUnlockMessage({
        buyerId, supplierId, supplierOwnerId: userId, productId: item.product_id,
      });
    }
    toast.success(status === "approved" ? "Buyer can now add to cart" : "Inquiry declined");
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  if (items.length === 0) return null;

  return (
    <div className="border-b border-border/60 bg-amber-500/5 px-3 py-2 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Trade Assurance · {items.length} pending request{items.length > 1 ? "s" : ""}
      </p>
      {items.map((it) => (
        <div key={it.id} className="rounded-lg border border-amber-500/30 bg-background p-2.5">
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <Link to={`/product/${it.product_id}`} className="text-sm font-semibold truncate block hover:underline">
                {it.product_title ?? "Product inquiry"}
              </Link>
              {it.message && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{it.message}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => decide(it.id, "declined")} disabled={busy === it.id} className="flex-1 h-8 gap-1">
              <X className="w-3.5 h-3.5" /> Decline
            </Button>
            <Button size="sm" onClick={() => decide(it.id, "approved")} disabled={busy === it.id} className="flex-1 h-8 gap-1">
              <Check className="w-3.5 h-3.5" /> Approve add-to-cart
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
