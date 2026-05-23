import { useState } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Button } from "@/components/ui/button";
import type { FinanceProduct } from "@/data/newVerticals";

export default function FinanceApplicationDialog({
  product, open, onOpenChange,
}: { product: FinanceProduct; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { requireAuth } = useRequireAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(String(product.min_amount ?? ""));
  const [term, setTerm] = useState(String(product.term_months ?? 12));
  const [purpose, setPurpose] = useState("");
  const [income, setIncome] = useState("");
  const [employment, setEmployment] = useState("employed");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const uid = requireAuth({ message: "Sign in to apply" });
    if (!uid) return;
    if (!name.trim()) { toast.error("Add your full name"); return; }
    setBusy(true);
    const { error } = await supabase.from("finance_applications").insert({
      product_id: product.id,
      applicant_id: uid,
      applicant_name: name.trim(),
      applicant_phone: phone || null,
      applicant_email: email || null,
      amount_requested: amount ? Number(amount) : null,
      term_months: term ? Number(term) : null,
      purpose: purpose || null,
      monthly_income: income ? Number(income) : null,
      employment_status: employment,
      notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted");
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-elevated max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Apply for {product.kind.replace("_", " ")}</p>
            <h2 className="font-bold text-lg leading-tight">{product.title}</h2>
            {product.provider_name && <p className="text-xs text-muted-foreground">{product.provider_name}</p>}
          </div>
          <button onClick={() => onOpenChange(false)} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Full name *"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
          </div>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount requested"><input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
            <Field label="Term (months)"><input type="number" min={1} value={term} onChange={(e) => setTerm(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Monthly income"><input type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
            <Field label="Employment">
              <select value={employment} onChange={(e) => setEmployment(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm">
                <option value="employed">Employed</option>
                <option value="self_employed">Self-employed</option>
                <option value="business_owner">Business owner</option>
                <option value="student">Student</option>
                <option value="unemployed">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Purpose">
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Working capital, vehicle, school fees" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>
          <Button onClick={submit} disabled={busy} className="w-full h-12 mt-1 rounded-full font-bold">
            <Send className="w-4 h-4 mr-2" /> {busy ? "Submitting…" : "Submit application"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">The provider will review and reach out. No hard credit pull at this stage.</p>
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
