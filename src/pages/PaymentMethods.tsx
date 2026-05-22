import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CreditCard, Plus, Trash2, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Method = {
  id: string;
  brand: string;
  last4: string;
  holder: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean | null;
};

const detectBrand = (num: string) => {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6/.test(n)) return "Discover";
  return "Card";
};

export default function PaymentMethods() {
  const [items, setItems] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Method[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    await supabase.from("payment_methods").delete().eq("id", id);
    setItems((xs) => xs.filter((m) => m.id !== id));
    toast.success("Removed");
  };

  const setDefault = async (id: string) => {
    if (!userId) return;
    await supabase.from("payment_methods").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("payment_methods").update({ is_default: true }).eq("id", id);
    await load();
    toast.success("Default updated");
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;
    const f = new FormData(e.currentTarget);
    const number = String(f.get("number") || "").replace(/\s/g, "");
    if (number.length < 12) return toast.error("Invalid card number");
    const last4 = number.slice(-4);
    const brand = detectBrand(number);
    const holder = String(f.get("holder") || "");
    const expRaw = String(f.get("exp") || "");
    const [m, y] = expRaw.split("/").map((s) => parseInt(s.trim(), 10));
    const isFirst = items.length === 0;
    await supabase.from("payment_methods").insert({
      user_id: userId,
      brand,
      last4,
      holder,
      exp_month: Number.isFinite(m) ? m : null,
      exp_year: Number.isFinite(y) ? (y < 100 ? 2000 + y : y) : null,
      is_default: isFirst,
    });
    setAdding(false);
    await load();
    toast.success("Payment method added");
  };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Payment methods</h1>
      </header>

      <div className="px-4 py-4 space-y-3">
        {loading && <p className="text-center text-sm text-muted-foreground py-8"><CircleSpinner size={28} /></p>}

        {!loading && items.length === 0 && !adding && (
          <div className="text-center py-12">
            <CreditCard className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-bold mt-2">No payment methods</p>
            <p className="text-xs text-muted-foreground mt-1">Add a card to speed up checkout.</p>
          </div>
        )}

        {!adding && items.map((m) => (
          <div key={m.id} className="bg-card rounded-2xl border shadow-card p-4 flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-elevated">
              <CreditCard className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">{m.brand} •••• {m.last4}</p>
                {m.is_default && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Default</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {m.holder ?? "—"}{m.exp_month && m.exp_year ? ` · Exp ${String(m.exp_month).padStart(2, "0")}/${String(m.exp_year).slice(-2)}` : ""}
              </p>
            </div>
            {!m.is_default && (
              <button onClick={() => setDefault(m.id)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center" aria-label="Set default">
                <Star className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => remove(m.id)} className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center" aria-label="Remove">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {adding ? (
          <form onSubmit={onSubmit} className="bg-card rounded-2xl border shadow-card p-4 space-y-3">
            <p className="font-bold">New card</p>
            <div>
              <Label className="text-xs">Card number</Label>
              <Input name="number" required inputMode="numeric" placeholder="4242 4242 4242 4242" />
            </div>
            <div>
              <Label className="text-xs">Cardholder</Label>
              <Input name="holder" required placeholder="Full name" />
            </div>
            <div>
              <Label className="text-xs">Expiry (MM/YY)</Label>
              <Input name="exp" required placeholder="12/27" />
            </div>
            <p className="text-[10px] text-muted-foreground">Card stored for display only. No real charges.</p>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save</Button>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setAdding(true)} className="w-full h-12 mt-2"><Plus className="w-4 h-4 mr-2" /> Add payment method</Button>
        )}

        <div className="bg-muted rounded-2xl p-4 mt-4 flex gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Secured by Trade Assurance</p>
            <p className="text-xs text-muted-foreground mt-0.5">Payments are protected end-to-end. We never store your full card details on our servers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
