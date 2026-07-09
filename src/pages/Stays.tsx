import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStays, fetchStay } from "@/data/verticals";
import { ArrowLeft, BedDouble, Star, MapPin, Users, Bath, Wifi, Sparkles as SparklesIcon, Building2, Home as HomeIcon, Palmtree, Factory } from "lucide-react";
import { useState } from "react";
import StayBookingDialog from "@/components/marketplace/StayBookingDialog";
import CircleSpinner from "@/components/CircleSpinner";
import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";

const BNB_STAY_CATS = [
  { slug: "all", label: "All stays", icon: SparklesIcon },
  { slug: "b&b", label: "B&B", icon: BedDouble },
  { slug: "hotel", label: "Hotels", icon: Building2 },
  { slug: "apartment", label: "Apartments", icon: HomeIcon },
  { slug: "factory_tour", label: "Factory tours", icon: Factory },
  { slug: "retreat", label: "Retreats", icon: Palmtree },
];

export default function Stays() {
  const { id } = useParams();
  if (id) return <StayDetail id={id} />;
  return <StaysIndex />;
}

function StaysIndex() {
  return (
    <BnbVerticalScreen
      queryKey={["bnb-stays"]}
      fetcher={(cat) => fetchStays(cat === "all" ? {} : { kind: cat })}
      categories={BNB_STAY_CATS}
      units="guests"
      saveKind="stay"
      wherePlaceholder="Search cities, hosts, retreats"
      emptyLabel="No stays match your search"
      toListing={(s) => ({
        id: s.id,
        title: s.title,
        location: [s.city, s.country].filter(Boolean).join(", ") || null,
        subtitle: `${s.beds} beds · ${s.baths} baths`,
        images: [s.cover, ...(s.gallery ?? [])].filter(Boolean) as string[],
        price: s.price_per_night,
        priceUnit: "night",
        rating: s.rating,
        badge: s.superhost ? "Superhost" : null,
        href: `/stays/${s.id}`,
      })}
    />
  );
}


function StayDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [bookOpen, setBookOpen] = useState(false);
  const { data: stay, isLoading } = useQuery({ queryKey: ["stay", id], queryFn: () => fetchStay(id) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
  if (!stay) return <p className="px-4 py-12 text-center text-sm">Stay not found.</p>;

  return (
    <div className=" animate-fade-in">
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
      <div className="fixed bottom-24 inset-x-0 z-30 px-3">
        <div className="max-w-md mx-auto bg-card border shadow-elevated rounded-2xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">From</p>
            <p className="font-bold text-lg leading-none tabular-nums">${Math.round(stay.price_per_night)}<span className="text-[10px] font-normal text-muted-foreground"> / night</span></p>
          </div>
          <button onClick={() => setBookOpen(true)} className="h-11 px-5 rounded-full bg-foreground text-background text-sm font-bold shadow-card">
            Reserve
          </button>
        </div>
      </div>

      <StayBookingDialog stay={stay} open={bookOpen} onOpenChange={setBookOpen} />
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
