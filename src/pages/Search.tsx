import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import CircleSpinner from "@/components/CircleSpinner";
import { Search as SearchIcon, SlidersHorizontal, X, Star, Truck, Sparkles, ArrowRight, History, TrendingUp, Package, Wrench, Home as HomeIcon, Banknote, Car, BedDouble, Factory, Newspaper, Store as StoreIcon, Navigation, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveHints } from "@/components/RotatingHint";
import { Link } from "react-router-dom";
import { useCategories } from "@/hooks/useCatalog";
import EmptyState from "@/components/EmptyState";
import { suggestCompletions, tokenize } from "@/lib/search";
import { useUniversalPool, searchUniversal, type UniversalHit } from "@/hooks/useUniversalSearch";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import { aiFunctionHeaders } from "@/lib/aiAuth";
import { useSemanticProducts } from "@/hooks/useSemanticProducts";

const SORTS = [
  { id: "relevance", label: "Relevance" },
  { id: "price-asc", label: "Price: Low → High" },
  { id: "price-desc", label: "Price: High → Low" },
  { id: "rating", label: "Top Rated" },
  { id: "sold", label: "Best Selling" },
];

const TAPSON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tapson-chat`;
const RECENT_KEY = "pubstore.recent-searches";

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function pushRecent(q: string) {
  const all = [q, ...loadRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(all));
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [freeShipOnly, setFreeShipOnly] = useState(false);
  const [maxMoq, setMaxMoq] = useState(0); // 0 = any
  const [country, setCountry] = useState<string>("");
  const [readyToShipOnly, setReadyToShipOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const aiCtrl = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const HINTS = useLiveHints();
  const { data: cats = [] } = useCategories();

  const [kindFilter, setKindFilter] = useState<UniversalHit["kind"] | null>(null);

  // Single universal pool covers products, services, properties, finance,
  // logistics, vehicles, stays, industrial, news and suppliers. The
  // client-side ranker handles fuzzy matching so unrelated keywords like
  // "jobs" or "cars" still surface relevant rows.
  const { data: pool = [], isLoading } = useUniversalPool();
  const suggestPool = pool;

  useEffect(() => {
    if (query) return;
    const t = setInterval(() => setHintIdx((v) => (v + 1) % Math.max(1, HINTS.length)), 2200);
    return () => clearInterval(t);
  }, [query, HINTS.length]);

  // Live suggestions while typing
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return suggestCompletions(suggestPool, query);
  }, [query, suggestPool]);

  // Full-catalog product matches from the server (AI/semantic, keyword fallback).
  // The client pool only holds a slice of the catalog, so this fills the gaps.
  const { data: semantic, isLoading: semanticLoading } = useSemanticProducts(submitted);

  // Ranked + filtered results across the whole catalog (all verticals).
  const ranked = useMemo(() => {
    if (!submitted) return [];
    const seen = new Set(pool.map((p) => p.id));
    const extra = (semantic?.hits ?? []).filter((h) => !seen.has(h.id));
    // Server-side (meaning-based) hits carry no supplier verification/country data,
    // so filters that depend on those fields must not silently drop them.
    const semanticIds = new Set(extra.map((h) => h.id));
    let list = extra.length ? [...pool, ...extra] : pool;

    // Apply objective filters first.
    list = list.filter((p) => {
      const partial = semanticIds.has(p.id);
      if (p.rating < minRating) return false;
      if (p.price != null && p.price > maxPrice) return false;
      if (freeShipOnly && !p.freeShipping) return false;
      if (maxMoq > 0 && p.moq != null && p.moq > maxMoq) return false;
      if (readyToShipOnly && !p.readyToShip && p.kind === "product") return false;
      if (!partial && verifiedOnly && p.kind === "supplier" && !p.verified) return false;
      if (!partial && verifiedOnly && p.kind === "product" && !p.verified) return false;
      if (!partial && country.trim()) {
        const c = country.trim().toLowerCase();
        if (!(p.country ?? "").toLowerCase().includes(c)) return false;
      }
      return true;
    });

    let scored = searchUniversal(list, submitted, kindFilter);

    // Meaning-based matches often share no keywords with the query, so the lexical
    // ranker discards them. Append the ones it dropped, keeping the server's order.
    const kept = new Set(scored.map((s) => s.item.id));
    const semanticTail = list
      .filter((p) => semanticIds.has(p.id) && !kept.has(p.id) && (!kindFilter || p.kind === kindFilter))
      .map((item) => ({ item, score: 0 } as (typeof scored)[number]));
    if (semanticTail.length) scored = [...scored, ...semanticTail];


    if (sort !== "relevance") {
      if (sort === "price-asc") scored = [...scored].sort((a, b) => (a.item.price ?? 0) - (b.item.price ?? 0));
      if (sort === "price-desc") scored = [...scored].sort((a, b) => (b.item.price ?? 0) - (a.item.price ?? 0));
      if (sort === "rating") scored = [...scored].sort((a, b) => b.item.rating - a.item.rating);
      if (sort === "sold") scored = [...scored].sort((a, b) => b.item.sold - a.item.sold);
    }
    return scored;
  }, [pool, semantic, submitted, sort, minRating, maxPrice, freeShipOnly, maxMoq, country, readyToShipOnly, verifiedOnly, kindFilter]);

  const askTapson = async (q: string) => {
    if (!q.trim()) return;
    aiCtrl.current?.abort();
    const ctrl = new AbortController();
    aiCtrl.current = ctrl;
    setAiInsight(""); setAiLoading(true);
    try {
      const resp = await fetch(TAPSON_URL, {
        method: "POST",
        headers: await aiFunctionHeaders(),
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

  const submit = (q: string) => {
    const v = q.trim();
    if (!v) return;
    setQuery(v);
    setSubmitted(v);
    setShowSuggest(false);
    pushRecent(v);
    setRecent(loadRecent());
    askTapson(v);
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); submit(query); };
  const reset = () => { setCategory(null); setMinRating(0); setMaxPrice(1000); setFreeShipOnly(false); setMaxMoq(0); setCountry(""); setReadyToShipOnly(false); setVerifiedOnly(false); setSort("relevance"); };

  const onPickImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    if (file.size > 6 * 1024 * 1024) return toast.error("Image too large (max 6 MB)");
    setImgLoading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-search`;
      const res = await fetch(url, {
        method: "POST",
        headers: await aiFunctionHeaders(),
        body: JSON.stringify({ image: dataUrl }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Image search failed");
      const kw: string = (j?.keywords || "").trim();
      if (!kw) throw new Error("Couldn't recognize the product");
      toast.success("Searching by image", { description: kw });
      submit(kw);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image search failed");
    } finally {
      setImgLoading(false);
    }
  };
  return (
    <div className="pb-8">
      <Helmet>
        <title>Search products, services & suppliers — PUBSTORE</title>
        <meta name="description" content="Universal search across products, services, stays, vehicles, jobs and news on PUBSTORE." />
        <link rel="canonical" href="https://pubstore.app/search" />
        <meta property="og:url" content="https://pubstore.app/search" />
        <meta property="og:title" content="Search — PUBSTORE" />
      </Helmet>
      <h1 className="sr-only">Search PUBSTORE</h1>
      <form onSubmit={onSubmit} className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b px-3 py-3 flex items-center gap-2 shadow-soft">
        <BackButton iconOnly />
        <div className="flex-1 relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            placeholder={`Try ${HINTS[hintIdx % Math.max(1, HINTS.length)] ?? "popular products"}`}
            className="w-full h-10 bg-muted rounded-full pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
          />
          {query && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); setQuery(""); setSubmitted(""); setAiInsight(""); }}
              aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Live suggestion dropdown */}
          {showSuggest && (suggestions.length > 0 || (!query && recent.length > 0)) && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-2xl shadow-elevated overflow-hidden z-30 max-h-80 overflow-y-auto">
              {!query && recent.length > 0 && (
                <div className="px-2 pt-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-1">Recent</p>
                  {recent.map((r) => (
                    <button key={r} type="button" onMouseDown={(e) => { e.preventDefault(); submit(r); }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left">
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate">{r}</span>
                    </button>
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <div className="px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-1">Suggestions</p>
                  {suggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); submit(s); }}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-muted text-left">
                      <SearchIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate">{highlightMatch(s, query)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Search by image"
          disabled={imgLoading}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shadow-soft disabled:opacity-50"
        >
          {imgLoading ? <CircleSpinner size={16} /> : <Camera className="w-4 h-4" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickImage(f);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => setShowFilters((v) => !v)} aria-label="Filters"
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-soft ${showFilters ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </form>

      {!submitted && (
        <div className="border-b bg-card overflow-hidden">
          <div className="flex gap-2 py-2 whitespace-nowrap animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused]">
            {[...HINTS, ...HINTS].map((h, i) => (
              <button key={i} onClick={() => submit(h.replace(/^\W+\s/, ""))}
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
          <p className="text-xs font-medium mb-2">
            Max MOQ: {maxMoq === 0 ? "Any" : `≤ ${maxMoq} units`}
          </p>
          <input type="range" min={0} max={500} step={5} value={maxMoq} onChange={(e) => setMaxMoq(+e.target.value)} className="w-full mb-4" />
          <p className="text-xs font-medium mb-2">Country / region</p>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. China, Kenya, Zimbabwe"
            className="w-full h-9 px-3 mb-4 rounded-md border border-border bg-background text-sm"
          />
          <div className="grid grid-cols-1 gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={freeShipOnly} onChange={(e) => setFreeShipOnly(e.target.checked)} />
              <Truck className="w-4 h-4 text-primary" /> Free shipping
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={readyToShipOnly} onChange={(e) => setReadyToShipOnly(e.target.checked)} />
              <Package className="w-4 h-4 text-primary" /> Ready to ship
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
              <Sparkles className="w-4 h-4 text-primary" /> Verified suppliers only
            </label>
          </div>
        </div>
      )}

      {!submitted && !showFilters && (
        <div className="px-4 py-6">
          {recent.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <History className="w-3 h-3" /> Recent searches
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {recent.map((q) => (
                  <button key={q} onClick={() => submit(q)}
                    className="px-3 py-1.5 bg-muted rounded-full text-sm font-medium shadow-soft hover:shadow-card transition">
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Trending searches
          </p>
          <div className="flex flex-wrap gap-2">
            {HINTS.slice(0, 10).map((q) => (
              <button key={q} onClick={() => submit(q.replace(/^\W+\s/, ""))}
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
                {aiLoading && <CircleSpinner size={12} className="text-muted-foreground" />}
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">{aiInsight || "Reading the market…"}</p>
            </div>
          )}
          {isLoading || semanticLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Searching…</p>
          ) : ranked.length === 0 ? (
            <EmptyState
              title={`No results for "${submitted}"`}
              description="Try a broader term, fix typos, or remove some filters."
              action={<Button onClick={reset} variant="outline">Reset filters</Button>}
            />
          ) : (
            <>
              <KindFilterChips value={kindFilter} onChange={setKindFilter} pool={ranked.map((r) => r.item)} />
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => setVerifiedOnly((v) => !v)}
                  className={`px-3 h-7 rounded-full text-[11px] font-bold border transition flex items-center gap-1 ${verifiedOnly ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
                >
                  <Sparkles className="w-3 h-3" /> Verified
                </button>
                <button
                  onClick={() => setReadyToShipOnly((v) => !v)}
                  className={`px-3 h-7 rounded-full text-[11px] font-bold border transition flex items-center gap-1 ${readyToShipOnly ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
                >
                  <Package className="w-3 h-3" /> Ready to ship
                </button>
                <button
                  onClick={() => setFreeShipOnly((v) => !v)}
                  className={`px-3 h-7 rounded-full text-[11px] font-bold border transition flex items-center gap-1 ${freeShipOnly ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"}`}
                >
                  <Truck className="w-3 h-3" /> Free shipping
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{ranked.length} result{ranked.length === 1 ? "" : "s"} for "{submitted}"</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {ranked.slice(0, 80).map(({ item }) => (<UniversalResultCard key={item.id} hit={item} />))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong className="text-foreground font-bold">{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

const KIND_META: Record<UniversalHit["kind"], { label: string; icon: any }> = {
  product: { label: "Products", icon: Package },
  service: { label: "Services / Jobs", icon: Wrench },
  property: { label: "Property", icon: HomeIcon },
  finance: { label: "Finance", icon: Banknote },
  logistics: { label: "Delivery", icon: Truck },
  vehicle: { label: "Vehicles", icon: Car },
  stay: { label: "Stays", icon: BedDouble },
  industrial: { label: "Industrial", icon: Factory },
  news: { label: "News", icon: Newspaper },
  supplier: { label: "Suppliers", icon: StoreIcon },
  ride: { label: "Rides", icon: Navigation },
};

function KindFilterChips({
  value, onChange, pool,
}: { value: UniversalHit["kind"] | null; onChange: (k: UniversalHit["kind"] | null) => void; pool: UniversalHit[] }) {
  const counts = pool.reduce<Record<string, number>>((acc, h) => { acc[h.kind] = (acc[h.kind] ?? 0) + 1; return acc; }, {});
  const kinds = (Object.keys(counts) as UniversalHit["kind"][]).sort((a, b) => counts[b] - counts[a]);
  if (kinds.length <= 1) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 mb-3 pb-1">
      <button onClick={() => onChange(null)}
        className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${value === null ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
        All · {pool.length}
      </button>
      {kinds.map((k) => {
        const meta = KIND_META[k];
        const Icon = meta.icon;
        const active = value === k;
        return (
          <button key={k} onClick={() => onChange(active ? null : k)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
            <Icon className="w-3.5 h-3.5" /> {meta.label} · {counts[k]}
          </button>
        );
      })}
    </div>
  );
}

function UniversalResultCard({ hit }: { hit: UniversalHit }) {
  const meta = KIND_META[hit.kind];
  const Icon = meta.icon;
  const priceLabel = hit.price != null && hit.price > 0
    ? `${hit.currency ?? "$"}${hit.price.toLocaleString()}`
    : null;
  return (
    <Link to={hit.href} className="group flex gap-3 bg-card border rounded-2xl p-2.5 shadow-card hover:shadow-elevated transition">
      <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0 relative">
        {hit.image ? (
          <img src={hit.image} alt={hit.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Icon className="w-6 h-6" /></div>
        )}
        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-background/90 backdrop-blur shadow-soft inline-flex items-center gap-1">
          <Icon className="w-2.5 h-2.5" /> {meta.label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight line-clamp-2">{hit.title}</p>
        {hit.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{hit.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {priceLabel && <span className="text-sm font-black text-primary">{priceLabel}</span>}
          {hit.rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {hit.rating.toFixed(1)}
            </span>
          )}
          {hit.moq != null && hit.moq > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              MOQ {hit.moq}
            </span>
          )}
          {hit.readyToShip && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              Ready
            </span>
          )}
          {hit.verified && hit.kind === "supplier" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300">
              Verified
            </span>
          )}
          {(hit.city || hit.country) && (
            <span className="text-[10px] text-muted-foreground truncate">{[hit.city, hit.country].filter(Boolean).join(", ")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
