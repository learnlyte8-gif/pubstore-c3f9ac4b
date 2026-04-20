import { useEffect, useState } from "react";
import {
  TrendingUp,
  Sparkles,
  LayoutGrid,
  Flame,
  Building2,
  Globe2,
  Rocket,
  Crown,
  Activity,
  Compass,
  Users,
  Home as HomeIcon,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CategoryGrid from "@/components/marketplace/CategoryGrid";
import PromoBanner from "@/components/marketplace/PromoBanner";
import FlashDeals from "@/components/marketplace/FlashDeals";
import ProductCard from "@/components/marketplace/ProductCard";
import QuickActions from "@/components/marketplace/QuickActions";
import StatsBar from "@/components/marketplace/StatsBar";
import DealOfTheDay from "@/components/marketplace/DealOfTheDay";
import TopSuppliers from "@/components/marketplace/TopSuppliers";
import LiveFeed from "@/components/marketplace/LiveFeed";
import LiveStreamsRail from "@/components/marketplace/LiveStreamsRail";
import BrandSpotlight from "@/components/marketplace/BrandSpotlight";
import NewArrivals from "@/components/marketplace/NewArrivals";
import RegionSourcing from "@/components/marketplace/RegionSourcing";
import CategoryStrip from "@/components/marketplace/CategoryStrip";
import SupplierStories from "@/components/marketplace/SupplierStories";
import VerticalFeed from "@/components/marketplace/VerticalFeed";
import TapsonAssistant from "@/components/TapsonAssistant";
import { TRENDING, PRODUCTS, SUPPLIERS, getRecommended } from "@/data/products";

type Tab = "home" | "fyp" | "following";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "fyp", label: "For you", icon: Compass },
  { id: "following", label: "Following", icon: Users },
];

const Home = () => {
  const [interests, setInterests] = useState<string[]>([]);
  const [name, setName] = useState<string>("");
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("interests, display_name, username")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        setInterests(data.interests ?? []);
        setName(data.display_name || data.username || "");
      }
    });
  }, []);

  // Mock following — gold + verified suppliers
  const followingIds = SUPPLIERS.filter((s) => s.gold || s.verified).slice(0, 4).map((s) => s.id);

  const recommended = getRecommended(interests);
  const half = Math.ceil(PRODUCTS.length / 2);

  return (
    <div className="pb-6">
      {name && (
        <div className="px-4 pt-4">
          <p className="text-xs text-muted-foreground">Hey 👋</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
      )}

      {/* Tab nav */}
      <div className="px-4 mt-3 sticky top-14 z-10 bg-background/90 backdrop-blur pb-2">
        <div className="flex bg-muted rounded-full p-1 shadow-soft">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-bold transition ${
                  active
                    ? "bg-background text-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
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
          <SupplierStories />
          <div className="px-4">
            <StatsBar />
          </div>
          <CategoryGrid />
          <div className="px-4">
            <QuickActions />
          </div>
          <FlashDeals />

          <LiveStreamsRail />

          <section className="px-4 mt-6">
            <SectionHeader icon={Flame} title="Deal of the day" subtitle="Limited stock — ends soon" />
            <div className="mt-3">
              <DealOfTheDay />
            </div>
          </section>

          <section className="px-4 mt-6">
            <SectionHeader icon={Activity} title="Live on PUBSTORE" subtitle="What buyers are doing right now" />
            <LiveFeed />
          </section>

          <section className="px-4 mt-6">
            <SectionHeader icon={TrendingUp} title="Trending now" subtitle="Most loved this week" />
            <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
              {TRENDING.map((p) => (
                <ProductCard key={p.id} product={p} variant="compact" />
              ))}
            </div>
          </section>

          <section className="px-4 mt-6">
            <SectionHeader icon={Building2} title="Top verified suppliers" subtitle="Gold members & trade assured" />
            <TopSuppliers />
          </section>

          <section className="px-4 mt-6">
            <SectionHeader icon={Sparkles} title="For you" subtitle="Picked from your interests" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              {recommended.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>

          <section className="px-4 mt-6">
            <SectionHeader icon={Crown} title="Featured brands" subtitle="Curated supplier collections" />
            <BrandSpotlight />
          </section>

          <CategoryStrip categoryId="electronics" title="Electronics hub" />

          <section className="px-4 mt-6">
            <SectionHeader icon={Rocket} title="New arrivals" subtitle="Fresh on the marketplace" />
            <NewArrivals />
          </section>

          <CategoryStrip categoryId="fashion" title="Fashion & apparel" />

          <section className="px-4 mt-6">
            <SectionHeader icon={Globe2} title="Source by region" subtitle="Top manufacturing hubs" />
            <RegionSourcing />
          </section>

          <CategoryStrip categoryId="home" title="Home & living" />

          <section className="px-4 mt-6">
            <SectionHeader icon={LayoutGrid} title="Explore more" subtitle="Discover the catalog" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              {PRODUCTS.slice(0, half).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>

          <CategoryStrip categoryId="beauty" title="Beauty essentials" />

          <section className="px-4 mt-6">
            <SectionHeader icon={LayoutGrid} title="Keep browsing" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              {PRODUCTS.slice(half).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "fyp" && (
        <div className="animate-fade-in">
          <div className="px-4 mt-3 flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              Picked just for you{interests.length ? ` · ${interests.length} interests` : ""}
            </p>
          </div>
          <VerticalFeed interests={interests} variant="fyp" />
        </div>
      )}

      {tab === "following" && (
        <div className="animate-fade-in">
          <div className="px-4 mt-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              Latest from suppliers you follow ({followingIds.length})
            </p>
          </div>
          <VerticalFeed followingIds={followingIds} variant="following" />
        </div>
      )}

      <TapsonAssistant />
    </div>
  );
};

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
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
      <button className="text-xs text-primary font-semibold">See all</button>
    </div>
  );
}

export default Home;
