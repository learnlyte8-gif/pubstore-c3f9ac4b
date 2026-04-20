import { useMemo, useState } from "react";
import { Search as SearchIcon, SlidersHorizontal, X, Star, Truck, ShieldCheck } from "lucide-react";
import { PRODUCTS, CATEGORIES } from "@/data/products";
import ProductCard from "@/components/marketplace/ProductCard";
import { Button } from "@/components/ui/button";

const TRENDING_QUERIES = ["earbuds", "blazer", "yoga mat", "air fryer", "linen shirt", "led strip"];
const SORTS = [
  { id: "relevance", label: "Relevance" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Top Rated" },
  { id: "sold", label: "Best Selling" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(200);
  const [freeShipOnly, setFreeShipOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("relevance");

  const results = useMemo(() => {
    const q = submitted.toLowerCase().trim();
    let list = PRODUCTS.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q) && !p.category.includes(q)) return false;
      if (category && p.category !== category) return false;
      if (p.rating < minRating) return false;
      if (p.price > maxPrice) return false;
      if (freeShipOnly && !p.freeShipping) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === "sold") list = [...list].sort((a, b) => b.sold - a.sold);
    return list;
  }, [submitted, category, minRating, maxPrice, freeShipOnly, verifiedOnly, sort]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(query);
  };

  const reset = () => {
    setCategory(null);
    setMinRating(0);
    setMaxPrice(200);
    setFreeShipOnly(false);
    setVerifiedOnly(false);
    setSort("relevance");
  };

  return (
    <div className="pb-8">
      <form onSubmit={onSubmit} className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2 shadow-soft">
        <div className="flex-1 relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, suppliers..."
            className="w-full h-10 bg-muted rounded-full pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setSubmitted(""); }} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filters"
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-soft ${showFilters ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </form>

      {showFilters && (
        <div className="px-4 py-4 border-b border-border bg-card shadow-card animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Filters</h3>
            <button onClick={reset} className="text-xs text-primary font-semibold">Reset</button>
          </div>

          <p className="text-xs font-medium mb-2">Category</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${category === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium mb-2">Sort by</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${sort === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium mb-2">Min rating: {minRating.toFixed(1)}</p>
          <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(e) => setMinRating(+e.target.value)} className="w-full mb-4" />

          <p className="text-xs font-medium mb-2">Max price: ${maxPrice}</p>
          <input type="range" min={5} max={200} step={5} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full mb-4" />

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={freeShipOnly} onChange={(e) => setFreeShipOnly(e.target.checked)} />
              <Truck className="w-4 h-4 text-primary" /> Free shipping
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
              <ShieldCheck className="w-4 h-4 text-primary" /> Verified suppliers
            </label>
          </div>
        </div>
      )}

      {!submitted && !showFilters && (
        <div className="px-4 py-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trending searches</p>
          <div className="flex flex-wrap gap-2">
            {TRENDING_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); setSubmitted(q); }}
                className="px-4 py-2 bg-muted rounded-full text-sm font-medium shadow-soft hover:shadow-card transition"
              >
                <Star className="inline w-3 h-3 text-amber-500 fill-amber-500 mr-1" /> {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {submitted && (
        <div className="px-4 pt-4">
          <p className="text-sm text-muted-foreground mb-3">
            {results.length} result{results.length === 1 ? "" : "s"} for "{submitted}"
          </p>
          <div className="grid grid-cols-2 gap-3">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {results.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm mb-4">No products match your filters.</p>
              <Button onClick={reset} variant="outline">Reset filters</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
