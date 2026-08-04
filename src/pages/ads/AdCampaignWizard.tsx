import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Image as ImageIcon, MousePointerClick, Eye, Tv, Gift, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchMySupplier, fetchProducts } from "@/data/products";
import { usePlanFeature, UpgradeNotice } from "@/components/store/PlanGate";

const sb = supabase as any;

type Placement = "banner" | "inline" | "interstitial" | "rewarded";

const PLACEMENTS: { id: Placement; label: string; icon: any; hint: string; defaultMode: "flat_boost" | "cpc"; minBudget: number }[] = [
  { id: "banner",       label: "Sticky banner",   icon: Eye,               hint: "Bottom of every page · CPC auction", defaultMode: "cpc",        minBudget: 5 },
  { id: "inline",       label: "Feed card",       icon: ImageIcon,         hint: "Sponsored card inside Home / For You", defaultMode: "flat_boost", minBudget: 1 },
  { id: "interstitial", label: "Full-screen",     icon: Tv,                hint: "Once per session · skippable",      defaultMode: "cpc",        minBudget: 10 },
  { id: "rewarded",     label: "Rewarded reel",   icon: Gift,              hint: "Users earn loyalty points · 15s",   defaultMode: "flat_boost", minBudget: 3 },
];

export default function AdCampaignWizard() {
  const navigate = useNavigate();
  const { data: supplier } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: products = [] } = useQuery({
    queryKey: ["my-products-all", supplier?.id],
    enabled: !!supplier,
    queryFn: () => fetchProducts({ supplierId: supplier!.id, limit: 100 }),
  });

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState<string>("");
  const [placement, setPlacement] = useState<Placement>("inline");
  const [pricingMode, setPricingMode] = useState<"flat_boost" | "cpc">("flat_boost");
  const [dailyBudget, setDailyBudget] = useState(5);
  const [maxBid, setMaxBid] = useState(0.25);
  const [headline, setHeadline] = useState("");
  const [tagline, setTagline] = useState("");
  const [cta, setCta] = useState("Shop now");
  const [categories, setCategories] = useState("");
  const [countries, setCountries] = useState("");
  const [interests, setInterests] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const product = useMemo(() => products.find((p: any) => p.id === productId), [products, productId]);

  // Auto-fill creative from product when selected
  useEffect(() => {
    if (!product) return;
    if (!headline) setHeadline(product.title?.slice(0, 60) ?? "");
    if (!tagline) {
      const t = product.description?.slice(0, 100) ?? "";
      setTagline(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const onPlacementChange = (p: Placement) => {
    setPlacement(p);
    const def = PLACEMENTS.find((x) => x.id === p)!;
    setPricingMode(def.defaultMode);
    setDailyBudget(def.minBudget);
  };

  const submit = async () => {
    if (!supplier) { toast.error("Create your store first"); return; }
    if (!productId) { toast.error("Pick a product"); return; }
    if (!headline.trim()) { toast.error("Add a headline"); return; }
    setSubmitting(true);
    const image = product?.image || product?.gallery?.[0] || null;
    const targeting = {
      categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
      countries: countries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
      interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await sb.from("ad_campaigns").insert({
      owner_id: user?.id,
      supplier_id: supplier.id,
      product_id: productId,
      name: headline.trim().slice(0, 80),
      placement,
      pricing_mode: pricingMode,
      daily_budget: Number(dailyBudget) || 0,
      max_bid_cpc: pricingMode === "cpc" ? Number(maxBid) || 0 : 0,
      creative: { headline: headline.trim(), tagline: tagline.trim(), image, cta: cta.trim() || "Shop now" },
      targeting,
      status: "active",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campaign launched 🚀");
    navigate("/store/ads");
  };

  const aiPrefill = async () => {
    if (!product) return;
    setHeadline(product.title?.slice(0, 60) ?? "");
    setTagline(`Don't miss out — ${product.title} from $${Number(product.price).toFixed(2)}`);
    setCta("Shop now");
    toast.success("Creative prefilled");
  };

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/store/ads" className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold leading-tight">New ad campaign</h1>
            <p className="text-[11px] text-muted-foreground">Step {step + 1} of 4</p>
          </div>
        </div>
        <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
      </header>

      <div className="px-4 mt-5 space-y-5">
        {step === 0 && (
          <section>
            <h2 className="text-sm font-bold mb-2">1. Pick a product</h2>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no products yet. <Link to="/store/products/new" className="text-primary font-bold">Add one →</Link></p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {products.map((p: any) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setProductId(p.id)}
                      className={`w-full text-left rounded-2xl overflow-hidden border bg-card transition ${productId === p.id ? "ring-2 ring-primary border-primary" : ""}`}
                    >
                      <div className="aspect-square bg-muted">
                        {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold line-clamp-2 leading-tight">{p.title}</p>
                        <p className="text-[11px] text-muted-foreground">${Number(p.price).toFixed(2)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 1 && (
          <section>
            <h2 className="text-sm font-bold mb-2">2. Where to show</h2>
            <ul className="space-y-2">
              {PLACEMENTS.map((p) => {
                const Icon = p.icon;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => onPlacementChange(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border bg-card text-left transition ${placement === p.id ? "ring-2 ring-primary border-primary" : ""}`}
                    >
                      <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground">{p.hint}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">3. Creative</h2>
              <Button size="sm" variant="outline" onClick={aiPrefill} disabled={!product}>
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Prefill
              </Button>
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Headline ({headline.length}/60)</label>
              <Input value={headline} maxLength={60} onChange={(e) => setHeadline(e.target.value)} placeholder="Punchy hook" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Tagline ({tagline.length}/120)</label>
              <Input value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="What the buyer gets" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground">CTA</label>
              <Input value={cta} maxLength={20} onChange={(e) => setCta(e.target.value)} placeholder="Shop now" />
            </div>
            {product && (
              <div className="rounded-2xl border p-3 bg-card flex items-center gap-3">
                <img src={product.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                <div className="text-xs">
                  <p className="font-bold">Preview</p>
                  <p className="text-muted-foreground">{headline || "—"}</p>
                  <p className="text-muted-foreground text-[11px]">{tagline || "—"}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">4. Budget & targeting</h2>

            <div className="rounded-2xl border p-3 bg-card space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setPricingMode("flat_boost")}
                  className={`flex-1 px-3 h-10 rounded-xl text-xs font-bold border ${pricingMode === "flat_boost" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                >
                  Flat boost
                </button>
                <button
                  onClick={() => setPricingMode("cpc")}
                  className={`flex-1 px-3 h-10 rounded-xl text-xs font-bold border ${pricingMode === "cpc" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                >
                  CPC auction
                </button>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground">Daily budget ($)</label>
                <Input type="number" min={1} step={1} value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground mt-1">Charged from your wallet. Auto-pauses when exhausted.</p>
              </div>
              {pricingMode === "cpc" && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Max bid per click ($)</label>
                  <Input type="number" min={0.05} step={0.05} value={maxBid} onChange={(e) => setMaxBid(Number(e.target.value))} />
                  <p className="text-[10px] text-muted-foreground mt-1">Highest bidder wins the slot.</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border p-3 bg-card space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Targeting (optional)</p>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground">Categories</label>
                <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="electronics, fashion" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground">Countries (ISO code)</label>
                <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="US, NG, ZA" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground">Interests</label>
                <Input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="sneakers, gadgets" />
              </div>
              <p className="text-[10px] text-muted-foreground">Leave blank to target everyone.</p>
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 bg-background/95 backdrop-blur border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2 z-30">
        {step > 0 && <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>Back</Button>}
        {step < 3 ? (
          <Button
            className="flex-1"
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 0 && !productId)}
          >
            Continue
          </Button>
        ) : (
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? "Launching…" : "Launch campaign"}
          </Button>
        )}
      </div>
    </div>
  );
}
