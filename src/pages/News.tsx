import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchNews, fetchNewsArticle } from "@/data/verticals";
import { ArrowLeft, Clock3, Newspaper } from "lucide-react";
import { useState } from "react";

const CATS = ["all", "marketplace", "industrial", "automotive", "stays"] as const;

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
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["news", cat],
    queryFn: () => fetchNews(cat === "all" ? {} : { category: cat }),
  });
  const featured = articles.filter((a) => a.featured)[0] ?? articles[0];
  const rest = articles.filter((a) => a.id !== featured?.id);

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

      {/* Filter */}
      <div className="px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-none">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-bold uppercase tracking-wider border transition ${
              cat === c
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-foreground/20 hover:border-foreground/50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground">Loading…</p>}

      {/* Featured */}
      {featured && (
        <Link to={`/news/${featured.slug}`} className="block px-4 mt-5">
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-muted shadow-elevated">
            {featured.cover && <img src={featured.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
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
        {rest.map((n) => (
          <Link key={n.id} to={`/news/${n.slug}`} className="block group">
            <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted">
              {n.cover && <img src={n.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
            </div>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-2">
              {n.category} · {ago(n.published_at)} ago · {n.read_minutes} min
            </p>
            <h3 className="font-serif text-lg leading-tight tracking-tight mt-1 line-clamp-2">{n.title}</h3>
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
    <article className="pb-12">
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
