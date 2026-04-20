import { useEffect, useState } from "react";
import {
  TrendingUp, Sparkles, LayoutGrid, Building2, Compass, Users, Home as HomeIcon, Store as StoreIcon,
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
  const { data: suppliers = [] } = useSuppliers({ limit: 6 });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase.from("profiles").select("interests").eq("user_id", session.user.id).maybeSingle();
      if (data) setInterests(data.interests ?? []);
    });
  }, []);

  return (
    <div className="pb-6">
      <div className="px-4 mt-3 sticky top-14 z-10 bg-background/90 backdrop-blur pb-2 pt-1">
        <div className="flex bg-muted rounded-full p-1 shadow-soft">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-bold transition ${
                  active ? "bg-background text-foreground shadow-card" : "text-muted-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "home" && (
        <div className="animate-fade-in">
          <PromoBanner />
          <div className="px-4"><StatsBar /></div>
          <CategoryGrid />

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
      <div className="flex items-start gap-2">
        {Icon && (
          <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center mt-0.5 shadow-soft">
            <Icon className="w-4 h-4 text-foreground" strokeWidth={1.8} />
          </span>
        )}
        <div>
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export default Home;
