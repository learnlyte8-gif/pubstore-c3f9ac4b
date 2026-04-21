import { useEffect, useState } from "react";
import {
  TrendingUp, Sparkles, LayoutGrid, Building2, Compass, Users, Home as HomeIcon, Store as StoreIcon,
  Globe2, Award, Newspaper, Zap, ShieldCheck, Truck, Flame,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import CategoryGrid from "@/components/marketplace/CategoryGrid";
import PromoBanner from "@/components/marketplace/PromoBanner";
import ProductCard from "@/components/marketplace/ProductCard";
import StatsBar from "@/components/marketplace/StatsBar";
import TopSuppliers from "@/components/marketplace/TopSuppliers";
import VerticalFeed from "@/components/marketplace/VerticalFeed";
import SuppliersNearMe from "@/components/marketplace/SuppliersNearMe";
import SupplierStories from "@/components/marketplace/SupplierStories";
import QuickActions from "@/components/marketplace/QuickActions";
import BrandSpotlight from "@/components/marketplace/BrandSpotlight";
import RegionSourcing from "@/components/marketplace/RegionSourcing";
import LiveFeed from "@/components/marketplace/LiveFeed";
import LiveStreamsRail from "@/components/marketplace/LiveStreamsRail";
import PromoTile from "@/components/marketplace/PromoTile";
import CategoryCallout from "@/components/marketplace/CategoryCallout";
import RecommendationStrip from "@/components/marketplace/RecommendationStrip";
import TapsonAssistant from "@/components/TapsonAssistant";
import EmptyState from "@/components/EmptyState";
import { useProducts, useSuppliers } from "@/hooks/useCatalog";

type Tab = "home" | "fyp" | "following";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "fyp", label: "For you", icon: Compass },
  { id: "following", label: "Following", icon: Users },
];

const Home = () => {
  const [interests, setInterests] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const { data: products = [], isLoading } = useProducts({ limit: 50 });
  const { data: trending = [] } = useProducts({ sortBy: "sold", limit: 6 });
  const { data: dealPool = [] } = useProducts({ sortBy: "newest", limit: 50 });
  const { data: suppliers = [] } = useSuppliers({ limit: 6 });

  // Real flash deals: products with an active deal_ends_at OR ≥30% off
  const now = Date.now();
  const flashDeals = dealPool
    .filter((p) => {
      const stillRunning = p.dealEndsAt ? new Date(p.dealEndsAt).getTime() > now : false;
      const bigDiscount = p.originalPrice && p.originalPrice > p.price && (p.originalPrice - p.price) / p.originalPrice >= 0.3;
      return stillRunning || bigDiscount;
    })
    .sort((a, b) => {
      // products with countdown first
      if (!!a.dealEndsAt === !!b.dealEndsAt) return 0;
      return a.dealEndsAt ? -1 : 1;
    })
    .slice(0, 8);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase.from("profiles").select("interests").eq("user_id", session.user.id).maybeSingle();
      if (data) setInterests(data.interests ?? []);
    });
  }, []);

  return (
    <div className="pb-6">
      <div className="px-4 mt-3 sticky top-14 z-10 glass-strong pb-2 pt-2">
        <div className="relative flex bg-muted/70 rounded-full p-1 shadow-card">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-bold transition-all duration-300 ${
                  active
                    ? "bg-ig-gradient text-white shadow-pop scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.6 : 2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "home" && (
        <div className="animate-fade-in">
          <PromoBanner />
          <SupplierStories />
          <div className="px-4"><QuickActions /></div>
          <div className="px-4"><StatsBar /></div>
          <CategoryGrid />

          <LiveStreamsRail />

          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading marketplace…</p>
          ) : products.length === 0 ? (
            <div className="px-4 mt-4">
              <EmptyState
                icon={<StoreIcon className="w-7 h-7 text-muted-foreground" />}
                title="No products listed yet"
                description="Be one of the first suppliers on PUBSTORE — open your store and list a product."
                action={<Button asChild><Link to="/become-supplier">Open my store</Link></Button>}
              />
            </div>
          ) : (
            <>
              {flashDeals.length > 0 && (
                <section className="px-4 mt-6">
                  <SectionHeader icon={Zap} title="Flash deals" subtitle="30%+ off · limited time" />
                  <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
                    {flashDeals.map((p) => (<ProductCard key={`fd-${p.id}`} product={p} variant="compact" />))}
                  </div>
                </section>
              )}

              {trending.length > 0 && (
                <section className="px-4 mt-6">
                  <SectionHeader icon={TrendingUp} title="Trending now" subtitle="Most ordered this week" />
                  <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
                    {trending.map((p) => (<ProductCard key={p.id} product={p} variant="compact" />))}
                  </div>
                </section>
              )}

              {suppliers.length > 0 && (
                <section className="px-4 mt-6">
                  <SectionHeader icon={Building2} title="Top suppliers" subtitle="Verified stores ready to ship" />
                  <TopSuppliers suppliers={suppliers} />
                </section>
              )}

              <SuppliersNearMe />

              <section className="px-4 mt-6">
                <SectionHeader icon={Award} title="Brand spotlight" subtitle="Featured collections" />
                <BrandSpotlight />
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Globe2} title="Source by region" subtitle="Verified factories worldwide" />
                <RegionSourcing />
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Newspaper} title="Live activity" subtitle="What buyers are doing right now" />
                <LiveFeed />
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Sparkles} title="For you" subtitle="Picked from your interests" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {products.slice(0, 6).map((p) => (<ProductCard key={p.id} product={p} />))}
                </div>
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={LayoutGrid} title="Explore catalog" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {products.slice(6).map((p) => (<ProductCard key={p.id} product={p} />))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {tab === "fyp" && (
        <div className="animate-fade-in">
          {products.length === 0 ? (
            <EmptyState title="Nothing in the feed yet" description="When suppliers list products they'll show up here." />
          ) : (
            <VerticalFeed interests={interests} variant="fyp" products={products} />
          )}
        </div>
      )}

      {tab === "following" && (
        <div className="animate-fade-in">
          <EmptyState
            icon={<Users className="w-7 h-7 text-muted-foreground" />}
            title="You're not following anyone yet"
            description="Visit a supplier's store and tap follow to see their posts here."
          />
        </div>
      )}

      <TapsonAssistant />
    </div>
  );
};

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <span className="relative w-8 h-8 rounded-xl bg-ig-gradient flex items-center justify-center shadow-pop">
            <span className="absolute inset-0.5 rounded-[10px] bg-background/85" />
            <Icon className="w-4 h-4 text-foreground relative z-10" strokeWidth={2} />
          </span>
        )}
        <div>
          <h2 className="text-base font-extrabold leading-tight tracking-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export default Home;
