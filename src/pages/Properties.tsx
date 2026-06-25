import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home as HomeIcon, MapPin, Bed, Bath, Maximize2, Phone, MessageCircle, Star, Mail } from "lucide-react";
import { fetchProperties, PROPERTY_KINDS, type Property } from "@/data/newVerticals";
import EmptyState from "@/components/EmptyState";
import PropertyInquiryDialog from "@/components/marketplace/PropertyInquiryDialog";
import BackButton from "@/components/BackButton";

export default function Properties() {
  const [listingType, setListingType] = useState<string>("rent");
  const [kind, setKind] = useState<string>("");
  const [inquiryFor, setInquiryFor] = useState<Property | null>(null);

  const { data: properties = [] } = useQuery({
    queryKey: ["properties", listingType, kind],
    queryFn: () => fetchProperties({ listing_type: listingType, property_kind: kind || undefined, limit: 60 }),
  });

  return (
    <div className="pb-8">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-sky-700 via-blue-700 to-indigo-800 text-white">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <HomeIcon className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Real estate</h1>
            <p className="text-[11px] opacity-90">Apartments, houses, rooms, land & commercial spaces.</p>
          </div>
        </div>

        <div className="mt-3 flex bg-white/15 backdrop-blur rounded-full p-1">
          {[
            { id: "rent", label: "Rent" },
            { id: "sale", label: "Buy" },
            { id: "shared", label: "Shared" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setListingType(t.id)}
              className={`flex-1 h-9 rounded-full text-xs font-bold transition ${listingType === t.id ? "bg-white text-foreground" : "text-white/90"}`}
            >{t.label}</button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
          <button onClick={() => setKind("")} className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${kind === "" ? "bg-foreground text-background" : "bg-card"}`}>All</button>
          {PROPERTY_KINDS.map((k) => (
            <button key={k.slug} onClick={() => setKind(k.slug)} className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${kind === k.slug ? "bg-foreground text-background" : "bg-card"}`}>{k.label}</button>
          ))}
        </div>

        {properties.length === 0 ? (
          <EmptyState title="No listings yet" description="Be the first to list a property in this category." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {properties.map((p) => (
              <div key={p.id} className="bg-card border rounded-2xl overflow-hidden shadow-card">
                <div className="relative aspect-[16/10] bg-muted">
                  {p.cover && <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />}
                  {p.featured && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-foreground text-[9px] font-bold uppercase">Featured</span>}
                  <span className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-background/95 backdrop-blur text-xs font-bold">
                    ${Number(p.price).toLocaleString()}
                    <span className="text-[10px] text-muted-foreground font-normal">{p.listing_type === "rent" || p.listing_type === "shared" ? `/${p.price_period}` : ""}</span>
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm leading-tight line-clamp-1">{p.title}</p>
                  {(p.city || p.country) && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {p.city}{p.country ? `, ${p.country}` : ""}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    {p.bedrooms != null && <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {p.bedrooms}</span>}
                    {p.baths != null && <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {p.baths}</span>}
                    {p.area_sqm && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" /> {p.area_sqm}m²</span>}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => setInquiryFor(p)} className="flex-1 h-8 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center justify-center gap-1">
                      <Mail className="w-3 h-3" /> {p.listing_type === "sale" ? "Inquire" : "Reserve"}
                    </button>
                    {p.contact_whatsapp && <a href={`https://wa.me/${p.contact_whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener" className="h-8 px-3 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1"><MessageCircle className="w-3 h-3" /></a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inquiryFor && (
        <PropertyInquiryDialog
          property={inquiryFor}
          open={!!inquiryFor}
          onOpenChange={(v) => !v && setInquiryFor(null)}
        />
      )}
    </div>
  );
}
