import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, X, ChevronDown, ChevronUp, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { sendCartUnlockMessage } from "@/lib/inquiryGate";

type Row = {
  id: string;
  product_id: string;
  product_title: string | null;
  message: string | null;
  status: string;
  created_at: string;
  buyer_id: string;
  supplier_id: string;
  buyer_name?: string | null;
  buyer_avatar?: string | null;
};

type Props = { userId: string };

export default function PendingInquiriesInbox({ userId }: Props) {
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);

  const load = async () => {
    const { data: sups } = await supabase.from("suppliers").select("id").eq("owner_id", userId);
    const ids = (sups ?? []).map((s: any) => s.id);
    setSupplierIds(ids);
    if (ids.length === 0) { setItems([]); return; }
    const { data } = await supabase
      .from("product_inquiries")
      .select("id,product_id,product_title,message,status,created_at,buyer_id,supplier_id")
      .in("supplier_id", ids)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Row[];
    const buyerIds = Array.from(new Set(rows.map((r) => r.buyer_id)));
    if (buyerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,avatar_url")
        .in("user_id", buyerIds);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      rows.forEach((r) => {
        const p = map.get(r.buyer_id);
        r.buyer_name = p?.display_name || p?.username || "Customer";
        r.buyer_avatar = p?.avatar_url ?? null;
      });
    }
    setItems(rows);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`pending-inbox:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_inquiries" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (items.length === 0) return null;

  const allSelected = selected.size === items.length;
  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const decideBulk = async (status: "approved" | "declined") => {
    const ids = selected.size > 0 ? Array.from(selected) : items.map((i) => i.id);
    if (ids.length === 0) return;
    setBusy(true);
    const targets = items.filter((i) => ids.includes(i.id));
    const { error } = await supabase
      .from("product_inquiries")
      .update({ status, decided_at: new Date().toISOString(), decided_by: userId })
      .in("id", ids);
    if (error) { toast.error(error.message); setBusy(false); return; }
    if (status === "approved") {
      await Promise.all(
        targets.map((t) =>
          sendCartUnlockMessage({
            buyerId: t.buyer_id,
            supplierId: t.supplier_id,
            supplierOwnerId: userId,
            productId: t.product_id,
          }),
        ),
      );
    }
    toast.success(
      status === "approved"
        ? `Approved ${ids.length} inquir${ids.length > 1 ? "ies" : "y"} · buyers notified in chat`
        : `Declined ${ids.length} inquir${ids.length > 1 ? "ies" : "y"}`,
    );
    setSelected(new Set());
    setBusy(false);
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  };

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs font-bold flex-1">
          Trade Assurance · {items.length} pending inquir{items.length > 1 ? "ies" : "y"}
        </p>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <>
          <div className="flex items-center gap-2 px-3 pb-2">
            <button
              onClick={toggleAll}
              className="text-[11px] font-semibold px-2 py-1 rounded-full bg-background border border-border/60"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : "Choose to bulk action"}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => decideBulk("declined")}
                className="h-7 px-2 gap-1 text-[11px]"
              >
                <X className="w-3.5 h-3.5" /> Decline {selected.size > 0 ? `(${selected.size})` : "all"}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => decideBulk("approved")}
                className="h-7 px-2 gap-1 text-[11px]"
              >
                <Check className="w-3.5 h-3.5" /> Approve {selected.size > 0 ? `(${selected.size})` : "all"}
              </Button>
            </div>
          </div>
          <ul className="max-h-[260px] overflow-y-auto bg-background/60">
            {items.map((it) => {
              const on = selected.has(it.id);
              return (
                <li key={it.id} className="flex items-center gap-2 px-3 py-2 border-t border-border/40">
                  <button
                    onClick={() => toggle(it.id)}
                    aria-label="Select"
                    className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                  >
                    {on && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                    {it.buyer_avatar ? <img src={it.buyer_avatar} alt="" className="w-full h-full object-cover" /> : (it.buyer_name?.[0] ?? "C")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate">
                      {it.buyer_name} · <Link to={`/product/${it.product_id}`} className="text-primary hover:underline inline-flex items-center gap-0.5"><Package className="w-3 h-3" />{it.product_title ?? "Product"}</Link>
                    </p>
                    {it.message && <p className="text-[10px] text-muted-foreground truncate">{it.message}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
