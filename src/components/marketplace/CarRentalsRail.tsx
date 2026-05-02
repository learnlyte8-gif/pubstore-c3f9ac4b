import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCarRentals } from "@/data/newVerticals";
import { Car, Star, Gauge, Users, Cog, ShieldCheck, MapPin, Infinity as InfinityIcon, Key } from "lucide-react";

export default function CarRentalsRail() {
  const { data: rentals = [] } = useQuery({
    queryKey: ["home-car-rentals"],
    queryFn: () => fetchCarRentals({ limit: 8 }),
  });
  if (rentals.length === 0) return null;
  return (
    <section className="mt-7 -mx-4 px-4 py-6 bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-500 text-white relative overflow-hidden animate-fade-in">
      {/* Tire-tread backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 12px, hsl(0 0% 100% / 1) 12px 14px)",
        }}
      />
      <div className="relative flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur border border-white/30">
            <Key className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Drive · Self-drive rentals</span>
          </div>
          <h2 className="text-[24px] font-black leading-none mt-1.5 tracking-tighter">
            Keys in 60 seconds.
          </h2>
          <p className="text-[11px] text-white/85 mt-0.5">Daily, weekly, monthly — insurance included.</p>
        </div>
        <Link
          to="/car-rentals"
          className="text-[11px] font-bold tracking-wider uppercase border border-white/40 px-2.5 py-1 rounded-sm hover:bg-white/15"
        >
          Browse fleet →
        </Link>
      </div>

      <div className="relative mt-4 -mx-1 px-1 pb-1 flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
        {rentals.map((r) => (
          <Link
            key={r.id}
            to={`/car-rentals/${r.id}`}
            className="shrink-0 w-64 snap-start group transition-transform duration-300 hover:-translate-y-0.5"
          >
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900/50 ring-1 ring-white/20">
              {r.cover && (
                <img
                  src={r.cover}
                  alt={r.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
              {/* Top-left class chip */}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-white text-zinc-900 text-[9px] font-bold uppercase tracking-wider">
                {r.vehicle_class}
              </span>
              {/* Top-right verified */}
              {r.verified && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-sm bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified
                </span>
              )}
              {/* Bottom price overlay */}
              <div className="absolute left-2 right-2 bottom-2 flex items-end justify-between">
                <div className="bg-zinc-900/85 backdrop-blur px-2 py-1 rounded-md">
                  <p className="text-[8px] uppercase tracking-wider text-white/70 leading-none">From</p>
                  <p className="text-base font-black tracking-tighter tabular-nums leading-none mt-0.5">
                    ${r.price_per_day}
                    <span className="text-[10px] font-bold text-white/70">/day</span>
                  </p>
                </div>
                {r.unlimited_km ? (
                  <span className="bg-emerald-500/90 backdrop-blur text-[9px] font-bold px-1.5 py-1 rounded-md inline-flex items-center gap-0.5">
                    <InfinityIcon className="w-2.5 h-2.5" /> KM
                  </span>
                ) : (
                  <span className="bg-zinc-900/85 backdrop-blur text-[9px] font-bold px-1.5 py-1 rounded-md inline-flex items-center gap-0.5">
                    <Gauge className="w-2.5 h-2.5" /> {r.free_km_per_day}km
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-[9px] font-mono uppercase tracking-wider text-white/70">
                {r.year ?? ""} · {r.make ?? "—"} {r.model ?? ""}
              </p>
              <p className="text-sm font-bold leading-tight line-clamp-1">{r.title}</p>
              <div className="flex items-center gap-2.5 text-[10px] text-white/80">
                <span className="flex items-center gap-1"><Cog className="w-2.5 h-2.5" />{r.transmission}</span>
                <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{r.seats}</span>
                {r.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    {r.rating.toFixed(1)}
                  </span>
                )}
              </div>
              {r.city && (
                <p className="text-[10px] text-white/70 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {r.city}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
