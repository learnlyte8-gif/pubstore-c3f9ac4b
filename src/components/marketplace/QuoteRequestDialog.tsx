import { useState } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Button } from "@/components/ui/button";

type Subject = { id: string; title: string; category?: string | null; unit?: string | null; moq?: number | null; isProject?: boolean };

export default function QuoteRequestDialog({
  open, onOpenChange, kind, subject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "industrial" | "agro";
  subject: Subject;
}) {
  const { requireAuth } = useRequireAuth();
  const [qty, setQty] = useState<string>(String(subject.moq ?? 1));
  const [targetPrice, setTargetPrice] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const uid = requireAuth({ message: "Sign in to request a quote" });
    if (!uid) return;
    const qtyN = Math.max(1, Number(qty) || 1);
    setBusy(true);
    const { error } = await supabase.from("rfqs").insert({
      buyer_id: uid,
      title: subject.isProject ? `Pledge: ${subject.title}` : subject.title,
      category: subject.category ?? kind,
      qty: qtyN,
      unit: subject.unit ?? null,
      target_price: targetPrice ? Number(targetPrice) : null,
      ship_to: shipTo || null,
      details: `[${kind}#${subject.id}] ${details || (subject.isProject ? "Co-invest pledge" : "Quote request")}`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(subject.isProject ? "Pledge submitted" : "Quote request sent");
    onOpenChange(false);
    setDetails(""); setTargetPrice(""); setShipTo("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-elevated max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{kind === "agro" ? (subject.isProject ? "Co-invest" : "Agro quote") : "Industrial RFQ"}</p>
            <h2 className="font-bold text-lg leading-tight">{subject.title}</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={subject.isProject ? "Pledge units" : "Quantity"}>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
            </Field>
            <Field label={subject.isProject ? "Per unit budget" : "Target price"}>
              <input type="number" min={0} value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="$" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
            </Field>
          </div>
          <Field label="Ship to / Location">
            <input value={shipTo} onChange={(e) => setShipTo(e.target.value)} placeholder="City, country" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label={subject.isProject ? "Message to the project" : "Specs & requirements"}>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder={subject.isProject ? "Why you're backing this project…" : "Specifications, certifications, lead time, payment terms…"} className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>
          <Button onClick={submit} disabled={busy} className="w-full h-12 mt-1 rounded-full font-bold">
            <Send className="w-4 h-4 mr-2" /> {busy ? "Sending…" : subject.isProject ? "Submit pledge" : "Send RFQ"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">The supplier will respond in your Messages and store inbox.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
