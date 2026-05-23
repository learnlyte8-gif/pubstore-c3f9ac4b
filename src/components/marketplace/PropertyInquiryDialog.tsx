import { useState } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Button } from "@/components/ui/button";
import type { Property } from "@/data/newVerticals";

export default function PropertyInquiryDialog({
  property, open, onOpenChange,
}: { property: Property; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { requireAuth } = useRequireAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const action = property.listing_type === "sale" ? "Buy inquiry" : property.listing_type === "shared" ? "Shared room request" : "Rental inquiry";

  const submit = async () => {
    const uid = requireAuth({ message: "Sign in to send an inquiry" });
    if (!uid) return;
    setBusy(true);
    const { error } = await supabase.from("property_inquiries").insert({
      property_id: property.id,
      inquirer_id: uid,
      inquirer_name: name || null,
      inquirer_phone: phone || null,
      inquirer_email: email || null,
      preferred_date: date || null,
      message: message || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Inquiry sent — the host will be in touch");
    onOpenChange(false);
    setMessage("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-elevated max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{action}</p>
            <h2 className="font-bold text-lg leading-tight">{property.title}</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Your name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
          </div>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" /></Field>
          <Field label={property.listing_type === "sale" ? "Preferred viewing date" : "Preferred move-in / viewing"}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Message">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Tell the host about your needs…" className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>
          <Button onClick={submit} disabled={busy} className="w-full h-12 mt-1 rounded-full font-bold">
            <Send className="w-4 h-4 mr-2" /> {busy ? "Sending…" : "Send inquiry"}
          </Button>
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
