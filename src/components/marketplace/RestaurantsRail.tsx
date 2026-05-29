import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed, Star, Truck, CalendarDays, ChevronRight, Clock } from "lucide-react";
import { fetchRestaurants } from "@/data/restaurants";

export default function RestaurantsRail() {
  const { data: list = [] } = useQuery({
    queryKey: ["home-restaurants"],
    queryFn: () => fetchRestaurants({ limit: 10 }),
  });

  if (list.length === 0) return null;

  return (
    <section className="px-4 mt-6">
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-2.5">
          <span className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-400 flex items-center justify-center shadow-pop">
            <UtensilsCrossed className="w-4 h-4 text-white" strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="font-bold text-sm leading-tight">Food near you</h3>
            <p className="text-[11px] text-muted-foreground">Order delivery or reserve a table</p>
          </div>
        </div>
        <Link to="/restaurants" className="text-xs font-bold text-primary flex items-center gap-0.5">
          See all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
        {list.map((r) => (
          <Link
            key={r.id}
            to={`/restaurants/${r.id}`}
            className="shrink-0 w-48 bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition group"
          >
            <div className="aspect-video bg-muted overflow-hidden relative">
              {r.cover && (
                <img src={r.cover} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
              )}
              <div className="absolute top-2 left-2 flex gap-1">
                {r.delivery_enabled && (
                  <span className="px-1.5 py-0.5 rounded-full bg-background/90 backdrop-blur text-[9px] font-bold flex items-center gap-0.5">
                    <Truck className="w-2.5 h-2.5" /> Delivery
                  </span>
                )}
                {r.reservation_enabled && (
                  <span className="px-1.5 py-0.5 rounded-full bg-background/90 backdrop-blur text-[9px] font-bold flex items-center gap-0.5">
                    <CalendarDays className="w-2.5 h-2.5" /> Tables
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-xs leading-tight truncate">{r.name}</p>
                <span className="text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {r.rating.toFixed(1)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {r.cuisine || "Restaurant"}{r.city ? ` · ${r.city}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {r.prep_time_minutes}m</span>
                {r.delivery_enabled && r.delivery_fee > 0 && <span>· ${r.delivery_fee.toFixed(2)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
