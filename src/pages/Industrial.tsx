import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchIndustrial, fetchIndustrialItem } from "@/data/verticals";
import { ArrowLeft, Factory, Boxes, Truck, ShieldCheck, Briefcase, Zap, Clock, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { FilterBar, FilterField, SortPills } from "@/components/marketplace/FilterBar";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import CircleSpinner from "@/components/CircleSpinner";
import QuoteRequestDialog from "@/components/marketplace/QuoteRequestDialog";

const CATS = [
  { id: "all", label: "All", icon: Factory },
  { id: "machinery", label: "Machinery", icon: Factory },
  { id: "materials", label: "Materials", icon: Boxes },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "finance", label: "Finance", icon: Briefcase },
  { id: "services", label: "Services", icon: ShieldCheck },
  { id: "equipment", label: "Equipment", icon: Zap },
];

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "moq_low", label: "Lowest MOQ" },
];

export default function Industrial() {
  const { id } = useParams();
  if (id) return <IndustrialDetail id={id} />;
  return <IndustrialIndex />;
}

function IndustrialIndex() {
  const { values, update, reset } = useUrlFilters({
    q: "",
    cat: "all",
    sort: "newest",
    maxPrice: "",
    certified: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["industrial", values.cat],
    queryFn: () => fetchIndustrial(values.cat === "all" ? {} : { category: values.cat }),
  });

  const priceMax = useMemo(
    () => Math.max(1000, Math.ceil((items.reduce((m, it) => Math.max(m, it.price ?? 0), 0) || 50000) / 1000) * 1000),
    [items],
  );

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const cap = values.maxPrice ? Number(values.maxPrice) : 0;
    let list = items.filter((it) => {
      if (cap > 0 && (it.price ?? Infinity) > cap) return false;
      if (values.certified === "1" && it.certifications.length === 0) return false;
      if (!q) return true;
      const specStr = Object.entries(it.spec ?? {}).map(([k, v]) => `${k} ${v}`).join(" ");
      const hay = `${it.title} ${it.subcategory ?? ""} ${it.country ?? ""} ${it.certifications.join(" ")} ${specStr}`.toLowerCase();
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
    (values.sort !== "newest" ? 1 : 0) + (values.maxPrice ? 1 : 0) + (values.certified === "1" ? 1 : 0);
  const anyActive = !!values.q || values.cat !== "all" || advancedCount > 0;

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

      <FilterBar
        tone="blueprint"
        search={values.q}
        onSearchChange={(q) => update({ q })}
        searchPlaceholder="Search spec, certification, origin…"
        chips={CATS}
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
              <Checkbox
                checked={values.certified === "1"}
                onCheckedChange={(c) => update({ certified: c ? "1" : "" })}
              />
              Certified suppliers only
            </label>
          </div>
        }
      />

      {isLoading && <p className="px-4 mt-8 text-center text-sm text-muted-foreground">Loading listings…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="px-4 mt-10 text-center">
          <Factory className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">No listings match.</p>
          <button onClick={reset} className="mt-1 text-xs text-primary font-bold">Reset filters</button>
        </div>
      )}

      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((it, i) => {
          const specEntries = Object.entries(it.spec ?? {}).slice(0, 3);
          return (
            <Link
              key={it.id}
              to={`/industrial/${it.id}`}
              className="bg-card border rounded-xl shadow-card hover:shadow-elevated transition group overflow-hidden animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: "backwards" }}
            >
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

  if (isLoading) return <p className="px-4 py-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
  if (!it) return <p className="px-4 py-12 text-center text-sm">Listing not found.</p>;

  return (
    <div className="pb-32 animate-fade-in">
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
