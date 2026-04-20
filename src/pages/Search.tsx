import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search as SearchIcon, SlidersHorizontal, X, Star, Truck, ShieldCheck, Sparkles, Loader2, ArrowRight,
} from "lucide-react";
import ProductCard from "@/components/marketplace/ProductCard";
import { Button } from "@/components/ui/button";
import { POPULAR_HINTS } from "@/components/RotatingHint";
import { Link } from "react-router-dom";
import { useProducts, useCategories } from "@/hooks/useCatalog";
import EmptyState from "@/components/EmptyState";

const SORTS = [
  { id: "relevance", label: "Relevance" },
  { id: "price-asc", label: "Price: Low → High" },
  { id: "price-desc", label: "Price: High → Low" },
  { id: "rating", label: "Top Rated" },
  { id: "sold", label: "Best Selling" },
];

const TAPSON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tapson-chat`;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [freeShipOnly, setFreeShipOnly] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const aiCtrl = useRef<AbortController | null>(null);

  const { data: cats = [] } = useCategories();
  const { data: allProducts = [], isLoading } = useProducts({
    search: submitted || undefined,
    category: category || undefined,
  });

  useEffect(() => {
    if (query) return;
    const t = setInterval(() => setHintIdx((v) => (v + 1) % POPULAR_HINTS.length), 2200);
    return () => clearInterval(t);
  }, [query]);

  const results = useMemo(() => {
    let list = allProducts.filter((p) => {
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
  }, [allProducts, minRating, maxPrice, freeShipOnly, sort]);

  const askTapson = async (q: string) => {
    if (!q.trim()) return;
    aiCtrl.current?.abort();
    const ctrl = new AbortController();
    aiCtrl.current = ctrl;
    setAiInsight(""); setAiLoading(true);
    try {
      const resp = await fetch(TAPSON_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        signal: ctrl.signal,
        body: JSON.stringify({ messages: [{ role: "user", content: `A buyer searched: "${q}". In 2-3 short sentences, suggest what to look for and key specs to compare.` }] }),
      });
      if (!resp.ok || !resp.body) { setAiLoading(false); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let acc = ""; let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) { acc += delta; setAiInsight(acc); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch { /* aborted */ } finally { setAiLoading(false); }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(query); askTapson(query); };
  const useQ = (q: string) => { setQuery(q); setSubmitted(q); askTapson(q); };
  const reset = () => { setCategory(null); setMinRating(0); setMaxPrice(1000); setFreeShipOnly(false); setSort("relevance"); };

  return (
    <div className="pb-8">
      <form onSubmit={onSubmit} className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-2 shadow-soft">
        <div className="flex-1 relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={`Try ${POPULAR_HINTS[hintIdx]}`}
            className="w-full h-10 bg-muted rounded-full pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft" />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setSubmitted(""); setAiInsight(""); }}
              aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} aria-label="Filters"
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-soft ${showFilters ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </form>

      {!submitted && (
        <div className="border-b bg-card overflow-hidden">
          <div className="flex gap-2 py-2 whitespace-nowrap animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused]">
            {[...POPULAR_HINTS, ...POPULAR_HINTS].map((h, i) => (
              <button key={i} onClick={() => useQ(h.replace(/^\W+\s/, ""))}
                className="shrink-0 px-3 h-7 rounded-full bg-muted text-xs font-medium shadow-soft hover:bg-primary/10 hover:text-primary transition">
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="px-4 py-4 border-b bg-card shadow-card animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Filters</h3>
            <button onClick={reset} className="text-xs text-primary font-semibold">Reset</button>
          </div>
          <p className="text-xs font-medium mb-2">Category</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCategory(category === c.id ? null : c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${category === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}>
                {c.name}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium mb-2">Sort by</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SORTS.map((s) => (
              <button key={s.id} onClick={() => setSort(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${sort === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium mb-2">Min rating: {minRating.toFixed(1)}</p>
          <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={(e) => setMinRating(+e.target.value)} className="w-full mb-4" />
          <p className="text-xs font-medium mb-2">Max price: ${maxPrice}</p>
          <input type="range" min={5} max={1000} step={5} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full mb-4" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={freeShipOnly} onChange={(e) => setFreeShipOnly(e.target.checked)} />
            <Truck className="w-4 h-4 text-primary" /> Free shipping
          </label>
        </div>
      )}

      {!submitted && !showFilters && (
        <div className="px-4 py-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trending searches</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_HINTS.slice(0, 10).map((q) => (
              <button key={q} onClick={() => useQ(q.replace(/^\W+\s/, ""))}
                className="px-4 py-2 bg-muted rounded-full text-sm font-medium shadow-soft hover:shadow-card transition">
                <Star className="inline w-3 h-3 text-amber-500 fill-amber-500 mr-1" /> {q}
              </button>
            ))}
          </div>
          <Link to="/home" className="mt-6 flex items-center justify-between rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card"><Sparkles className="w-5 h-5" /></span>
              <div>
                <p className="text-sm font-bold">Ask Tapson</p>
                <p className="text-[11px] text-muted-foreground">Describe what you need — Tapson finds it</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-primary" />
          </Link>
        </div>
      )}

      {submitted && (
        <div className="px-4 pt-4">
          {(aiInsight || aiLoading) && (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-soft"><Sparkles className="w-3.5 h-3.5" /></span>
                <p className="text-xs font-bold">Tapson's take</p>
                {aiLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">{aiInsight || "Reading the market…"}</p>
            </div>
          )}
          {isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <EmptyState title={`No results for "${submitted}"`} description="Try a broader term or remove some filters." action={<Button onClick={reset} variant="outline">Reset filters</Button>} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">{results.length} result{results.length === 1 ? "" : "s"} for "{submitted}"</p>
              <div className="grid grid-cols-2 gap-3">
                {results.map((p) => (<ProductCard key={p.id} product={p} />))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
