import { useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp, Sparkles, LayoutGrid, Building2, Compass, Users, Home as HomeIcon, Store as StoreIcon,
  Globe2, Award, Newspaper, Zap, ShieldCheck, Truck, Flame,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PromoBanner from "@/components/marketplace/PromoBanner";
import ProductCard from "@/components/marketplace/ProductCard";
import TopSuppliers from "@/components/marketplace/TopSuppliers";
import VerticalFeed from "@/components/marketplace/VerticalFeed";
import SuppliersNearMe from "@/components/marketplace/SuppliersNearMe";
import LiveStatsBanner from "@/components/marketplace/LiveStatsBanner";
import QuickActions from "@/components/marketplace/QuickActions";
import BrandSpotlight from "@/components/marketplace/BrandSpotlight";
import RegionSourcing from "@/components/marketplace/RegionSourcing";
import LiveFeed from "@/components/marketplace/LiveFeed";
import LiveStreamsRail from "@/components/marketplace/LiveStreamsRail";
import PromoTile from "@/components/marketplace/PromoTile";
import CategoryCallout from "@/components/marketplace/CategoryCallout";
import RecommendationStrip from "@/components/marketplace/RecommendationStrip";
import DepartmentsBar from "@/components/marketplace/DepartmentsBar";
import NewsRail from "@/components/marketplace/NewsRail";
import StaysRail from "@/components/marketplace/StaysRail";
import AutoRail from "@/components/marketplace/AutoRail";
import IndustrialRail from "@/components/marketplace/IndustrialRail";
import AgroRail from "@/components/marketplace/AgroRail";
import ServicesRail from "@/components/marketplace/ServicesRail";
import PropertiesRail from "@/components/marketplace/PropertiesRail";
import FinanceRail from "@/components/marketplace/FinanceRail";
import CarRentalsRail from "@/components/marketplace/CarRentalsRail";
import JobsRail from "@/components/marketplace/JobsRail";
import LogisticsRail from "@/components/marketplace/LogisticsRail";
import FreelanceGigsRail from "@/components/marketplace/FreelanceGigsRail";
import TapsonAssistant from "@/components/TapsonAssistant";
import EmptyState from "@/components/EmptyState";
import SupplierCard from "@/components/marketplace/SupplierCard";
import { useProducts, useSuppliers } from "@/hooks/useCatalog";
import { useFollowingFeed, useFollowingSupplierIds, useAuthUserId } from "@/hooks/useFollowing";
import { useMyInterests, useWishlistInterestSlugs, interestsToSlugs, prioritizeByCategories, useRecentSearchSlugs, rankByAffinity } from "@/hooks/useInterests";
import { useClickAffinity, useRefreshFeed } from "@/hooks/usePersonalizationLog";
import { useTradeMode } from "@/hooks/useTradeMode";
import TradeModeSwitch from "@/components/marketplace/TradeModeSwitch";
import { useWallet } from "@/hooks/useWallet";
import { Wallet as WalletIcon, Plus, RefreshCw } from "lucide-react";

type Tab = "home" | "fyp" | "following";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "fyp", label: "For you", icon: Compass },
  { id: "following", label: "Following", icon: Users },
];

const Home = () => {
  const [tab, setTab] = useState<Tab>("home");
  const { interests } = useMyInterests();
  const wishlistSlugs = useWishlistInterestSlugs();
  const { slugs: searchSlugs, tokens: searchTokens } = useRecentSearchSlugs();
  const { counts: clickCounts, tokens: clickTokens } = useClickAffinity();
  const { seed, refresh } = useRefreshFeed();
  const interestSlugs = interestsToSlugs(interests);
  const prioritySlugs = [...interestSlugs, ...wishlistSlugs, ...searchSlugs];
  // Weighted counts: interests count twice (explicit), wishlist/search once.
  const priorityCounts = prioritySlugs.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  for (const s of interestSlugs) priorityCounts[s] = (priorityCounts[s] ?? 0) + 1;
  // Merge in click-derived affinity (already weighted by recency in the hook).
  for (const [cat, n] of Object.entries(clickCounts)) priorityCounts[cat] = (priorityCounts[cat] ?? 0) + n;

  const { balance, userId: walletUserId } = useWallet();
  const { mode: tradeMode } = useTradeMode();

  const { data: rawProducts = [], isLoading } = useProducts({ limit: 80, tradeMode });
  const { data: trending = [] } = useProducts({ sortBy: "sold", limit: 6, tradeMode });
  const { data: dealPool = [] } = useProducts({ sortBy: "newest", limit: 50, tradeMode });
  const { data: suppliers = [] } = useSuppliers({ limit: 6 });

  // Personalized ordering: rank by affinity (interests + wishlist + searches + clicks).
  // The `seed` reshuffles ties when the user taps "Refresh my feed".
  const allTokens = [...searchTokens, ...clickTokens];
  const ranked = rankByAffinity(rawProducts, priorityCounts, allTokens);
  const products = seed > 0 ? [...ranked].sort(() => Math.random() - 0.5) : ranked;

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

  return (
    <div className="pb-6">
      <div className="px-4 mt-3 sticky top-14 z-10 glass-strong pb-2 pt-2 space-y-2">
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
        <div className="flex items-center justify-center gap-2">
          <TradeModeSwitch />
          <button
            onClick={() => { refresh(); toast.success("Feed refreshed", { description: "Reordered using your latest activity" }); }}
            aria-label="Refresh my feed"
            className="h-8 px-3 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center gap-1.5 shadow-card active:scale-95 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${seed > 0 ? "animate-spin-once" : ""}`} strokeWidth={2.6} />
            Refresh feed
          </button>
        </div>
      </div>

      {tab === "home" && (
        <div className="animate-fade-in">
          <PromoBanner />
          <DepartmentsBar />
          {walletUserId && (
            <Link to="/wallet" className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-3.5 shadow-elevated relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/10 blur-2xl" />
              <span className="relative w-10 h-10 rounded-xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
                <WalletIcon className="w-5 h-5" />
              </span>
              <div className="relative flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">PUBSTORE Pay</p>
                <p className="text-xl font-black tracking-tighter tabular-nums leading-none">${balance.toFixed(2)}</p>
              </div>
              <span className="relative h-8 px-3 rounded-full bg-primary-foreground text-primary text-xs font-black flex items-center gap-1 shadow-card">
                <Plus className="w-3 h-3" strokeWidth={3} /> Top up
              </span>
            </Link>
          )}
          <LiveStatsBanner />
          <div className="px-4"><QuickActions /></div>


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

              <JobsRail />

              <FreelanceGigsRail />

              <LogisticsRail />


              {suppliers.length > 0 && (
                <section className="px-4 mt-6">
                  <SectionHeader icon={Building2} title="Top suppliers" subtitle="Verified stores ready to ship" />
                  <TopSuppliers suppliers={suppliers} />
                </section>
              )}

              <SuppliersNearMe />

              <section className="px-4 mt-6">
                <SectionHeader icon={Sparkles} title="For you" subtitle="Picked from your interests" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {products.slice(0, 6).map((p) => (<ProductCard key={p.id} product={p} />))}
                </div>
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Award} title="Brand spotlight" subtitle="Featured collections" />
                <BrandSpotlight />
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Globe2} title="Source by region" subtitle="Verified factories worldwide" />
                <RegionSourcing />
              </section>

              <NewsRail />

              <StaysRail />

              <section className="px-4 mt-6">
                <SectionHeader icon={Newspaper} title="Live activity" subtitle="What buyers are doing right now" />
                <LiveFeed />
              </section>

              <AutoRail />

              <ServicesRail />

              <CarRentalsRail />

              <PropertiesRail />

              <FinanceRail />

              <IndustrialRail />

              <AgroRail />

              <section className="px-4 mt-6">
                <SectionHeader icon={LayoutGrid} title="Explore catalog" subtitle="Mixed picks, ads & ideas" />
                <MixedCatalogGrid products={products.slice(6)} hero={products[0]} />
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
          <FollowingTab />
        </div>
      )}

      
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

/**
 * MixedCatalogGrid — interleaves product cards with promotional tiles,
 * category callouts, an ad slot and a recommendation strip so the
 * "Explore catalog" surface feels like a curated feed instead of a wall.
 *
 * Full-width inserts (col-span-2) are aligned to row starts so we never
 * leave a blank cell next to them.
 */
function MixedCatalogGrid({ products, hero }: { products: import("@/data/products").Product[]; hero?: import("@/data/products").Product }) {
  if (products.length === 0) return null;

  const dealSeed = products.find((p) => p.originalPrice && p.originalPrice > p.price) ?? products[0];
  const newSeed = products.find((p) => p.badge === "New") ?? products[1] ?? products[0];
  const editorSeed = hero ?? products[2] ?? products[0];

  type Insert = { after: number; span: 1 | 2; node: React.ReactNode };
  // `after` = how many product cards must appear before this insert
  const inserts: Insert[] = [
    { after: 2, span: 1, node: <PromoTile key="promo-deal" product={dealSeed} variant="deal" /> },
    {
      after: 4, span: 2, node: (
        <CategoryCallout
          key="cat-fresh"
          title="Verified factories ready to ship today"
          subtitle="Trade Assurance"
          href="/categories"
          icon={ShieldCheck}
          tone="primary"
        />
      ),
    },
    { after: 6, span: 2, node: <RecommendationStrip key="rec-strip" /> },
    { after: 8, span: 1, node: <PromoTile key="promo-editor" product={editorSeed} variant="editor" /> },
    {
      after: 10, span: 2, node: (
        <CategoryCallout
          key="cat-warm"
          title="Free shipping on orders over $50"
          subtitle="Limited time"
          href="/categories"
          icon={Truck}
          tone="warm"
        />
      ),
    },
    { after: 13, span: 1, node: <PromoTile key="promo-new" product={newSeed} variant="new" /> },
    {
      after: 16, span: 2, node: (
        <CategoryCallout
          key="cat-flash"
          title="Hottest categories this week"
          subtitle="Trending now"
          href="/categories"
          icon={Flame}
          tone="ink"
        />
      ),
    },
  ];

  const cells: React.ReactNode[] = [];
  let col = 0; // current column position (0 or 1) within the 2-col grid
  let placed = 0; // products placed so far
  let prodIndex = 0;

  const placeProduct = () => {
    const p = products[prodIndex++];
    if (!p) return false;
    cells.push(<ProductCard key={p.id} product={p} />);
    col = (col + 1) % 2;
    placed++;
    return true;
  };

  const placeInsert = (ins: Insert) => {
    // If a full-width insert lands mid-row, fill the empty cell with a product first
    if (ins.span === 2 && col === 1) {
      if (!placeProduct()) {
        // No product left to fill — skip the insert to avoid a blank gap
        return;
      }
    }
    cells.push(ins.node);
    col = ins.span === 2 ? 0 : (col + 1) % 2;
  };

  // Walk products and insert callouts at the requested counts
  while (prodIndex < products.length) {
    const due = inserts.find((x) => x.after === placed);
    if (due) {
      // remove so we don't re-insert
      inserts.splice(inserts.indexOf(due), 1);
      placeInsert(due);
      continue;
    }
    if (!placeProduct()) break;
  }

  return <div className="grid grid-cols-2 gap-3 mt-3">{cells}</div>;
}

function FollowingTab() {
  const userId = useAuthUserId();
  const { data: ids = [], isLoading: loadingIds } = useFollowingSupplierIds();
  const { data, isLoading } = useFollowingFeed();

  if (!userId) {
    return (
      <div className="px-4 mt-4">
        <EmptyState
          icon={<Users className="w-7 h-7 text-muted-foreground" />}
          title="Sign in to see your following feed"
          description="Follow suppliers and their newest products land here."
          action={<Button asChild><Link to="/auth">Sign in</Link></Button>}
        />
      </div>
    );
  }

  if (loadingIds || isLoading) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading your feed…</p>;
  }

  if (ids.length === 0) {
    return (
      <div className="px-4 mt-4">
        <EmptyState
          icon={<Users className="w-7 h-7 text-muted-foreground" />}
          title="You're not following anyone yet"
          description="Visit a supplier's store and tap follow to see their posts here."
          action={<Button asChild><Link to="/categories">Discover suppliers</Link></Button>}
        />
      </div>
    );
  }

  const products = data?.products ?? [];
  const suppliers = data?.suppliers ?? [];

  return (
    <div className="pb-2">
      {suppliers.length > 0 && (
        <section className="px-4 mt-4">
          <SectionHeader icon={Users} title="Suppliers you follow" subtitle={`${suppliers.length} store${suppliers.length === 1 ? "" : "s"}`} />
          <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
            {suppliers.map((s) => (
              <div key={s.id} className="shrink-0 w-64">
                <SupplierCard supplier={s} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 mt-6">
        <SectionHeader icon={Sparkles} title="Latest from your follows" subtitle="Newest products from stores you follow" />
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground text-center py-8">
            No products yet from the suppliers you follow.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
