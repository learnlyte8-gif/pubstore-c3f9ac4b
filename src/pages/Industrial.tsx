import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchIndustrial, fetchIndustrialItem } from "@/data/verticals";
import { ArrowLeft, Factory, Boxes, Truck, ShieldCheck, Briefcase, Zap, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import QuoteRequestDialog from "@/components/marketplace/QuoteRequestDialog";
import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";

const BNB_INDUSTRIAL_CATS = [
  { slug: "all", label: "All", icon: Factory },
  { slug: "machinery", label: "Machinery", icon: Factory },
  { slug: "materials", label: "Materials", icon: Boxes },
  { slug: "logistics", label: "Logistics", icon: Truck },
  { slug: "finance", label: "Finance", icon: Briefcase },
  { slug: "services", label: "Services", icon: ShieldCheck },
  { slug: "equipment", label: "Equipment", icon: Zap },
];

export default function Industrial() {
  const { id } = useParams();
  if (id) return <IndustrialDetail id={id} />;
  return <IndustrialIndex />;
}

function IndustrialIndex() {
  return (
    <BnbVerticalScreen
      queryKey={["bnb-industrial"]}
      fetcher={(cat) => fetchIndustrial(cat === "all" ? {} : { category: cat })}
      categories={BNB_INDUSTRIAL_CATS}
      units="quantity"
      saveKind="industrial"
      wherePlaceholder="Search suppliers, materials, machines"
      emptyLabel="No industrial listings match"
      toListing={(it) => ({
        id: it.id,
        title: it.title,
        location: [it.ship_from, it.country].filter(Boolean).join(", ") || null,
        subtitle: it.subcategory ?? undefined,
        images: [it.cover, ...(it.gallery ?? [])].filter(Boolean) as string[],
        price: it.price ?? undefined,
        priceUnit: it.unit ?? undefined,
        badge: it.certifications?.length ? "Certified" : null,
        href: `/industrial/${it.id}`,
      })}
    />
  );
}


function IndustrialDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: it, isLoading } = useQuery({ queryKey: ["industrial-item", id], queryFn: () => fetchIndustrialItem(id) });
  const [rfqOpen, setRfqOpen] = useState(false);

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
  if (!it) return <p className="px-4 py-12 text-center text-sm">Listing not found.</p>;

  return (
    <div className=" animate-fade-in">
      <div className="relative h-72 bg-muted">
        {it.cover && <img src={it.cover} alt={it.title} className="w-full h-full object-cover" />}
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center shadow">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-sm bg-sky-950 text-sky-50 text-[10px] font-mono uppercase tracking-wider">
          {it.category}
        </span>
      </div>

      <div className="px-5 mt-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {it.category}{it.subcategory ? ` · ${it.subcategory}` : ""} · {it.country}
        </p>
        <h1 className="text-2xl font-bold leading-tight mt-1 tracking-tight">{it.title}</h1>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {it.certifications.map((c) => (
            <span key={c} className="px-2 py-0.5 rounded-sm bg-sky-100 text-sky-900 text-[10px] font-mono font-bold uppercase">{c}</span>
          ))}
        </div>

        <div className="mt-5 bg-sky-950 text-sky-50 rounded-2xl p-4 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(hsl(200 70% 80% / 0.18) 1px, transparent 1px), linear-gradient(90deg, hsl(200 70% 80% / 0.18) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
          <div className="relative grid grid-cols-2 gap-3">
            {Object.entries(it.spec ?? {}).map(([k, v]) => (
              <div key={k}>
                <p className="text-[8px] uppercase tracking-[0.22em] text-sky-300 font-mono">{k}</p>
                <p className="text-sm font-bold mt-0.5">{String(v)}</p>
              </div>
            ))}
            {it.lead_time && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-sky-300 font-mono">Lead time</p>
                <p className="text-sm font-bold mt-0.5">{it.lead_time}</p>
              </div>
            )}
            {it.capacity && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-sky-300 font-mono">Capacity</p>
                <p className="text-sm font-bold mt-0.5">{it.capacity}</p>
              </div>
            )}
            {it.moq && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-sky-300 font-mono">MOQ</p>
                <p className="text-sm font-bold mt-0.5">{it.moq} {it.unit}</p>
              </div>
            )}
          </div>
        </div>

        {it.description && <p className="mt-5 text-sm leading-relaxed text-foreground/90">{it.description}</p>}
      </div>

      <div className="fixed bottom-16 inset-x-0 z-20 px-3">
        <div className="max-w-md mx-auto bg-card border shadow-elevated rounded-2xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Indicative</p>
            <p className="font-black text-lg leading-none tabular-nums">
              {it.price != null ? `$${it.price.toLocaleString()}` : "Request quote"}
              {it.unit && it.price != null && <span className="text-[10px] font-normal text-muted-foreground"> /{it.unit}</span>}
            </p>
          </div>
          <button onClick={() => setRfqOpen(true)} className="h-11 px-5 rounded-full bg-sky-950 text-sky-50 text-sm font-bold flex items-center">
            Request quote
          </button>
        </div>
      </div>

      <QuoteRequestDialog
        open={rfqOpen}
        onOpenChange={setRfqOpen}
        kind="industrial"
        subject={{ id: it.id, title: it.title, category: it.category, unit: it.unit, moq: it.moq }}
      />
    </div>
  );
}
