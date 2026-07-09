import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import BnbSearchBar from "./BnbSearchBar";
import BnbSearchSheet, { type BnbSearchState, type GuestUnits } from "./BnbSearchSheet";
import BnbCategoryRail, { type BnbCategory } from "./BnbCategoryRail";
import BnbListingCard, { type BnbListing } from "./BnbListingCard";
import BnbMapToggle from "./BnbMapToggle";
import BnbMapView, { type BnbMapPin } from "./BnbMapView";
import { Loader2 } from "lucide-react";

/**
 * Airbnb-style vertical screen shell. Every vertical (Stays, Restaurants,
 * Services, Rides, Properties, CarRentals, Auto, Jobs, Agro, Industrial,
 * Finance, Logistics) uses this same shell — just supply the data hook,
 * a category list, and a mapper from raw item → BnbListing.
 */
export default function BnbVerticalScreen<T>({
  queryKey,
  fetcher,
  categories,
  toListing,
  toPin,
  wherePlaceholder,
  units = "guests",
  saveKind,
  emptyLabel = "Nothing found",
  filterByCategory,
  headerAccent,
}: {
  queryKey: readonly unknown[];
  fetcher: (category: string) => Promise<T[]>;
  categories: BnbCategory[];
  toListing: (item: T) => BnbListing;
  toPin?: (item: T) => BnbMapPin | null;
  wherePlaceholder?: string;
  units?: GuestUnits;
  saveKind?: string;
  emptyLabel?: string;
  filterByCategory?: (item: T, slug: string) => boolean;
  headerAccent?: React.ReactNode;
}) {
  const [category, setCategory] = useState(categories[0]?.slug ?? "all");
  const [view, setView] = useState<"list" | "map">("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState<BnbSearchState>({ where: "", count: 0 });
  const [applied, setApplied] = useState<BnbSearchState>({ where: "", count: 0 });

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [...queryKey, category],
    queryFn: () => fetcher(category),
  });

  const filtered = useMemo(() => {
    let items = raw;
    if (filterByCategory && category !== (categories[0]?.slug ?? "all")) {
      items = items.filter((i) => filterByCategory(i, category));
    }
    if (applied.where.trim()) {
      const q = applied.where.toLowerCase();
      items = items.filter((i) => {
        const l = toListing(i);
        return (
          l.title.toLowerCase().includes(q) ||
          (l.location ?? "").toLowerCase().includes(q) ||
          (l.subtitle ?? "").toLowerCase().includes(q)
        );
      });
    }
    return items;
  }, [raw, category, applied, filterByCategory, toListing, categories]);

  const searchDisplay = useMemo(() => {
    const w = applied.where || "";
    const d = applied.dates?.from
      ? applied.dates.to
        ? `${applied.dates.from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${applied.dates.to.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : applied.dates.from.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
    const c = applied.count ? `${applied.count}` : "";
    return { where: w, when: d, who: c };
  }, [applied]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <BnbSearchBar
        value={searchDisplay}
        placeholder={wherePlaceholder}
        onOpen={() => setSearchOpen(true)}
        onOpenFilters={() => setSearchOpen(true)}
      />
      <BnbCategoryRail categories={categories} value={category} onChange={setCategory} />

      {headerAccent}

      <div className="max-w-5xl mx-auto px-4 pt-4">
        {isLoading ? (
          <div className="py-24 grid place-items-center text-[hsl(var(--bnb-foggy))]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : view === "map" && toPin ? (
          <BnbMapView pins={filtered.map(toPin).filter((p): p is BnbMapPin => !!p)} />
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg font-semibold">{emptyLabel}</p>
            <p className="text-sm text-[hsl(var(--bnb-foggy))] mt-1">Try widening your search or clearing filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 animate-fade-in">
            {filtered.map((item) => {
              const l = toListing(item);
              return <BnbListingCard key={l.id} listing={l} saveKind={saveKind} />;
            })}
          </div>
        )}
      </div>

      {toPin && filtered.length > 0 && !isLoading && (
        <BnbMapToggle view={view} onChange={setView} />
      )}

      <BnbSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        value={search}
        onChange={setSearch}
        units={units}
        wherePlaceholder={wherePlaceholder}
        onApply={() => {
          setApplied(search);
          setSearchOpen(false);
        }}
        onClear={() => {
          setSearch({ where: "", count: 0 });
          setApplied({ where: "", count: 0 });
        }}
      />
    </div>
  );
}
