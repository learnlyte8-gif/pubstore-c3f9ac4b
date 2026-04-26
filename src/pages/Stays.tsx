import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStays, fetchStay } from "@/data/verticals";
import { ArrowLeft, BedDouble, Star, MapPin, Users, Bath, Wifi, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar, FilterField, SortPills } from "@/components/marketplace/FilterBar";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

const KINDS = [
  { id: "all", label: "All stays" },
  { id: "b&b", label: "B&B" },
  { id: "hotel", label: "Hotels" },
  { id: "apartment", label: "Apartments" },
  { id: "factory_tour", label: "Factory tours" },
  { id: "retreat", label: "Retreats" },
];

const SORTS = [
  { id: "rating", label: "Top rated" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "reviews", label: "Most reviewed" },
];

export default function Stays() {
  const { id } = useParams();
  if (id) return <StayDetail id={id} />;
  return <StaysIndex />;
}

function StaysIndex() {
  const { values, update, reset } = useUrlFilters({
    q: "",
    kind: "all",
    sort: "rating",
    maxPrice: "",
    superhost: "",
  });

  const { data: stays = [], isLoading } = useQuery({
    queryKey: ["stays", values.kind],
    queryFn: () => fetchStays(values.kind === "all" ? {} : { kind: values.kind }),
  });

  const priceMax = useMemo(
    () => Math.max(50, Math.ceil((stays.reduce((m, s) => Math.max(m, s.price_per_night), 0) || 500) / 50) * 50),
    [stays],
  );

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const cap = values.maxPrice ? Number(values.maxPrice) : 0;
    let list = stays.filter((s) => {
      if (cap > 0 && s.price_per_night > cap) return false;
      if (values.superhost === "1" && !s.superhost) return false;
      if (!q) return true;
      const hay = `${s.title} ${s.city ?? ""} ${s.country ?? ""} ${s.kind} ${s.amenities.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
    list = [...list].sort((a, b) => {
      if (values.sort === "price_asc") return a.price_per_night - b.price_per_night;
      if (values.sort === "price_desc") return b.price_per_night - a.price_per_night;
      if (values.sort === "reviews") return b.review_count - a.review_count;
      return b.rating - a.rating;
    });
    return list;
  }, [stays, values]);

  const advancedCount =
    (values.sort !== "rating" ? 1 : 0) + (values.maxPrice ? 1 : 0) + (values.superhost === "1" ? 1 : 0);
  const anyActive = !!values.q || values.kind !== "all" || advancedCount > 0;

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

      <FilterBar
        tone="light"
        search={values.q}
        onSearchChange={(q) => update({ q })}
        searchPlaceholder="Search city, host, amenities…"
        chips={KINDS}
        chipValue={values.kind}
        onChipChange={(kind) => update({ kind })}
        canReset={anyActive}
        onReset={reset}
        activeAdvancedCount={advancedCount}
        trailing={`${filtered.length} ${filtered.length === 1 ? "stay" : "stays"}`}
        advanced={
          <div className="space-y-3">
            <FilterField label="Sort by">
              <SortPills value={values.sort} onChange={(v) => update({ sort: v })} options={SORTS} />
            </FilterField>
            <FilterField label={`Max price${values.maxPrice ? ` · $${values.maxPrice}/night` : ""}`}>
              <Slider
                min={0}
                max={priceMax}
                step={25}
                value={[values.maxPrice ? Number(values.maxPrice) : 0]}
                onValueChange={([v]) => update({ maxPrice: v ? String(v) : "" })}
              />
              <p className="text-[10px] text-muted-foreground">0 = any price · up to ${priceMax}</p>
            </FilterField>
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
              <Checkbox
                checked={values.superhost === "1"}
                onCheckedChange={(c) => update({ superhost: c ? "1" : "" })}
              />
              Superhosts only
            </label>
          </div>
        }
      />

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground">Loading stays…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="px-4 mt-10 text-center">
          <BedDouble className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">No stays match your filters.</p>
          <button onClick={reset} className="mt-1 text-xs text-primary font-bold">Reset filters</button>
        </div>
      )}

      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((s, i) => (
          <Link
            key={s.id}
            to={`/stays/${s.id}`}
            className="block group animate-fade-in"
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: "backwards" }}
          >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted shadow-card transition-shadow duration-300 group-hover:shadow-elevated">
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
    <div className="pb-32 animate-fade-in">
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
