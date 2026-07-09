import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAgro, fetchAgroItem } from "@/data/verticals";
import { ArrowLeft, Sprout, Tractor, Droplets, Leaf, Egg, TrendingUp, Clock, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import QuoteRequestDialog from "@/components/marketplace/QuoteRequestDialog";
import SaveHeart from "@/components/marketplace/SaveHeart";
import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";

const BNB_AGRO_CATS = [
  { slug: "all", label: "All", icon: Sprout },
  { slug: "produce", label: "Produce", icon: Leaf },
  { slug: "equipment", label: "Machinery", icon: Tractor },
  { slug: "inputs", label: "Inputs", icon: Droplets },
  { slug: "livestock", label: "Livestock", icon: Egg },
  { slug: "services", label: "Services", icon: ShieldCheck },
  { slug: "project", label: "Projects", icon: TrendingUp },
];

export default function Agro() {
  const { id } = useParams();
  if (id) return <AgroDetail id={id} />;
  return <AgroIndex />;
}

function AgroIndex() {
  return (
    <BnbVerticalScreen
      queryKey={["bnb-agro"]}
      fetcher={(cat) => fetchAgro(cat === "all" ? {} : { kind: cat })}
      categories={BNB_AGRO_CATS}
      units="quantity"
      saveKind="agro"
      wherePlaceholder="Search produce, farms, regions"
      emptyLabel="No agro listings match"
      toListing={(a) => ({
        id: a.id,
        title: a.title,
        location: [a.region, a.country].filter(Boolean).join(", ") || null,
        subtitle: a.subcategory ?? undefined,
        images: [a.cover, ...(a.gallery ?? [])].filter(Boolean) as string[],
        price: a.price ?? undefined,
        priceUnit: a.unit ?? undefined,
        badge: a.organic ? "Organic" : a.featured ? "Featured" : null,
        href: `/agro/${a.id}`,
      })}
    />
  );
}


function AgroDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: it, isLoading } = useQuery({ queryKey: ["agro-item", id], queryFn: () => fetchAgroItem(id) });
  const [rfqOpen, setRfqOpen] = useState(false);

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
  if (!it) return <p className="px-4 py-12 text-center text-sm">Listing not found.</p>;

  const isProject = it.kind === "project";
  const pct = isProject && it.funding_goal ? Math.min(100, Math.round(((it.funding_raised ?? 0) / it.funding_goal) * 100)) : 0;

  return (
    <div className=" animate-fade-in">
      <div className="relative h-72 bg-muted">
        {it.cover && <img src={it.cover} alt={it.title} className="w-full h-full object-cover" />}
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center shadow">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="absolute top-3 right-14 px-2 py-1 rounded-sm bg-emerald-900 text-emerald-50 text-[10px] font-mono uppercase tracking-wider">
          {it.kind}
        </span>
        <SaveHeart
          kind="agro"
          itemId={it.id}
          snapshot={{ title: it.title, image: it.cover, href: `/agro/${it.id}` }}
          className="absolute top-3 right-3 w-9 h-9"
          size={16}
        />
        {it.organic && (
          <span className="absolute bottom-3 right-3 px-2 py-1 rounded-sm bg-lime-400 text-emerald-950 text-[10px] font-mono font-bold uppercase">
            Organic
          </span>
        )}
      </div>

      <div className="px-5 mt-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          {it.kind}{it.subcategory ? ` · ${it.subcategory}` : ""}{it.country ? ` · ${it.country}` : ""}
        </p>
        <h1 className="text-2xl font-bold leading-tight mt-1 tracking-tight">{it.title}</h1>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {it.certifications.map((c) => (
            <span key={c} className="px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-900 text-[10px] font-mono font-bold uppercase">{c}</span>
          ))}
        </div>

        {isProject && it.funding_goal && (
          <div className="mt-5 bg-gradient-to-br from-emerald-900 to-lime-700 text-emerald-50 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-lime-200">Funding progress</p>
            <p className="text-3xl font-black mt-1 tabular-nums">{pct}%</p>
            <div className="mt-2 h-2 rounded-full bg-emerald-950/40 overflow-hidden">
              <div className="h-full bg-lime-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] mt-2 font-mono text-emerald-100/80">
              ${(it.funding_raised ?? 0).toLocaleString()} raised of ${(it.funding_goal).toLocaleString()} goal
            </p>
          </div>
        )}

        <div className="mt-5 bg-emerald-950 text-emerald-50 rounded-2xl p-4 relative overflow-hidden">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(it.spec ?? {}).map(([k, v]) => (
              <div key={k}>
                <p className="text-[8px] uppercase tracking-[0.22em] text-lime-300 font-mono">{k}</p>
                <p className="text-sm font-bold mt-0.5">{String(v)}</p>
              </div>
            ))}
            {it.harvest_season && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-lime-300 font-mono">Harvest</p>
                <p className="text-sm font-bold mt-0.5">{it.harvest_season}</p>
              </div>
            )}
            {it.lead_time && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-lime-300 font-mono">Lead time</p>
                <p className="text-sm font-bold mt-0.5">{it.lead_time}</p>
              </div>
            )}
            {it.capacity && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-lime-300 font-mono">Capacity</p>
                <p className="text-sm font-bold mt-0.5">{it.capacity}</p>
              </div>
            )}
            {it.moq && (
              <div>
                <p className="text-[8px] uppercase tracking-[0.22em] text-lime-300 font-mono">MOQ</p>
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
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {isProject ? "Ticket from" : "Indicative"}
            </p>
            <p className="font-black text-lg leading-none tabular-nums">
              {it.price != null ? `$${it.price.toLocaleString()}` : isProject ? "Co-invest" : "Request quote"}
              {it.unit && it.price != null && <span className="text-[10px] font-normal text-muted-foreground"> /{it.unit}</span>}
            </p>
          </div>
          <button onClick={() => setRfqOpen(true)} className="h-11 px-5 rounded-full bg-emerald-900 text-emerald-50 text-sm font-bold flex items-center">
            {isProject ? "Pledge" : "Request quote"}
          </button>
        </div>
      </div>

      <QuoteRequestDialog
        open={rfqOpen}
        onOpenChange={setRfqOpen}
        kind="agro"
        subject={{ id: it.id, title: it.title, category: it.kind, unit: it.unit, moq: it.moq, isProject }}
      />
    </div>
  );
}
