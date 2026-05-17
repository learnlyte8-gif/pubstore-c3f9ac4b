import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAgro } from "@/data/verticals";
import { Sprout, Tractor, Droplets, Egg, Leaf, TrendingUp, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  produce: Leaf,
  equipment: Tractor,
  inputs: Droplets,
  livestock: Egg,
  services: Sprout,
  project: TrendingUp,
};

export default function AgroRail() {
  const { data: items = [] } = useQuery({ queryKey: ["home-agro"], queryFn: () => fetchAgro({ limit: 8 }) });
  if (items.length === 0) return null;
  return (
    <section className="mt-7 px-4 animate-fade-in">
      {/* Field header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-lime-700 text-emerald-50 p-4 relative overflow-hidden shadow-elevated">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(hsl(80 70% 70% / 0.45) 1px, transparent 1.5px)",
            backgroundSize: "14px 14px",
          }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-lime-200">Department · Agro</p>
            <h2 className="text-[22px] font-bold leading-tight mt-1 tracking-tight">
              From farm to factory.
            </h2>
            <p className="text-[11px] text-emerald-100/80 mt-0.5">Produce · inputs · machinery · projects.</p>
          </div>
          <Link to="/agro" className="text-[11px] font-bold uppercase tracking-wider border border-lime-200/40 px-2.5 py-1 rounded-md hover:bg-lime-200/10">
            Browse all →
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {items.slice(0, 6).map((it) => {
          const Icon = ICONS[it.kind] ?? Sprout;
          const specEntries = Object.entries(it.spec ?? {}).slice(0, 2);
          const isProject = it.kind === "project";
          const fundingPct = isProject && it.funding_goal
            ? Math.min(100, Math.round(((it.funding_raised ?? 0) / it.funding_goal) * 100))
            : 0;
          return (
            <Link key={it.id} to={`/agro/${it.id}`} className="bg-card rounded-xl border shadow-card p-2.5 hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted mb-2">
                {it.cover && <img src={it.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md bg-emerald-900 text-emerald-50 flex items-center justify-center">
                  <Icon className="w-3 h-3" />
                </span>
                {it.organic && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-lime-400 text-emerald-950 text-[8px] font-mono font-bold uppercase">
                    Organic
                  </span>
                )}
                {it.certifications.length > 0 && !it.organic && (
                  <span className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1">
                    {it.certifications.slice(0, 2).map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-background/90 backdrop-blur text-[8px] font-mono font-bold uppercase">
                        {c}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                {it.kind}{it.subcategory ? ` · ${it.subcategory}` : ""}
              </p>
              <p className="text-[12px] font-bold leading-tight line-clamp-2 mt-0.5">{it.title}</p>
              {!isProject && (
                <div className="mt-1.5 space-y-0.5">
                  {specEntries.map(([k, v]) => (
                    <p key={k} className="text-[9px] text-muted-foreground line-clamp-1 font-mono">
                      <span className="opacity-60">{k}:</span> {String(v)}
                    </p>
                  ))}
                </div>
              )}
              {isProject && it.funding_goal ? (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${fundingPct}%` }} />
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground mt-1">
                    {fundingPct}% funded · ${(it.funding_goal / 1000).toFixed(0)}k goal
                  </p>
                </div>
              ) : (
                <div className="mt-1.5 flex items-baseline justify-between">
                  <p className="text-[12px] font-black tabular-nums">
                    {it.price != null ? `$${it.price.toLocaleString()}` : "Quote"}
                    {it.unit && <span className="text-[9px] text-muted-foreground font-normal"> /{it.unit}</span>}
                  </p>
                  {it.harvest_season && <p className="text-[9px] text-muted-foreground line-clamp-1">{it.harvest_season}</p>}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
