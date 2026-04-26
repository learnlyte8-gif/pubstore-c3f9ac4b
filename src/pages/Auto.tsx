import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicles, fetchVehicle } from "@/data/verticals";
import { ArrowLeft, Car, Fuel, Cog, Gauge, MapPin, Zap } from "lucide-react";
import { useState } from "react";

const KINDS = [
  { id: "all", label: "All" },
  { id: "car", label: "Cars" },
  { id: "ev", label: "EVs" },
  { id: "truck", label: "Trucks" },
  { id: "bike", label: "Bikes" },
  { id: "parts", label: "Parts" },
];

export default function Auto() {
  const { id } = useParams();
  if (id) return <AutoDetail id={id} />;
  return <AutoIndex />;
}

function AutoIndex() {
  const [kind, setKind] = useState("all");
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", kind],
    queryFn: () => fetchVehicles(kind === "all" ? {} : { kind }),
  });

  return (
    <div className="pb-10 bg-zinc-950 text-zinc-50 min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <div className="relative px-5 pt-6 pb-7 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0 32px, hsl(0 0% 100% / 1) 32px 33px), repeating-linear-gradient(90deg, transparent 0 32px, hsl(0 0% 100% / 1) 32px 33px)",
          }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-zinc-100/30 text-zinc-300">
            <Car className="w-3 h-3" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]">Department · Auto</span>
          </div>
          <h1 className="text-[44px] font-black leading-[0.92] tracking-tighter mt-2">
            <span className="block">Drive</span>
            <span className="block text-zinc-400">harder.</span>
          </h1>
          <p className="text-[12px] text-zinc-400 mt-2 max-w-xs">
            Cars, classics, EVs, trucks, motorcycles and OEM parts — direct from verified dealers and brands.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="px-5 flex gap-2 overflow-x-auto scrollbar-none">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`shrink-0 px-3 h-8 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider transition ${
              kind === k.id
                ? "bg-zinc-50 text-zinc-950"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-zinc-400">Loading vehicles…</p>}

      <div className="px-5 mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {vehicles.map((v) => (
          <Link key={v.id} to={`/auto/${v.id}`} className="group block">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-zinc-100/10">
              {v.cover && <img src={v.cover} alt={v.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
              {v.badge && (
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-sm bg-zinc-50 text-zinc-950 text-[9px] font-bold uppercase tracking-wider">
                  {v.badge}
                </span>
              )}
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-sm bg-zinc-950/80 backdrop-blur text-[9px] font-mono uppercase tracking-wider">
                {v.condition}
              </span>
              {v.fuel === "electric" && (
                <span className="absolute bottom-2.5 left-2.5 w-7 h-7 rounded-full bg-emerald-400 text-zinc-950 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="mt-2.5 space-y-1">
              <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-400">
                {v.year ?? ""} · {v.make ?? v.kind}
              </p>
              <p className="text-[15px] font-bold leading-tight line-clamp-1">{v.title}</p>
              <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                {v.fuel && <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{v.fuel}</span>}
                {v.transmission && <span className="flex items-center gap-1"><Cog className="w-3 h-3" />{v.transmission}</span>}
                {v.mileage_km != null && v.mileage_km > 0 && (
                  <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{(v.mileage_km / 1000).toFixed(0)}k km</span>
                )}
                {v.power_hp && <span>{v.power_hp} hp</span>}
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-lg font-black tracking-tighter tabular-nums">
                  ${v.price.toLocaleString()}
                </p>
                {v.country && <span className="text-[10px] text-zinc-400 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{v.country}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AutoDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: v, isLoading } = useQuery({ queryKey: ["vehicle", id], queryFn: () => fetchVehicle(id) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!v) return <p className="px-4 py-12 text-center text-sm">Vehicle not found.</p>;

  return (
    <div className="pb-32 bg-zinc-950 text-zinc-50 min-h-[calc(100vh-3.5rem)]">
      <div className="relative h-80 bg-zinc-900">
        {v.cover && <img src={v.cover} alt={v.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950" />
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-zinc-950/80 backdrop-blur flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {v.badge && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-sm bg-zinc-50 text-zinc-950 text-[10px] font-bold uppercase tracking-wider">
            {v.badge}
          </span>
        )}
      </div>

      <div className="px-5 -mt-12 relative">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
          {v.year ?? ""} · {v.make ?? v.kind} · {v.condition}
        </p>
        <h1 className="text-3xl font-black tracking-tighter leading-tight mt-1">{v.title}</h1>
        <p className="text-2xl font-black tabular-nums mt-2">
          ${v.price.toLocaleString()}
          {v.original_price && v.original_price > v.price && (
            <span className="text-sm font-normal text-zinc-500 line-through ml-2">${v.original_price.toLocaleString()}</span>
          )}
        </p>

        <div className="grid grid-cols-4 gap-2 mt-5">
          {v.fuel && <Spec label="Fuel" value={v.fuel} />}
          {v.transmission && <Spec label="Trans" value={v.transmission} />}
          {v.power_hp != null && <Spec label="Power" value={`${v.power_hp} hp`} />}
          {v.drivetrain && <Spec label="Drive" value={v.drivetrain} />}
          {v.mileage_km != null && v.mileage_km > 0 && <Spec label="Mileage" value={`${(v.mileage_km / 1000).toFixed(0)}k km`} />}
          {v.body_type && <Spec label="Body" value={v.body_type} />}
        </div>

        {v.description && (
          <p className="mt-5 text-sm leading-relaxed text-zinc-300">{v.description}</p>
        )}

        {v.features.length > 0 && (
          <>
            <h3 className="mt-6 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">Features</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.features.map((f) => (
                <span key={f} className="px-2.5 py-1 rounded-sm bg-zinc-900 ring-1 ring-zinc-100/10 text-[11px] font-semibold">{f}</span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-16 inset-x-0 z-20 px-3">
        <div className="max-w-md mx-auto bg-zinc-50 text-zinc-950 rounded-2xl p-3 flex items-center gap-3 shadow-elevated">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">List price</p>
            <p className="font-black text-lg leading-none tabular-nums">${v.price.toLocaleString()}</p>
          </div>
          <button className="h-11 px-5 rounded-full bg-zinc-950 text-zinc-50 text-sm font-bold">Inquire</button>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 ring-1 ring-zinc-100/10 rounded-md p-2 text-center">
      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-mono">{label}</p>
      <p className="text-[11px] font-bold mt-0.5 capitalize">{value}</p>
    </div>
  );
}
