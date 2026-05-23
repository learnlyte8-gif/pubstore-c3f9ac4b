import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAgro, fetchAgroItem } from "@/data/verticals";
import { ArrowLeft, Sprout, Tractor, Droplets, Leaf, Egg, TrendingUp, Clock, MapPin, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar, FilterField, SortPills } from "@/components/marketplace/FilterBar";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import SaveHeart from "@/components/marketplace/SaveHeart";
import CircleSpinner from "@/components/CircleSpinner";
import QuoteRequestDialog from "@/components/marketplace/QuoteRequestDialog";

const KINDS = [
  { id: "all", label: "All", icon: Sprout },
  { id: "produce", label: "Produce", icon: Leaf },
  { id: "equipment", label: "Machinery", icon: Tractor },
  { id: "inputs", label: "Inputs", icon: Droplets },
  { id: "livestock", label: "Livestock", icon: Egg },
  { id: "services", label: "Services", icon: ShieldCheck },
  { id: "project", label: "Projects", icon: TrendingUp },
];

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "moq_low", label: "Lowest MOQ" },
];

export default function Agro() {
  const { id } = useParams();
  if (id) return <AgroDetail id={id} />;
  return <AgroIndex />;
}

function AgroIndex() {
  const { values, update, reset } = useUrlFilters({
    q: "",
    cat: "all",
    sort: "newest",
    maxPrice: "",
    organic: "",
    certified: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agro", values.cat],
    queryFn: () => fetchAgro(values.cat === "all" ? {} : { kind: values.cat }),
  });

  const priceMax = useMemo(
    () => Math.max(1000, Math.ceil((items.reduce((m, it) => Math.max(m, it.price ?? 0), 0) || 20000) / 1000) * 1000),
    [items],
  );

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const cap = values.maxPrice ? Number(values.maxPrice) : 0;
    let list = items.filter((it) => {
      if (cap > 0 && (it.price ?? Infinity) > cap) return false;
      if (values.organic === "1" && !it.organic) return false;
      if (values.certified === "1" && it.certifications.length === 0) return false;
      if (!q) return true;
      const specStr = Object.entries(it.spec ?? {}).map(([k, v]) => `${k} ${v}`).join(" ");
      const hay = `${it.title} ${it.subcategory ?? ""} ${it.country ?? ""} ${it.region ?? ""} ${it.certifications.join(" ")} ${specStr}`.toLowerCase();
      return hay.includes(q);
    });
    list = [...list].sort((a, b) => {
      if (values.sort === "price_asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (values.sort === "price_desc") return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      if (values.sort === "moq_low") return (a.moq ?? Infinity) - (b.moq ?? Infinity);
      return 0;
    });
    return list;
  }, [items, values]);

  const advancedCount =
    (values.sort !== "newest" ? 1 : 0) + (values.maxPrice ? 1 : 0) + (values.organic === "1" ? 1 : 0) + (values.certified === "1" ? 1 : 0);
  const anyActive = !!values.q || values.cat !== "all" || advancedCount > 0;

  const projects = filtered.filter((i) => i.kind === "project");
  const nonProjects = filtered.filter((i) => i.kind !== "project");

  return (
    <div className="pb-10">
      {/* Field hero */}
      <div className="mx-4 mt-3 rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-lime-700 text-emerald-50 p-6 relative overflow-hidden shadow-elevated">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: "radial-gradient(hsl(80 70% 70% / 0.45) 1px, transparent 1.5px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative">
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-lime-200">Department · Agro</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight mt-1">
            Farm to factory,<br />co-investible.
          </h1>
          <p className="text-[12px] text-emerald-100/80 mt-2 max-w-sm">
            Bulk produce, livestock, machinery, irrigation, fertilizer and seed — plus vetted agri-projects you can co-fund.
          </p>
        </div>
      </div>

      <FilterBar
        tone="light"
        search={values.q}
        onSearchChange={(q) => update({ q })}
        searchPlaceholder="Search crop, breed, region, certification…"
        chips={KINDS}
        chipValue={values.cat}
        onChipChange={(cat) => update({ cat })}
        canReset={anyActive}
        onReset={reset}
        activeAdvancedCount={advancedCount}
        trailing={`${filtered.length} ${filtered.length === 1 ? "listing" : "listings"}`}
        advanced={
          <div className="space-y-3">
            <FilterField label="Sort by">
              <SortPills value={values.sort} onChange={(v) => update({ sort: v })} options={SORTS} />
            </FilterField>
            <FilterField label={`Max price${values.maxPrice ? ` · $${Number(values.maxPrice).toLocaleString()}` : ""}`}>
              <Slider
                min={0}
                max={priceMax}
                step={500}
                value={[values.maxPrice ? Number(values.maxPrice) : 0]}
                onValueChange={([v]) => update({ maxPrice: v ? String(v) : "" })}
              />
              <p className="text-[10px] text-muted-foreground">0 = any · up to ${priceMax.toLocaleString()}</p>
            </FilterField>
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
              <Checkbox checked={values.organic === "1"} onCheckedChange={(c) => update({ organic: c ? "1" : "" })} />
              Organic only
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
              <Checkbox checked={values.certified === "1"} onCheckedChange={(c) => update({ certified: c ? "1" : "" })} />
              Certified suppliers only
            </label>
          </div>
        }
      />

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground">Loading listings…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="px-4 mt-10 text-center">
          <Sprout className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">No listings match.</p>
          <button onClick={reset} className="mt-1 text-xs text-primary font-bold">Reset filters</button>
        </div>
      )}

      {projects.length > 0 && (values.cat === "all" || values.cat === "project") && (
        <section className="px-4 mt-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Open agri-projects</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => {
              const pct = p.funding_goal ? Math.min(100, Math.round(((p.funding_raised ?? 0) / p.funding_goal) * 100)) : 0;
              const irr = (p.spec as any)?.irr;
              const tenor = (p.spec as any)?.tenor;
              return (
                <Link key={p.id} to={`/agro/${p.id}`} className="bg-card border rounded-xl shadow-card hover:shadow-elevated transition group overflow-hidden">
                  <div className="relative aspect-[16/10] bg-muted">
                    {p.cover && <img src={p.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-emerald-900 text-emerald-50 text-[9px] font-mono uppercase tracking-wider">
                      Project · {p.subcategory}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-[13px] font-bold leading-tight line-clamp-2">{p.title}</p>
                    <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-600 to-lime-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono">
                      <span className="font-bold">{pct}% funded</span>
                      <span className="text-muted-foreground">${(p.funding_raised ?? 0).toLocaleString()} / ${(p.funding_goal ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                      {irr && <span>IRR <span className="text-foreground font-bold">{String(irr)}</span></span>}
                      {tenor && <span>Tenor <span className="text-foreground font-bold">{String(tenor)}</span></span>}
                      {p.country && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{p.country}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="px-4 mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nonProjects.map((it, i) => {
          const specEntries = Object.entries(it.spec ?? {}).slice(0, 3);
          return (
            <Link
              key={it.id}
              to={`/agro/${it.id}`}
              className="bg-card border rounded-xl shadow-card hover:shadow-elevated transition group overflow-hidden animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: "backwards" }}
            >
              <div className="relative aspect-[16/10] bg-muted">
                {it.cover && <img src={it.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-emerald-900 text-emerald-50 text-[9px] font-mono uppercase tracking-wider">
                  {it.kind}{it.subcategory ? ` · ${it.subcategory}` : ""}
                </span>
                {it.organic && (
                  <span className="absolute top-2 right-10 px-2 py-0.5 rounded-sm bg-lime-400 text-emerald-950 text-[9px] font-mono font-bold uppercase">
                    Organic
                  </span>
                )}
                <SaveHeart
                  kind="agro"
                  itemId={it.id}
                  snapshot={{ title: it.title, image: it.cover, href: `/agro/${it.id}` }}
                  className="absolute top-1.5 right-1.5 w-7 h-7"
                />
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
                      <span key={c} className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-900 text-[9px] font-mono font-bold uppercase">{c}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <p className="text-base font-black tabular-nums">
                    {it.price != null ? `$${it.price.toLocaleString()}` : "Quote"}
                    {it.unit && <span className="text-[10px] text-muted-foreground font-normal"> /{it.unit}</span>}
                  </p>
                  <div className="text-right text-[9px] text-muted-foreground space-y-0.5">
                    {it.harvest_season && <p className="flex items-center gap-1 justify-end"><Clock className="w-2.5 h-2.5" />{it.harvest_season}</p>}
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

function AgroDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: it, isLoading } = useQuery({ queryKey: ["agro-item", id], queryFn: () => fetchAgroItem(id) });

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
  if (!it) return <p className="px-4 py-12 text-center text-sm">Listing not found.</p>;

  const isProject = it.kind === "project";
  const pct = isProject && it.funding_goal ? Math.min(100, Math.round(((it.funding_raised ?? 0) / it.funding_goal) * 100)) : 0;

  return (
    <div className="pb-32 animate-fade-in">
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
          <Link to="/rfq" className="h-11 px-5 rounded-full bg-emerald-900 text-emerald-50 text-sm font-bold flex items-center">
            {isProject ? "Pledge" : "Request quote"}
          </Link>
        </div>
      </div>
    </div>
  );
}
