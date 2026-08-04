import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Home as HomeIcon, Store as StoreIcon,
  Users, Menu, X, FileText, Package, GitCompare, Wallet, BadgePercent,
  Briefcase, Wrench, Banknote, BedDouble, Car, Factory, Sprout, Navigation,
  Truck, Compass, Sparkles, Newspaper, Heart, LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Promo3DCarousel from "@/components/marketplace/Promo3DCarousel";
import MixedFeed from "@/components/marketplace/MixedFeed";
import RecommendationStrip from "@/components/marketplace/RecommendationStrip";
import SearchRecommendationStrip from "@/components/marketplace/SearchRecommendationStrip";
import NewArrivals from "@/components/marketplace/NewArrivals";
import ProductCard from "@/components/marketplace/ProductCard";
import MasonryGrid from "@/components/marketplace/MasonryGrid";
import EmptyState from "@/components/EmptyState";
import SupplierCard from "@/components/marketplace/SupplierCard";
import SubcategoryChips from "@/components/marketplace/SubcategoryChips";
import InfiniteScrollSentinel from "@/components/marketplace/InfiniteScrollSentinel";
import { useProducts, useCategories } from "@/hooks/useCatalog";
import { useInfiniteProducts } from "@/hooks/useInfiniteProducts";
import { deriveSubcategories, filterBySubcategory } from "@/lib/subcategories";
import { useFollowingFeed, useFollowingSupplierIds, useAuthUserId } from "@/hooks/useFollowing";
import { useMyInterests } from "@/hooks/useInterests";
import { useMyVerticals } from "@/hooks/useMyVerticals";
import { useTradeMode } from "@/hooks/useTradeMode";
import CircleSpinner from "@/components/CircleSpinner";

type Tab = "home" | "fyp" | "following";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "fyp", label: "For you", icon: Compass },
  { id: "following", label: "Following", icon: Users },
];

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = (searchParams.get("feed") as Tab) || "home";
  const catParam = searchParams.get("cat");

  const { interests } = useMyInterests();
  const { verticals } = useMyVerticals();
  const { mode: tradeMode } = useTradeMode();

  const { data: products = [] } = useProducts({ limit: 80, tradeMode });

  return (
    <div className="pb-6">
      <Helmet>
        <title>PUBSTORE — Shop, share & discover across verticals</title>
        <meta name="description" content="Browse a personalized feed of products, suppliers, news, stays, jobs and more on PUBSTORE — the social shop." />
        <link rel="canonical" href="https://pubstore.app/home" />
        <meta property="og:url" content="https://pubstore.app/home" />
        <meta property="og:title" content="PUBSTORE — Shop, share & discover across verticals" />
      </Helmet>
      <h1 className="sr-only">PUBSTORE — Shop, share and discover across verticals</h1>

      {catParam ? (
        <CategoryFeed
          categoryId={catParam}
          activeSub={searchParams.get("sub")}
          onSubChange={(sub) => {
            const next = new URLSearchParams(searchParams);
            if (sub) next.set("sub", sub);
            else next.delete("sub");
            setSearchParams(next, { replace: true });
          }}
          tradeMode={tradeMode}
        />
      ) : (
        <>
          {tab === "home" && (
            <div className="animate-fade-in">
              <Promo3DCarousel />
              <HomeMenuDrawer />

              <section className="px-4 mt-6">
                <SectionHeader icon={Heart} title="Because you browsed" subtitle="Picked from your recent activity" />
                <div className="mt-3 grid grid-cols-1"><RecommendationStrip title="Because you browsed" subtitle="Hand-picked for you" /></div>
              </section>

              <section className="px-4 mt-6">
                <SectionHeader icon={Sparkles} title="Because you searched" subtitle="AI matches from your recent searches" />
                <div className="mt-3"><SearchRecommendationStrip /></div>
              </section>



              <section className="px-4 mt-6">
                <SectionHeader icon={Sparkles} title="New arrivals" subtitle="Latest products from suppliers" />
                <NewArrivals />
              </section>

              <div className="mt-6">
                <div className="px-4">
                  <SectionHeader icon={Compass} title="Explore the marketplace" subtitle="Products, services and more" />
                </div>
                <MixedFeed verticals={verticals} tradeMode={tradeMode} />
              </div>
            </div>
          )}

          {tab === "fyp" && (
            <div className="animate-fade-in px-4 mt-4">
              <SectionHeader icon={Sparkles} title="For you" subtitle="Personalized picks based on your interests" />
              {products.length === 0 ? (
                <EmptyState title="Nothing in the feed yet" description="When suppliers list products they'll show up here." />
              ) : (
                <MasonryGrid className="mt-3">
                  {(() => {
                    const liked = interests.length
                      ? products.filter((p) => interests.some((i) => p.category === i))
                      : [];
                    const rest = products.filter((p) => !liked.includes(p));
                    return [...liked, ...rest].map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ));
                  })()}
                </MasonryGrid>
              )}
            </div>
          )}

          {tab === "following" && (
            <div className="animate-fade-in">
              <FollowingTab />
            </div>
          )}
        </>
      )}
    </div>
  );
};

function CategoryFeed({
  categoryId,
  activeSub,
  onSubChange,
  tradeMode,
}: {
  categoryId: string;
  activeSub: string | null;
  onSubChange: (sub: string | null) => void;
  tradeMode: ReturnType<typeof useTradeMode>["mode"];
}) {
  const { data: cats = [] } = useCategories();
  const cat = cats.find((c) => c.id === categoryId);
  const Icon = cat?.icon ?? LayoutGrid;

  const productsQ = useInfiniteProducts({ category: categoryId, tradeMode, pageSize: 30 });
  const products = productsQ.items;
  const subs = deriveSubcategories(categoryId, products);
  const activeSubObj = subs.find((s) => s.id === activeSub) ?? null;
  const visible = filterBySubcategory(products, activeSubObj);

  return (
    <div className="animate-fade-in">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-soft shrink-0">
            <Icon className="w-5 h-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold capitalize truncate leading-tight">{cat?.name ?? categoryId}</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {visible.length} products{activeSubObj ? ` · ${activeSubObj.label}` : ""}
            </p>
          </div>
        </div>
      </div>

      {subs.length > 0 && (
        <div className="mt-3">
          <SubcategoryChips subs={subs} active={activeSub} onChange={onSubChange} />
        </div>
      )}

      {productsQ.isLoading ? (
        <div className="py-12 flex justify-center"><CircleSpinner size={28} /></div>
      ) : visible.length === 0 ? (
        <EmptyState title="No products yet" description="Be the first supplier to list in this category." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 p-3">
            {visible.map((p) => (<ProductCard key={p.id} product={p} />))}
          </div>
          {!activeSubObj && (
            <InfiniteScrollSentinel
              hasMore={!!productsQ.hasNextPage}
              isLoading={productsQ.isFetchingNextPage}
              onLoadMore={() => productsQ.fetchNextPage()}
            />
          )}
        </>
      )}
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
          <MasonryGrid className="mt-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </MasonryGrid>
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
