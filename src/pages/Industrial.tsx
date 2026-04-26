import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchIndustrial, fetchIndustrialItem } from "@/data/verticals";
import { ArrowLeft, Factory, Boxes, Truck, ShieldCheck, Briefcase, Zap, Clock, MapPin } from "lucide-react";
import { useState } from "react";

const CATS = [
  { id: "all", label: "All", icon: Factory },
  { id: "machinery", label: "Machinery", icon: Factory },
  { id: "materials", label: "Materials", icon: Boxes },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "finance", label: "Finance", icon: Briefcase },
  { id: "services", label: "Services", icon: ShieldCheck },
  { id: "equipment", label: "Equipment", icon: Zap },
];

export default function Industrial() {
  const { id } = useParams();
  if (id) return <IndustrialDetail id={id} />;
  return <IndustrialIndex />;
}

function IndustrialIndex() {
  const [cat, setCat] = useState("all");
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["industrial", cat],
    queryFn: () => fetchIndustrial(cat === "all" ? {} : { category: cat }),
  });

  return (
    <div className="pb-10">
      {/* Blueprint hero */}
      <div className="mx-4 mt-3 rounded-3xl bg-sky-950 text-sky-50 p-6 relative overflow-hidden shadow-elevated">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(hsl(200 70% 80% / 0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(200 70% 80% / 0.15) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative">
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-sky-300">Department · Industrial</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight mt-1">
            The factory floor,<br />indexed.
          </h1>
          <p className="text-[12px] text-sky-200/80 mt-2 max-w-sm">
            Heavy machinery, raw materials, container logistics, trade finance, equipment leasing and B2B services — all one tap away.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-none">
        {CATS.map((c) => {
          const Icon = c.icon;
          const active = cat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`shrink-0 px-3 h-9 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition ${
                active
                  ? "bg-sky-950 text-sky-50"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground">Loading listings…</p>}

      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => {
          const specEntries = Object.entries(it.spec ?? {}).slice(0, 3);
          return (
            <Link key={it.id} to={`/industrial/${it.id}`} className="bg-card border rounded-xl shadow-card hover:shadow-elevated transition group overflow-hidden">
              <div className="relative aspect-[16/10] bg-muted">
                {it.cover && <img src={it.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-sky-950 text-sky-50 text-[9px] font-mono uppercase tracking-wider">
                  {it.category}{it.subcategory ? ` · ${it.subcategory}` : ""}
                </span>
              </div>
              <div className="p-3">
                <p className="text-[13px] font-bold leading-tight line-clamp-2">{it.title}</p>
                <div className="mt-2 space-y-0.5">
                  {specEntries.map(([k, v]) => (
                    <p key={k} className="text-[10px] text-muted-foreground font-mono line-clamp-1">
                      <span className="opacity-60 uppercase tracking-wider">{k}</span>: <span className="text-foreground">{String(v)}</span>
                    </p>
                  ))}
                </div>
                {it.certifications.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {it.certifications.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded-sm bg-sky-100 text-sky-900 text-[9px] font-mono font-bold uppercase">{c}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <p className="text-base font-black tabular-nums">
                    {it.price != null ? `$${it.price.toLocaleString()}` : "Quote"}
                    {it.unit && <span className="text-[10px] text-muted-foreground font-normal"> /{it.unit}</span>}
                  </p>
                  <div className="text-right text-[9px] text-muted-foreground space-y-0.5">
                    {it.lead_time && <p className="flex items-center gap-1 justify-end"><Clock className="w-2.5 h-2.5" />{it.lead_time}</p>}
                    {it.country && <p className="flex items-center gap-1 justify-end"><MapPin className="w-2.5 h-2.5" />{it.country}</p>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function IndustrialDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: it, isLoading } = useQuery({ queryKey: ["industrial-item", id], queryFn: () => fetchIndustrialItem(id) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!it) return <p className="px-4 py-12 text-center text-sm">Listing not found.</p>;

  return (
    <div className="pb-32">
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
          <Link to="/rfq" className="h-11 px-5 rounded-full bg-sky-950 text-sky-50 text-sm font-bold flex items-center">
            Request quote
          </Link>
        </div>
      </div>
    </div>
  );
}
