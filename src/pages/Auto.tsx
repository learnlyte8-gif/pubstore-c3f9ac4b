import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicles, fetchVehicle } from "@/data/verticals";
import { ArrowLeft, Car, Fuel, Cog, Gauge, MapPin, Zap, Heart, Calculator, Bike, Truck, Wrench, Sparkles as SparklesIcon } from "lucide-react";
import { useState } from "react";
import VehicleInquiryDialog from "@/components/marketplace/VehicleInquiryDialog";
import { useVehicleSaves } from "@/hooks/useVehicleSaves";
import CircleSpinner from "@/components/CircleSpinner";
import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";

const BNB_AUTO_CATS = [
  { slug: "all", label: "All", icon: SparklesIcon },
  { slug: "car", label: "Cars", icon: Car },
  { slug: "ev", label: "EVs", icon: Zap },
  { slug: "truck", label: "Trucks", icon: Truck },
  { slug: "bike", label: "Bikes", icon: Bike },
  { slug: "parts", label: "Parts", icon: Wrench },
];

export default function Auto() {
  const { id } = useParams();
  if (id) return <AutoDetail id={id} />;
  return <AutoIndex />;
}

function AutoIndex() {
  return (
    <BnbVerticalScreen
      queryKey={["bnb-vehicles"]}
      fetcher={(cat) => fetchVehicles(cat === "all" ? {} : { kind: cat })}
      categories={BNB_AUTO_CATS}
      units="none"
      saveKind="vehicle"
      wherePlaceholder="Search make, model, city"
      emptyLabel="No vehicles match your search"
      toListing={(v) => ({
        id: v.id,
        title: v.title,
        location: [v.city, v.country].filter(Boolean).join(", ") || null,
        subtitle: [v.make, v.model, v.year].filter(Boolean).join(" · "),
        images: [v.cover, ...(v.gallery ?? [])].filter(Boolean) as string[],
        price: v.price,
        priceUnit: null,
        badge: v.badge ?? (v.kind === "ev" ? "Electric" : null),
        href: `/auto/${v.id}`,
      })}
    />
  );
}


function AutoDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | "inquiry" | "test_drive" | "financing">(null);
  const { isSaved, toggle } = useVehicleSaves();
  const { data: v, isLoading } = useQuery({ queryKey: ["vehicle", id], queryFn: () => fetchVehicle(id) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
  if (!v) return <p className="px-4 py-12 text-center text-sm">Vehicle not found.</p>;
  const saved = isSaved(v.id);

  return (
    <div className=" bg-zinc-950 text-zinc-50 min-h-[calc(100vh-3.5rem)] animate-fade-in">
      <div className="relative h-80 bg-zinc-900">
        {v.cover && <img src={v.cover} alt={v.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950" />
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-zinc-950/80 backdrop-blur flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggle(v.id)}
          aria-label={saved ? "Unsave" : "Save"}
          className="absolute top-3 right-14 w-9 h-9 rounded-full bg-zinc-950/80 backdrop-blur flex items-center justify-center"
        >
          <Heart className={`w-4 h-4 ${saved ? "fill-rose-400 text-rose-400" : "text-zinc-50"}`} />
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

      <div className="fixed bottom-24 inset-x-0 z-30 px-3">
        <div className="max-w-md mx-auto bg-zinc-50 text-zinc-950 rounded-2xl p-3 flex items-center gap-2 shadow-elevated">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">List price</p>
            <p className="font-black text-lg leading-none tabular-nums">${v.price.toLocaleString()}</p>
          </div>
          <button onClick={() => setDialog("financing")} aria-label="Financing" className="w-11 h-11 rounded-full bg-zinc-100 text-zinc-950 flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </button>
          <button onClick={() => setDialog("test_drive")} className="h-11 px-3 rounded-full bg-zinc-100 text-zinc-950 text-xs font-bold">Test drive</button>
          <button onClick={() => setDialog("inquiry")} className="h-11 px-4 rounded-full bg-zinc-950 text-zinc-50 text-sm font-bold">Inquire</button>
        </div>
      </div>

      <VehicleInquiryDialog vehicle={v} open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} initialMode={dialog ?? "inquiry"} />
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
