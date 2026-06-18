import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Store, CheckCircle2, TrendingUp, Globe, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BecomeSupplier() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", country: "", about: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase
        .from("suppliers").select("id").eq("owner_id", user.id).is("mirror_of", null).maybeSingle();
      if (data) navigate("/store", { replace: true });
    })();
  }, [navigate]);

  const benefits = [
    { icon: Globe, title: "Global reach", desc: "Sell to buyers in 200+ countries" },
    { icon: Shield, title: "Trade Assurance", desc: "Built-in payment & shipping protection" },
    { icon: TrendingUp, title: "Smart promo tools", desc: "AI insights, deals, live shopping" },
    { icon: Zap, title: "Fast onboarding", desc: "Start selling in under 10 minutes" },
  ];

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Store name is required"); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      // Upsert supplier role (composite primary key on user_id+role isn't there,
      // so we delete-then-insert to stay idempotent)
      await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", "supplier");
      await supabase.from("user_roles").insert({ user_id: user.id, role: "supplier" });

      // Seed supplier verticals from the buyer's onboarding picks so MyStore
      // immediately shows just the relevant tools.
      const { data: prof } = await supabase
        .from("profiles").select("verticals").eq("user_id", user.id).maybeSingle();
      const seededVerticals = ((prof as any)?.verticals ?? []) as string[];

      // Create supplier row
      const { error: supErr } = await (supabase.from("suppliers") as any).insert({
        owner_id: user.id,
        name: form.name.trim(),
        country: form.country.trim() || null,
        about: form.about.trim() || null,
        verified: false,
        gold: false,
        trade_assurance: true,
        rating: 0,
        response_rate: 95,
        response_time: "≤ 24h",
        on_time_delivery: 100,
        years_active: 0,
        verticals: seededVerticals,
      });
      if (supErr) throw supErr;

      toast.success("Welcome to PUBSTORE Sellers 🎉");
      navigate("/store");
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't create store");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/account" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-bold text-lg flex-1">Become a supplier</h1>
      </header>

      {step === 0 ? (
        <div>
          <div className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground px-6 py-8">
            <Store className="w-10 h-10 mb-2" />
            <h2 className="font-brand text-3xl leading-tight">Start selling on PUBSTORE</h2>
            <p className="text-sm opacity-90 mt-1">Set up your store and list your first product in minutes.</p>
          </div>
          <div className="px-4 py-5 space-y-3">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card rounded-2xl border shadow-card p-4 flex gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <b.icon className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-bold text-sm">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>
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
          <p className="font-bold text-lg">Tell us about your store</p>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Store name *" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country / Region" className="w-full h-12 rounded-xl border bg-background px-4 text-sm" />
          <textarea value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="What do you sell?" rows={4} className="w-full rounded-xl border bg-background p-4 text-sm" />

          <div className="flex items-start gap-2 bg-muted p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">By continuing you agree to the PUBSTORE Seller Terms and Trade Assurance program.</p>
          </div>

          <Button onClick={submit} disabled={loading || !form.name.trim()} className="w-full h-12">
            {loading ? "Creating..." : "Create my store"}
          </Button>
        </div>
      )}
    </div>
  );
}
