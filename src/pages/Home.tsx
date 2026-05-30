import { useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp, Sparkles, LayoutGrid, Building2, Compass, Users, Home as HomeIcon, Store as StoreIcon,
  Globe2, Award, Newspaper, Zap, ShieldCheck, Truck, Flame, Menu, X, FileText, Package, GitCompare, Wallet, BadgePercent,
  Briefcase, Wrench, Banknote, BedDouble, Car, Factory, Sprout, Navigation,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Promo3DCarousel from "@/components/marketplace/Promo3DCarousel";
import ProductCard from "@/components/marketplace/ProductCard";
import TopSuppliers from "@/components/marketplace/TopSuppliers";
import VerticalFeed from "@/components/marketplace/VerticalFeed";
import LiveStatsBanner from "@/components/marketplace/LiveStatsBanner";
import BrandSpotlight from "@/components/marketplace/BrandSpotlight";
import LiveFeed from "@/components/marketplace/LiveFeed";
import LiveStreamsRail from "@/components/marketplace/LiveStreamsRail";
import PromoTile from "@/components/marketplace/PromoTile";
import CategoryCallout from "@/components/marketplace/CategoryCallout";
import RecommendationStrip from "@/components/marketplace/RecommendationStrip";
import NewsRail from "@/components/marketplace/NewsRail";
import StaysRail from "@/components/marketplace/StaysRail";
import AutoRail from "@/components/marketplace/AutoRail";
import IndustrialRail from "@/components/marketplace/IndustrialRail";
import AgroRail from "@/components/marketplace/AgroRail";
import ServicesRail from "@/components/marketplace/ServicesRail";
import PropertiesRail from "@/components/marketplace/PropertiesRail";
import FinanceRail from "@/components/marketplace/FinanceRail";
import CarRentalsRail from "@/components/marketplace/CarRentalsRail";
import RestaurantsRail from "@/components/marketplace/RestaurantsRail";
import JobsRail from "@/components/marketplace/JobsRail";
import TapsonAssistant from "@/components/TapsonAssistant";
import EmptyState from "@/components/EmptyState";
import SupplierCard from "@/components/marketplace/SupplierCard";
import { useProducts, useSuppliers } from "@/hooks/useCatalog";
import { useFollowingFeed, useFollowingSupplierIds, useAuthUserId } from "@/hooks/useFollowing";
import { useMyInterests, useWishlistInterestSlugs, interestsToSlugs, prioritizeByCategories, useRecentSearchSlugs, rankByAffinity } from "@/hooks/useInterests";
import { usePersonalizedFeed } from "@/hooks/useSocial";
import { useClickAffinity, useRefreshFeed } from "@/hooks/usePersonalizationLog";
import { useTradeMode } from "@/hooks/useTradeMode";
import TradeModeSwitch from "@/components/marketplace/TradeModeSwitch";
import { useWallet } from "@/hooks/useWallet";
import { Wallet as WalletIcon, Plus, RefreshCw, Radio, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: forYouProducts = [] } = usePersonalizedFeed(12);
  const { data: liveStreams = [] } = useQuery({
    queryKey: ["home-live-streams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id,title,cover,viewer_count,supplier_id,suppliers(name,logo)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

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
      <div className="px-4 mt-3 pb-2 pt-2 space-y-2">
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
          <Promo3DCarousel />
          <HomeMenuDrawer />
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

          {isLoading ? (
            <HomeRailsSkeleton />
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

              {(liveStreams.length > 0 || flashDeals.length > 0) && (
                <section className="px-4 mt-6">
                  <SectionHeader icon={Zap} title="Live now & flash deals" subtitle="Streaming suppliers · 30%+ off picks" />
                  <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
                    {liveStreams.map((s: any) => (
                      <Link
                        key={`live-${s.id}`}
                        to={`/live/${s.id}`}
                        className="relative shrink-0 w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-card"
                      >
                        {s.cover && (
                          <img src={s.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-transparent to-foreground/30" />
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse flex items-center gap-0.5">
                          <Radio className="w-2.5 h-2.5" /> LIVE
                        </span>
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-foreground/50 text-background text-[9px] font-bold flex items-center gap-0.5">
                          <Eye className="w-2.5 h-2.5" />
                          {s.viewer_count > 1000 ? (s.viewer_count / 1000).toFixed(1) + "K" : s.viewer_count}
                        </span>
                        <div className="absolute bottom-2 inset-x-2 text-background">
                          {s.suppliers?.name && (
                            <div className="flex items-center gap-1.5 mb-1">
                              {s.suppliers.logo && (
                                <img src={s.suppliers.logo} alt="" className="w-5 h-5 rounded-full object-cover ring-2 ring-background" />
                              )}
                              <p className="text-[10px] font-bold truncate">{s.suppliers.name.split(" ")[0]}</p>
                            </div>
                          )}
                          <p className="text-[10px] leading-snug font-semibold line-clamp-2">{s.title}</p>
                        </div>
                      </Link>
                    ))}
                    {flashDeals.map((p) => (<ProductCard key={`fd-${p.id}`} product={p} variant="compact" />))}
                  </div>
                </section>
              )}

              <JobsRail />

              <section className="px-4 mt-6">
                <RecommendationStrip />
              </section>




              {suppliers.length > 0 && (
                <section className="px-4 mt-6">
                  <SectionHeader icon={Building2} title="Top suppliers" subtitle="Verified stores ready to ship" />
                  <TopSuppliers suppliers={suppliers} />
                </section>
              )}

              <section className="px-4 mt-6">
                <SectionHeader icon={Sparkles} title="For you" subtitle="Ranked by your interests, follows & activity" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {(() => {
                    const rankedIds = (forYouProducts as any[]).map((p) => p.id);
                    const byId = new Map(products.map((p) => [p.id, p]));
                    const ranked = rankedIds.map((id) => byId.get(id)).filter(Boolean) as typeof products;
                    const seen = new Set(ranked.map((p) => p.id));
                    const tail = products.filter((p) => !seen.has(p.id));
                    return [...ranked, ...tail].slice(0, 6).map((p) => (<ProductCard key={p.id} product={p} />));
                  })()}
                </div>
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Award} title="Brand spotlight" subtitle="Featured collections" />
                <BrandSpotlight />
              </section>

              <NewsRail />

              <RestaurantsRail />

              <StaysRail />


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

function HomeRailsSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Trending now skeleton */}
      <section className="px-4 mt-6">
        <div className="flex items-end justify-between">
          <div className="flex items-start gap-2.5">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden mt-3 -mx-1 px-1 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-32 space-y-2">
              <Skeleton className="w-32 h-32 rounded-xl" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </section>

      {/* Live + Flash skeleton */}
      <section className="px-4 mt-6">
        <div className="flex items-end justify-between">
          <div className="flex items-start gap-2.5">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden mt-3 -mx-1 px-1 pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="shrink-0 w-32 aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

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

/* ── HomeMenuDrawer ─────────────────────────────────────────────
   Replaces the inline DepartmentsBar (category rail) and
   QuickActions (track-order rail) with a single slide-out drawer.
   ────────────────────────────────────────────────────────────── */

const DEPTS: { to: string; label: string; icon: LucideIcon; tone: string }[] = [
  { to: "/home",       label: "Market",     icon: StoreIcon,  tone: "from-primary to-primary/70" },
  { to: "/jobs",       label: "Jobs",       icon: Briefcase,  tone: "from-blue-700 to-indigo-500" },
  { to: "/rides",      label: "Rides",      icon: Navigation, tone: "from-emerald-500 to-teal-400" },
  { to: "/services",   label: "Services",   icon: Wrench,     tone: "from-violet-600 to-fuchsia-500" },
  { to: "/properties", label: "Property",   icon: HomeIcon,   tone: "from-sky-700 to-blue-500" },
  { to: "/logistics",  label: "Delivery",   icon: Truck,      tone: "from-orange-600 to-rose-500" },
  { to: "/finance",    label: "Finance",    icon: Banknote,   tone: "from-emerald-700 to-cyan-600" },
  { to: "/news",       label: "News",       icon: Newspaper,  tone: "from-rose-500 to-orange-400" },
  { to: "/stays",      label: "Stays",      icon: BedDouble,  tone: "from-amber-500 to-yellow-300" },
  { to: "/auto",       label: "Auto",       icon: Car,        tone: "from-zinc-900 to-zinc-600" },
  { to: "/industrial", label: "Industrial", icon: Factory,    tone: "from-sky-700 to-sky-400" },
  { to: "/agro",       label: "Agro",       icon: Sprout,     tone: "from-emerald-700 to-lime-500" },
];

const QUICK_ACTIONS = [
  { icon: FileText, label: "Request quote", to: "/rfq", tone: "bg-primary/10 text-primary" },
  { icon: Package, label: "Track order", to: "/orders", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { icon: GitCompare, label: "Compare", to: "/compare", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { icon: Truck, label: "Logistics", to: "/categories", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { icon: Wallet, label: "Trade Pay", to: "/account", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { icon: BadgePercent, label: "Coupons", to: "/account", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
];

function HomeMenuDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="px-4 mt-3">
        <SheetTrigger asChild>
          <button className="w-full flex items-center justify-between gap-3 h-11 px-4 rounded-2xl bg-card border border-border shadow-card active:scale-[0.99] transition">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Menu className="w-4 h-4" strokeWidth={2.4} />
              Browse categories &amp; quick actions
            </span>
            <span className="text-muted-foreground text-lg">›</span>
          </button>
        </SheetTrigger>
      </div>
      <SheetContent side="bottom" className="h-[82vh] rounded-t-3xl p-0 border-t border-border/60 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Directory</p>
          <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center active:scale-90 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Categories */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/90 mb-3">Categories</p>
            <div className="grid grid-cols-4 gap-3">
              {DEPTS.map((d) => {
                const Icon = d.icon;
                return (
                  <Link
                    key={d.to}
                    to={d.to}
                    onClick={() => setOpen(false)}
                    className="group flex flex-col items-center gap-1.5 transition"
                  >
                    <span className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${d.tone} flex items-center justify-center shadow-elevated`}>
                      <span className="absolute inset-[2px] rounded-[14px] bg-background/15 backdrop-blur-sm" />
                      <Icon className="relative z-10 w-5 h-5 text-white" strokeWidth={2.4} />
                    </span>
                    <span className="text-[10px] font-bold tracking-wide text-muted-foreground group-hover:text-foreground transition">{d.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/90 mb-3">Quick Actions</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    to={a.to}
                    key={a.label}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-card border border-border/60 hover:bg-muted/50 active:scale-[0.98] transition"
                  >
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.tone}`}>
                      <Icon className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <span className="text-[10px] font-semibold leading-tight text-center">{a.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default Home;
