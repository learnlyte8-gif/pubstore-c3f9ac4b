import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchNews } from "@/data/verticals";
import { Newspaper, ArrowUpRight, Clock3 } from "lucide-react";

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function NewsRail() {
  const { data: news = [] } = useQuery({ queryKey: ["home-news"], queryFn: () => fetchNews({ limit: 6 }) });
  if (news.length === 0) return null;
  const [lead, ...rest] = news;
  return (
    <section className="mt-7 animate-fade-in">
      {/* Newsprint header */}
      <div className="px-4 flex items-end justify-between border-b-2 border-foreground pb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif italic text-lg leading-none">PUBSTORE</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground border border-foreground/30 px-1.5 py-0.5">
            Daily
          </span>
        </div>
        <Link to="/news" className="text-xs font-bold tracking-wide flex items-center gap-1">
          All stories <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Lead story */}
      <Link to={`/news/${lead.slug}`} className="block px-4 mt-3">
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-muted shadow-card">
          {lead.cover && <img src={lead.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/10 to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 rounded-full bg-background/95 text-foreground text-[9px] font-bold uppercase tracking-wider">
              {lead.category}
            </span>
          </div>
          <div className="absolute bottom-3 inset-x-3 text-background">
            <h3 className="font-serif text-2xl leading-tight tracking-tight line-clamp-2 drop-shadow">{lead.title}</h3>
            {lead.dek && <p className="text-[12px] mt-1 line-clamp-2 opacity-90">{lead.dek}</p>}
            <div className="flex items-center gap-2 mt-2 text-[10px] font-semibold opacity-90">
              <span>{lead.author ?? "Editorial"}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" /> {lead.read_minutes} min</span>
              <span>·</span>
              <span>{ago(lead.published_at)} ago</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Below the fold: column of headlines */}
      <div className="mt-3 mx-4 divide-y divide-foreground/15 border-t border-foreground/15">
        {rest.slice(0, 4).map((n) => (
          <Link key={n.id} to={`/news/${n.slug}`} className="flex items-center gap-3 py-3 group">
            <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted">
              {n.cover && <img src={n.cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {n.category} · {ago(n.published_at)} ago
              </p>
              <p className="font-serif text-sm leading-snug line-clamp-2 mt-0.5">{n.title}</p>
            </div>
            <Newspaper className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
