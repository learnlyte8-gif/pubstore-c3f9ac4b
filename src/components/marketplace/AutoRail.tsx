import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicles } from "@/data/verticals";
import { Car, Gauge, Fuel, Cog, MapPin } from "lucide-react";

export default function AutoRail() {
  const { data: vehicles = [] } = useQuery({ queryKey: ["home-vehicles"], queryFn: () => fetchVehicles({ limit: 8 }) });
  if (vehicles.length === 0) return null;
  return (
    <section className="mt-7 -mx-4 px-4 py-6 bg-zinc-950 text-zinc-100 relative overflow-hidden animate-fade-in">
      {/* Garage backdrop pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 28px, hsl(0 0% 100% / 1) 28px 29px), repeating-linear-gradient(90deg, transparent 0 28px, hsl(0 0% 100% / 1) 28px 29px)",
        }}
      />
      <div className="relative flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm bg-zinc-100/10 border border-zinc-100/20">
            <Car className="w-3 h-3" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em]">Department · Auto</span>
          </div>
          <h2 className="text-[24px] font-black leading-none mt-1.5 tracking-tighter">
            Engine room.
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">EVs, classics, work trucks, parts.</p>
        </div>
        <Link to="/auto" className="text-[11px] font-bold tracking-wider uppercase border border-zinc-100/30 px-2.5 py-1 rounded-sm hover:bg-zinc-100/10">
          All vehicles →
        </Link>
      </div>

      <div className="relative mt-4 -mx-1 px-1 pb-1 flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
        {vehicles.map((v) => (
          <Link key={v.id} to={`/auto/${v.id}`} className="shrink-0 w-60 snap-start group transition-transform duration-300 hover:-translate-y-0.5">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-zinc-100/10">
              {v.cover && <img src={v.cover} alt={v.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
              {v.badge && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-zinc-100 text-zinc-900 text-[9px] font-bold uppercase tracking-wider">
                  {v.badge}
                </span>
              )}
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-sm bg-zinc-900/80 backdrop-blur text-[9px] font-mono uppercase tracking-wider">
                {v.condition}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
                {v.year ?? ""} · {v.make ?? v.kind}
              </p>
              <p className="text-sm font-bold leading-tight line-clamp-1">{v.title}</p>
              <div className="flex items-center gap-2.5 text-[10px] text-zinc-400">
                {v.fuel && <span className="flex items-center gap-1"><Fuel className="w-2.5 h-2.5" />{v.fuel}</span>}
                {v.transmission && <span className="flex items-center gap-1"><Cog className="w-2.5 h-2.5" />{v.transmission}</span>}
                {v.mileage_km != null && v.mileage_km > 0 && (
                  <span className="flex items-center gap-1"><Gauge className="w-2.5 h-2.5" />{(v.mileage_km / 1000).toFixed(0)}k km</span>
                )}
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <p className="text-base font-black tracking-tighter tabular-nums">
                  ${v.price.toLocaleString()}
                </p>
                {v.country && <span className="text-[10px] text-zinc-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{v.country}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
