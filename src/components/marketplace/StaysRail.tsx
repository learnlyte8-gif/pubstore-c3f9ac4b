import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStays } from "@/data/verticals";
import { BedDouble, Star, MapPin, Sparkles } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  "b&b": "B&B", hotel: "Hotel", factory_tour: "Factory tour", apartment: "Apartment", retreat: "Retreat",
};

export default function StaysRail() {
  const { data: stays = [] } = useQuery({ queryKey: ["home-stays"], queryFn: () => fetchStays({ limit: 8 }) });
  if (stays.length === 0) return null;
  return (
    <section className="mt-7 animate-fade-in">
      <div className="px-4 flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Sparkles className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Stays · supplier-vetted</span>
          </div>
          <h2 className="text-[22px] font-serif leading-tight mt-1">Sleep among the makers</h2>
          <p className="text-xs text-muted-foreground">B&Bs, hotels and private factory tours.</p>
        </div>
        <Link to="/stays" className="text-xs font-bold text-primary">Browse all</Link>
      </div>

      <div className="mt-3 -mx-1 px-1 pb-2 flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
        {stays.map((s) => (
          <Link key={s.id} to={`/stays/${s.id}`} className="shrink-0 w-56 snap-start group transition-transform duration-300 hover:-translate-y-0.5">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-muted shadow-card transition-shadow duration-300 group-hover:shadow-elevated">
              {s.cover && <img src={s.cover} alt={s.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
              {s.superhost && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-foreground text-[9px] font-bold uppercase tracking-wider">
                  Superhost
                </span>
              )}
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-background/90 backdrop-blur text-[10px] font-bold flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {s.rating.toFixed(2)}
              </span>
              <div className="absolute bottom-2 inset-x-2 text-background">
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-90">{KIND_LABEL[s.kind] ?? s.kind}</p>
                <p className="text-sm font-bold leading-tight line-clamp-2 drop-shadow">{s.title}</p>
                <div className="flex items-center gap-1 text-[10px] mt-0.5 opacity-90">
                  <MapPin className="w-2.5 h-2.5" />
                  {s.city}{s.country ? `, ${s.country}` : ""}
                </div>
              </div>
            </div>
            <div className="mt-1.5 px-1 flex items-baseline justify-between">
              <p className="text-sm">
                <span className="font-bold tabular-nums">${Math.round(s.price_per_night)}</span>
                <span className="text-[10px] text-muted-foreground"> / night</span>
              </p>
              <BedDouble className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
