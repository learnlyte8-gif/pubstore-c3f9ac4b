import { useEffect, useRef, useState } from "react";
import { LayoutGrid, ChevronRight, ChevronLeft } from "lucide-react";
import ProductCard from "@/components/marketplace/ProductCard";
import EmptyState from "@/components/EmptyState";
import TradeModeSwitch from "@/components/marketplace/TradeModeSwitch";
import { useCategories, useProducts } from "@/hooks/useCatalog";
import SubcategoryChips from "@/components/marketplace/SubcategoryChips";
import { deriveSubcategories, filterBySubcategory } from "@/lib/subcategories";
import {
  useMyInterests,
  useWishlistInterestSlugs,
  useRecentSearchSlugs,
  interestsToSlugs,
  rankByAffinity,
} from "@/hooks/useInterests";
import { useTradeMode } from "@/hooks/useTradeMode";

const ALL_ID = "__all__";

export default function Categories() {
  const { data: cats = [] } = useCategories();
  const [active, setActive] = useState<string>(ALL_ID);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const isAll = active === ALL_ID;

  const { interests } = useMyInterests();
  const wishlistSlugs = useWishlistInterestSlugs();
  const { slugs: searchSlugs, tokens: searchTokens } = useRecentSearchSlugs();
  const { mode: tradeMode } = useTradeMode();

  const { data: products = [], isLoading } = useProducts(
    isAll ? { limit: 120, tradeMode } : { category: active, limit: 60, tradeMode },
  );

  const interestSlugs = interestsToSlugs(interests);
  const priorityCounts = [...interestSlugs, ...interestSlugs, ...wishlistSlugs, ...searchSlugs].reduce<Record<string, number>>(
    (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; }, {},
  );
  const ordered = isAll ? rankByAffinity(products, priorityCounts, searchTokens) : products;

  const subs = isAll ? [] : deriveSubcategories(active, ordered);
  const activeSubObj = subs.find((s) => s.id === activeSub) ?? null;
  const visible = filterBySubcategory(ordered, activeSubObj);

  const ActiveCat = cats.find((c) => c.id === active);
  const ActiveIcon = ActiveCat?.icon;

  // Auto-collapse the categories sidebar after 10s of inactivity.
  const [collapsed, setCollapsed] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpActivity = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setCollapsed(true), 3_000);
  };

  useEffect(() => {
    bumpActivity();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: string) => {
    setActive(id);
    setActiveSub(null);
    setCollapsed(false);
    bumpActivity();
  };

  return (
    <div
      className="flex h-[calc(100dvh-3.5rem-4rem)] lg:h-[calc(100dvh-3.5rem)] relative"
      onPointerDown={bumpActivity}
      onScroll={bumpActivity}
    >
      <aside
        className={`shrink-0 bg-muted/40 overflow-y-auto scrollbar-none border-r transition-all duration-300 ease-out ${
          collapsed ? "w-0 border-r-0 opacity-0 pointer-events-none" : "w-24 opacity-100"
        }`}
        aria-hidden={collapsed}
      >
        <ul>
          <li>
            <button
              onClick={() => handleSelect(ALL_ID)}
              className={`w-full flex flex-col items-center gap-1 py-4 px-1 text-center transition ${
                isAll ? "bg-background text-primary font-semibold border-l-2 border-primary shadow-card" : "text-muted-foreground hover:bg-background/60"
              }`}
            >
              <LayoutGrid className="w-5 h-5" strokeWidth={isAll ? 2.2 : 1.7} />
              <span className="text-[11px] leading-tight">All</span>
            </button>
          </li>
          {cats.map(({ id, name, icon: Icon }) => {
            const isActive = active === id;
            return (
              <li key={id}>
                <button
                  onClick={() => handleSelect(id)}
                  className={`w-full flex flex-col items-center gap-1 py-4 px-1 text-center transition ${
                    isActive ? "bg-background text-primary font-semibold border-l-2 border-primary shadow-card" : "text-muted-foreground hover:bg-background/60"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.7} />
                  <span className="text-[11px] leading-tight">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <button
        type="button"
        onClick={() => { setCollapsed((c) => !c); bumpActivity(); }}
        aria-label={collapsed ? "Show categories" : "Hide categories"}
        className={`absolute top-3 z-20 w-8 h-8 rounded-full bg-background border border-border shadow-card flex items-center justify-center text-foreground hover:bg-muted transition-all ${
          collapsed ? "left-2" : "left-[5.5rem]"
        }`}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b bg-card shadow-soft flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-soft shrink-0">
            {isAll ? <LayoutGrid className="w-5 h-5" strokeWidth={2} /> : ActiveIcon ? <ActiveIcon className="w-5 h-5" strokeWidth={2} /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base capitalize truncate">
              {isAll ? "All products" : ActiveCat?.name}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {ordered.length} products
              {tradeMode !== "all" ? ` · ${tradeMode}` : ""}
              {isAll && interests.length > 0 ? " · personalized" : ""}
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-card/60 border-b flex justify-center">
          <TradeModeSwitch />
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-sm text-muted-foreground">Loading…</p>
        ) : ordered.length === 0 ? (
          <EmptyState title="No products yet" description="Be the first supplier to list in this category." />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3">
            {ordered.map((p) => (<ProductCard key={p.id} product={p} />))}
          </div>
        )}
      </div>
    </div>
  );
}
