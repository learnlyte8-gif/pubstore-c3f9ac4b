import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStays, fetchStay } from "@/data/verticals";
import { ArrowLeft, BedDouble, Star, MapPin, Users, Bath, Wifi, Sparkles } from "lucide-react";
import { useState } from "react";

const KINDS = [
  { id: "all", label: "All stays" },
  { id: "b&b", label: "B&B" },
  { id: "hotel", label: "Hotels" },
  { id: "apartment", label: "Apartments" },
  { id: "factory_tour", label: "Factory tours" },
  { id: "retreat", label: "Retreats" },
];

export default function Stays() {
  const { id } = useParams();
  if (id) return <StayDetail id={id} />;
  return <StaysIndex />;
}

function StaysIndex() {
  const [kind, setKind] = useState("all");
  const { data: stays = [], isLoading } = useQuery({
    queryKey: ["stays", kind],
    queryFn: () => fetchStays(kind === "all" ? {} : { kind }),
  });

  return (
    <div className="pb-10">
      {/* Hero */}
      <div className="relative mx-4 mt-3 rounded-3xl overflow-hidden shadow-elevated bg-gradient-to-br from-amber-50 via-rose-50 to-orange-100 p-5">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-300/40 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-rose-300/40 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 mb-2">
            <Sparkles className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider">PUBSTORE Stays</span>
          </div>
          <h1 className="font-serif text-3xl leading-tight tracking-tight text-zinc-900">
            Stay where the<br />makers live.
          </h1>
          <p className="text-[12px] text-zinc-700 mt-2 max-w-xs">
            Curated B&Bs, designer apartments and supplier-hosted factory tours — vetted by PUBSTORE.
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-none">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-bold transition ${
              kind === k.id
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground">Loading stays…</p>}

      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stays.map((s) => (
          <Link key={s.id} to={`/stays/${s.id}`} className="block group">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted shadow-card">
              {s.cover && <img src={s.cover} alt={s.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
              {s.superhost && (
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-amber-400 text-foreground text-[10px] font-bold uppercase tracking-wider shadow">
                  Superhost
                </span>
              )}
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-background/95 backdrop-blur text-[11px] font-bold flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {s.rating.toFixed(2)}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.kind}</p>
              <p className="font-serif text-base leading-snug line-clamp-1">{s.title}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {s.city}{s.country ? `, ${s.country}` : ""}
              </p>
              <p className="text-sm mt-1.5">
                <span className="font-bold tabular-nums">${Math.round(s.price_per_night)}</span>
                <span className="text-[11px] text-muted-foreground"> / night · {s.review_count} reviews</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StayDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: stay, isLoading } = useQuery({ queryKey: ["stay", id], queryFn: () => fetchStay(id) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!stay) return <p className="px-4 py-12 text-center text-sm">Stay not found.</p>;

  return (
    <div className="pb-32">
      <div className="relative h-72">
        {stay.cover && <img src={stay.cover} alt={stay.title} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/40 via-transparent to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center shadow">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {stay.superhost && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-400 text-foreground text-[11px] font-bold uppercase tracking-wider shadow">
            Superhost
          </span>
        )}
      </div>

      <div className="px-5 mt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stay.kind}</p>
        <h1 className="font-serif text-3xl leading-tight mt-1">{stay.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {stay.rating.toFixed(2)} · {stay.review_count} reviews</span>
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {stay.city}{stay.country ? `, ${stay.country}` : ""}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-5">
          <Spec icon={Users} value={stay.guests} label="Guests" />
          <Spec icon={BedDouble} value={stay.bedrooms} label="Bedrooms" />
          <Spec icon={BedDouble} value={stay.beds} label="Beds" />
          <Spec icon={Bath} value={stay.baths} label="Baths" />
        </div>

        {stay.description && (
          <p className="mt-5 text-sm leading-relaxed text-foreground/90 font-serif">{stay.description}</p>
        )}

        {stay.amenities.length > 0 && (
          <>
            <h3 className="mt-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amenities</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stay.amenities.map((a) => (
                <span key={a} className="px-2.5 py-1 rounded-full bg-muted text-[11px] font-semibold flex items-center gap-1">
                  <Wifi className="w-3 h-3 opacity-60" /> {a}
                </span>
              ))}
            </div>
          </>
        )}

        {stay.gallery.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            {stay.gallery.slice(0, 4).map((g, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                <img src={g} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky book bar */}
      <div className="fixed bottom-16 inset-x-0 z-20 px-3">
        <div className="max-w-md mx-auto bg-card border shadow-elevated rounded-2xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">From</p>
            <p className="font-bold text-lg leading-none tabular-nums">${Math.round(stay.price_per_night)}<span className="text-[10px] font-normal text-muted-foreground"> / night</span></p>
          </div>
          <button className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-bold shadow-card">
            Reserve
          </button>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className="bg-card border rounded-xl p-2.5 text-center">
      <Icon className="w-4 h-4 mx-auto text-muted-foreground" />
      <p className="text-sm font-bold mt-1 tabular-nums">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
    </div>
  );
}
