import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Store, CheckCircle2, TrendingUp, Globe, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BecomeSupplier() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ store: "", country: "", category: "", description: "" });
  const [loading, setLoading] = useState(false);

  const benefits = [
    { icon: Globe, title: "Global reach", desc: "Sell to buyers in 200+ countries" },
    { icon: Shield, title: "Trade Assurance", desc: "Built-in payment & shipping protection" },
    { icon: TrendingUp, title: "Smart promo tools", desc: "AI insights, deals, live shopping" },
    { icon: Zap, title: "Fast onboarding", desc: "Start selling in under 10 minutes" },
  ];

  const submit = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    await supabase.from("user_roles").upsert({ user_id: session.user.id, role: "supplier" }, { onConflict: "user_id,role" });
    setLoading(false);
    toast.success("Welcome to Pubstore Sellers 🎉");
    navigate("/store");
  };

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-bold text-lg flex-1">Become a supplier</h1>
      </header>

      {step === 0 ? (
        <div>
          <div className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground px-6 py-8">
            <Store className="w-10 h-10 mb-2" />
            <h2 className="font-brand text-3xl leading-tight">Start selling on Pubstore</h2>
            <p className="text-sm opacity-90 mt-1">Join 80k+ verified suppliers earning on the world's smartest B2B marketplace.</p>
          </div>

          <div className="px-4 py-5 space-y-3">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card rounded-2xl border shadow-card p-4 flex gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><b.icon className="w-5 h-5" /></span>
                <div><p className="font-bold text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.desc}</p></div>
              </div>
            ))}
          </div>

          <div className="px-4">
            <Button onClick={() => setStep(1)} className="w-full h-12 shadow-elevated">Get started</Button>
            <p className="text-[11px] text-center text-muted-foreground mt-2">No setup fees · 0% commission for first 30 days</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-5 space-y-4">
          <p className="font-bold text-lg">Tell us about your business</p>
          <input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="Store name" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country / Region" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Main category (e.g. Electronics)" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />

          <div className="flex items-start gap-2 bg-muted p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">By continuing you agree to the Pubstore Seller Terms and Trade Assurance program.</p>
          </div>

          <Button onClick={submit} disabled={loading || !form.store} className="w-full h-12">{loading ? "Creating..." : "Create my store"}</Button>
        </div>
      )}
    </div>
  );
}
