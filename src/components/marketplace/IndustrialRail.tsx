import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchIndustrial } from "@/data/verticals";
import { Factory, ShieldCheck, Truck, Boxes } from "lucide-react";

const ICONS: Record<string, typeof Factory> = {
  machinery: Factory, materials: Boxes, logistics: Truck, finance: ShieldCheck, services: ShieldCheck, equipment: Factory,
};

export default function IndustrialRail() {
  const { data: items = [] } = useQuery({ queryKey: ["home-industrial"], queryFn: () => fetchIndustrial({ limit: 8 }) });
  if (items.length === 0) return null;
  return (
    <section className="mt-7 px-4">
      {/* Blueprint header */}
      <div className="rounded-2xl bg-sky-950 text-sky-50 p-4 relative overflow-hidden shadow-elevated">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(hsl(200 70% 80% / 0.12) 1px, transparent 1px), linear-gradient(90deg, hsl(200 70% 80% / 0.12) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-sky-300">Department · Industrial</p>
            <h2 className="text-[22px] font-bold leading-tight mt-1 tracking-tight">
              Heavy industry, on tap.
            </h2>
            <p className="text-[11px] text-sky-200/80 mt-0.5">Machinery · materials · logistics · finance.</p>
          </div>
          <Link to="/industrial" className="text-[11px] font-bold uppercase tracking-wider border border-sky-300/40 px-2.5 py-1 rounded-md hover:bg-sky-300/10">
            All listings →
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {items.slice(0, 6).map((it) => {
          const Icon = ICONS[it.category] ?? Factory;
          const specEntries = Object.entries(it.spec ?? {}).slice(0, 2);
          return (
            <Link key={it.id} to={`/industrial/${it.id}`} className="bg-card rounded-xl border shadow-card p-2.5 hover:shadow-elevated transition group">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted mb-2">
                {it.cover && <img src={it.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md bg-sky-950 text-sky-50 flex items-center justify-center">
                  <Icon className="w-3 h-3" />
                </span>
                {it.certifications.length > 0 && (
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
                {it.category}{it.subcategory ? ` · ${it.subcategory}` : ""}
              </p>
              <p className="text-[12px] font-bold leading-tight line-clamp-2 mt-0.5">{it.title}</p>
              <div className="mt-1.5 space-y-0.5">
                {specEntries.map(([k, v]) => (
                  <p key={k} className="text-[9px] text-muted-foreground line-clamp-1 font-mono">
                    <span className="opacity-60">{k}:</span> {String(v)}
                  </p>
                ))}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className="text-[12px] font-black tabular-nums">
                  {it.price != null ? `$${it.price.toLocaleString()}` : "Quote"}
                  {it.unit && <span className="text-[9px] text-muted-foreground font-normal"> /{it.unit}</span>}
                </p>
                {it.lead_time && <p className="text-[9px] text-muted-foreground">{it.lead_time}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
