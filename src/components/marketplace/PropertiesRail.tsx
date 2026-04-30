import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProperties } from "@/data/newVerticals";
import { Home, MapPin, Bed, Bath, Sparkles } from "lucide-react";

export default function PropertiesRail() {
  const { data: properties = [] } = useQuery({ queryKey: ["home-properties"], queryFn: () => fetchProperties({ limit: 8 }) });
  if (properties.length === 0) return null;
  return (
    <section className="mt-7 animate-fade-in">
      <div className="px-4 flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Sparkles className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Real estate</span>
          </div>
          <h2 className="text-[22px] font-serif leading-tight mt-1">Find your next place</h2>
          <p className="text-xs text-muted-foreground">Rentals, sales & shared rooms.</p>
        </div>
        <Link to="/properties" className="text-xs font-bold text-primary">Browse all</Link>
      </div>

      <div className="mt-3 -mx-1 px-1 pb-2 flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory">
        {properties.map((p) => (
          <Link key={p.id} to="/properties" className="shrink-0 w-56 snap-start bg-card border rounded-2xl shadow-card overflow-hidden">
            <div className="relative aspect-[16/10] bg-muted">
              {p.cover && <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-background/95 backdrop-blur text-[9px] font-bold uppercase capitalize">{p.listing_type}</span>
              <span className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-background/95 backdrop-blur text-xs font-bold">
                ${Number(p.price).toLocaleString()}{(p.listing_type === "rent" || p.listing_type === "shared") && <span className="text-[9px] text-muted-foreground">/{p.price_period}</span>}
              </span>
            </div>
            <div className="p-2.5">
              <p className="font-bold text-xs leading-tight line-clamp-1">{p.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {p.city}</p>
              <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                {p.bedrooms != null && <span className="flex items-center gap-0.5"><Bed className="w-2.5 h-2.5" /> {p.bedrooms}</span>}
                {p.baths != null && <span className="flex items-center gap-0.5"><Bath className="w-2.5 h-2.5" /> {p.baths}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
