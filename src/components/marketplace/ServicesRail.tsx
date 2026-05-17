import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceProviders } from "@/data/newVerticals";
import { Wrench, Star, MapPin, Sparkles } from "lucide-react";
import SaveHeart from "./SaveHeart";

export default function ServicesRail() {
  const { data: providers = [] } = useQuery({ queryKey: ["home-services"], queryFn: () => fetchServiceProviders({ limit: 8 }) });
  if (providers.length === 0) return null;
  return (
    <section className="mt-7 animate-fade-in">
      <div className="px-4 flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Sparkles className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Local pros</span>
          </div>
          <h2 className="text-[22px] font-serif leading-tight mt-1">Get it fixed today</h2>
          <p className="text-xs text-muted-foreground">Plumbers, electricians, tutors & more.</p>
        </div>
        <Link to="/services" className="text-xs font-bold text-primary">Browse all</Link>
      </div>

      <div className="mt-3 -mx-1 px-1 pb-2 flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory">
        {providers.map((p) => (
          <div key={p.id} className="shrink-0 w-44 snap-start bg-card border rounded-2xl shadow-card overflow-hidden relative">
            <div className="relative aspect-[4/3] bg-muted">
              {p.cover && <img src={p.cover} alt={p.display_name} className="w-full h-full object-cover" />}
              <SaveHeart
                kind="service"
                itemId={p.id}
                snapshot={{ title: p.display_name, image: p.cover, href: "/services" }}
                className="absolute top-1.5 right-1.5 w-7 h-7"
              />
            </div>
            <div className="p-2.5">
              <p className="font-bold text-xs leading-tight truncate">{p.display_name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{p.category}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] flex items-center gap-0.5 font-bold">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)}
                </span>
                {p.hourly_rate && <span className="text-xs font-bold">${p.hourly_rate}/hr</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
