import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { fetchNews, fetchNewsArticle } from "@/data/verticals";
import { ArrowLeft, Clock3, Newspaper } from "lucide-react";
import { useMemo } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar, FilterField, SortPills } from "@/components/marketplace/FilterBar";
import { Slider } from "@/components/ui/slider";
import CircleSpinner from "@/components/CircleSpinner";

const CATS = [
  { id: "all", label: "All" },
  { id: "marketplace", label: "Marketplace" },
  { id: "industrial", label: "Industrial" },
  { id: "automotive", label: "Automotive" },
  { id: "stays", label: "Stays" },
];

const SORTS = [
  { id: "recent", label: "Most recent" },
  { id: "longest", label: "Longest read" },
  { id: "shortest", label: "Quick reads" },
  { id: "popular", label: "Most viewed" },
];

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function News() {
  const { slug } = useParams();
  if (slug) return <NewsArticleView slug={slug} />;
  return <NewsIndex />;
}

function NewsIndex() {
  const { values, update, reset } = useUrlFilters({
    q: "",
    cat: "all",
    sort: "recent",
    maxRead: "",
  });

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["news", values.cat],
    queryFn: () => fetchNews(values.cat === "all" ? {} : { category: values.cat }),
  });

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const max = values.maxRead ? Number(values.maxRead) : 0;
    let list = articles.filter((a) => {
      if (max > 0 && a.read_minutes > max) return false;
      if (!q) return true;
      const hay = `${a.title} ${a.dek ?? ""} ${a.author ?? ""} ${a.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
    list = [...list].sort((a, b) => {
      if (values.sort === "longest") return b.read_minutes - a.read_minutes;
      if (values.sort === "shortest") return a.read_minutes - b.read_minutes;
      if (values.sort === "popular") return b.views - a.views;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
    return list;
  }, [articles, values]);

  const featured = filtered.find((a) => a.featured) ?? filtered[0];
  const rest = filtered.filter((a) => a.id !== featured?.id);

  const advancedCount = (values.sort !== "recent" ? 1 : 0) + (values.maxRead ? 1 : 0);
  const anyActive = !!values.q || values.cat !== "all" || advancedCount > 0;

  return (
    <div className="pb-10">
      {/* Masthead */}
      <header className="px-4 pt-6 border-b-4 border-double border-foreground pb-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground text-center">
          Volume XI · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <h1 className="font-serif text-5xl text-center leading-none mt-1 tracking-tight">PUBSTORE Daily</h1>
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-center text-muted-foreground mt-1">
          The shopping complex chronicle
        </p>
      </header>

      <FilterBar
        tone="newsprint"
        search={values.q}
        onSearchChange={(q) => update({ q })}
        searchPlaceholder="Search headlines, authors, tags…"
        chips={CATS}
        chipValue={values.cat}
        onChipChange={(cat) => update({ cat })}
        canReset={anyActive}
        onReset={reset}
        activeAdvancedCount={advancedCount}
        trailing={`${filtered.length} ${filtered.length === 1 ? "story" : "stories"}`}
        advanced={
          <div className="space-y-3">
            <FilterField label="Sort by">
              <SortPills value={values.sort} onChange={(v) => update({ sort: v })} options={SORTS} />
            </FilterField>
            <FilterField label={`Max read time${values.maxRead ? ` · ${values.maxRead} min` : ""}`}>
              <Slider
                min={0}
                max={20}
                step={1}
                value={[values.maxRead ? Number(values.maxRead) : 0]}
                onValueChange={([v]) => update({ maxRead: v ? String(v) : "" })}
              />
              <p className="text-[10px] text-muted-foreground">0 = any length</p>
            </FilterField>
          </div>
        }
      />

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>}

      {!isLoading && filtered.length === 0 && (
        <div className="px-4 mt-10 text-center">
          <Newspaper className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">No stories match.</p>
          <button onClick={reset} className="mt-1 text-xs text-primary font-bold">Reset filters</button>
        </div>
      )}

      {/* Featured */}
      {featured && (
        <Link key={featured.id} to={`/news/${featured.slug}`} className="block px-4 mt-5 animate-fade-in">
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-muted shadow-elevated">
            {featured.cover && <img src={featured.cover} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-[1.03]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/15 to-transparent" />
            <div className="absolute top-3 left-3">
              <span className="px-2 py-0.5 rounded-full bg-background text-foreground text-[10px] font-bold uppercase tracking-wider">
                Lead story · {featured.category}
              </span>
            </div>
            <div className="absolute bottom-4 inset-x-4 text-background">
              <h2 className="font-serif text-3xl leading-tight tracking-tight line-clamp-3 drop-shadow">{featured.title}</h2>
              {featured.dek && <p className="text-sm mt-1.5 line-clamp-2 opacity-95">{featured.dek}</p>}
              <div className="flex items-center gap-2 mt-2.5 text-[11px] font-semibold opacity-95">
                <span>{featured.author ?? "Editorial"}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{featured.read_minutes} min read</span>
                <span>·</span>
                <span>{ago(featured.published_at)} ago</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Two-column print layout */}
      <div className="px-4 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {rest.map((n, i) => (
          <Link
            key={n.id}
            to={`/news/${n.slug}`}
            className="block group animate-fade-in"
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: "backwards" }}
          >
            <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted">
              {n.cover && <img src={n.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
            </div>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-2">
              {n.category} · {ago(n.published_at)} ago · {n.read_minutes} min
            </p>
            <h3 className="font-serif text-lg leading-tight tracking-tight mt-1 line-clamp-2 group-hover:underline underline-offset-4 decoration-2">{n.title}</h3>
            {n.dek && <p className="text-[12px] text-muted-foreground line-clamp-2 mt-1">{n.dek}</p>}
            <p className="text-[11px] mt-1.5 italic">— {n.author ?? "Editorial"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewsArticleView({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { data: article, isLoading } = useQuery({ queryKey: ["news-article", slug], queryFn: () => fetchNewsArticle(slug) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground">Loading article…</p>;
  if (!article) {
    return (
      <div className="px-4 py-16 text-center">
        <Newspaper className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm">Article not found.</p>
        <Link to="/news" className="text-xs text-primary font-bold mt-2 inline-block">Back to News</Link>
      </div>
    );
  }

  return (
    <article className="pb-12 animate-fade-in">
      <button onClick={() => navigate(-1)} className="mx-4 mt-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <header className="px-4 mt-3 max-w-2xl mx-auto">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {article.category} · {article.read_minutes} min read · {ago(article.published_at)} ago
        </p>
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight mt-2">{article.title}</h1>
        {article.dek && <p className="text-base text-muted-foreground mt-2 leading-snug">{article.dek}</p>}
        <p className="text-xs italic mt-3">— {article.author ?? "Editorial"}</p>
      </header>

      {article.cover && (
        <div className="px-4 mt-5 max-w-3xl mx-auto">
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-muted shadow-card">
            <img src={article.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      )}

      <div className="px-4 mt-6 max-w-2xl mx-auto font-serif text-[15px] leading-[1.7] space-y-4">
        {(article.body ?? "").split("\n").filter(Boolean).map((p, i) => (
          <p key={i} className={i === 0 ? "first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:leading-[0.85]" : ""}>
            {p}
          </p>
        ))}
      </div>

      {article.tags.length > 0 && (
        <div className="px-4 mt-8 max-w-2xl mx-auto flex flex-wrap gap-1.5">
          {article.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-mono uppercase tracking-wider">#{t}</span>
          ))}
        </div>
      )}
    </article>
  );
}
