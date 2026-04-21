import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  X,
  ShieldCheck,
  Award,
  Star,
  Clock,
  Truck,
  Calendar,
  MessageCircle,
  Check,
  Minus,
  Search,
} from "lucide-react";
import { type Supplier } from "@/data/products";
import { useSuppliers } from "@/hooks/useCatalog";

const MAX = 3;

export default function Compare() {
  const navigate = useNavigate();
  const { data: ALL = [], isLoading } = useSuppliers({ limit: 100 });
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");

  // Seed with the first two suppliers once data arrives
  if (selected.length === 0 && ALL.length >= 2 && !isLoading) {
    // defer to next tick to avoid setState-in-render warning
    queueMicrotask(() => setSelected([ALL[0].id, ALL[1].id]));
  }

  const suppliers = useMemo(
    () => selected.map((id) => ALL.find((s) => s.id === id)).filter(Boolean) as Supplier[],
    [selected, ALL]
  );

  const available = ALL.filter(
    (s) =>
      !selected.includes(s.id) &&
      (!query || s.name.toLowerCase().includes(query.toLowerCase()) || (s.country ?? "").toLowerCase().includes(query.toLowerCase()))
  );

  const remove = (id: string) => setSelected((arr) => arr.filter((x) => x !== id));
  const add = (id: string) => {
    if (selected.length >= MAX) return;
    setSelected((arr) => [...arr, id]);
    setPicker(false);
    setQuery("");
  };

  // Best-value highlights per row
  const bestRating = Math.max(...suppliers.map((s) => s.rating), 0);
  const bestResp = Math.max(...suppliers.map((s) => s.responseRate), 0);
  const bestOnTime = Math.max(...suppliers.map((s) => s.onTimeDelivery), 0);
  const bestYears = Math.max(...suppliers.map((s) => s.yearsActive), 0);

  return (
    <div className="pb-10">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft sticky top-0 z-10 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Compare suppliers</p>
          <p className="text-[10px] text-muted-foreground">
            {suppliers.length}/{MAX} selected
          </p>
        </div>
      </div>

      {suppliers.length < 2 ? (
        <div className="px-4 mt-6 text-center">
          <p className="text-sm text-muted-foreground">Add at least 2 suppliers to compare.</p>
          <button
            onClick={() => setPicker(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-card"
          >
            <Plus className="w-4 h-4" /> Add supplier
          </button>
        </div>
      ) : (
        <>
          {/* Header row */}
          <div className="px-3 mt-4">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `90px repeat(${suppliers.length}, minmax(0,1fr))${selected.length < MAX ? " 64px" : ""}` }}
            >
              <div />
              {suppliers.map((s) => (
                <div key={s.id} className="rounded-2xl bg-card border border-border shadow-card p-2.5 relative">
                  <button
                    onClick={() => remove(s.id)}
                    aria-label="Remove"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center shadow-card"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <Link to={`/supplier/${s.id}`} className="flex flex-col items-center text-center">
                    <img src={s.logo} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    <p className="text-[11px] font-bold leading-tight mt-1.5 line-clamp-2">{s.name}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.country}</p>
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                      {s.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">
                          <ShieldCheck className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                      {s.gold && (
                        <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold text-amber-600 bg-amber-500/15 px-1 py-0.5 rounded">
                          <Award className="w-2.5 h-2.5" /> Gold
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
              {selected.length < MAX && (
                <button
                  onClick={() => setPicker(true)}
                  className="rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 transition py-4"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[9px] font-semibold mt-0.5">Add</span>
                </button>
              )}
            </div>
          </div>

          {/* Comparison rows */}
          <div className="px-3 mt-4 space-y-2">
            <Row
              label="Rating"
              icon={Star}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue best={s.rating === bestRating}>
                  <span className="font-bold">{s.rating.toFixed(1)}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </RowValue>
              )}
            />
            <Row
              label="Response"
              icon={Clock}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue best={s.responseRate === bestResp}>
                  <span className="font-bold">{s.responseRate}%</span>
                  <span className="text-[9px] text-muted-foreground">{s.responseTime}</span>
                </RowValue>
              )}
            />
            <Row
              label="On-time"
              icon={Truck}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue best={s.onTimeDelivery === bestOnTime}>
                  <span className="font-bold">{s.onTimeDelivery}%</span>
                </RowValue>
              )}
            />
            <Row
              label="Years"
              icon={Calendar}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue best={s.yearsActive === bestYears}>
                  <span className="font-bold">{s.yearsActive}y</span>
                </RowValue>
              )}
            />
            <Row
              label="Trade Assured"
              icon={ShieldCheck}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue>
                  {s.tradeAssurance ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </RowValue>
              )}
            />
            <Row
              label="Gold member"
              icon={Award}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue>
                  {s.gold ? (
                    <Check className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </RowValue>
              )}
            />
            <Row
              label="Products"
              icon={Star}
              suppliers={suppliers}
              cols={selected.length < MAX}
              render={(s) => (
                <RowValue>
                  <span className="font-bold">{getProductsBySupplier(s.id).length}</span>
                </RowValue>
              )}
            />
          </div>

          {/* About blurbs */}
          <div className="px-3 mt-4">
            <p className="text-xs font-bold mb-2 px-1">About</p>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${suppliers.length}, minmax(0,1fr))` }}
            >
              {suppliers.map((s) => (
                <div key={s.id} className="rounded-2xl bg-card border border-border shadow-card p-2.5">
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-6">
                    {s.about}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-3 mt-4">
            <p className="text-xs font-bold mb-2 px-1">Take action</p>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${suppliers.length}, minmax(0,1fr))` }}
            >
              {suppliers.map((s) => (
                <Link
                  key={s.id}
                  to="/messages"
                  className="h-9 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center gap-1 shadow-card"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Chat
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Picker drawer */}
      {picker && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end" onClick={() => setPicker(false)}>
          <div
            className="w-full max-w-2xl mx-auto bg-background rounded-t-3xl shadow-elevated max-h-[80dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3 pb-2 border-b border-border">
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search suppliers..."
                  className="flex-1 bg-transparent text-sm outline-none py-2"
                />
              </div>
            </div>
            <ul className="overflow-y-auto p-2 space-y-1">
              {available.length === 0 ? (
                <li className="text-center text-xs text-muted-foreground py-8">No suppliers found.</li>
              ) : (
                available.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => add(s.id)}
                      className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted transition"
                    >
                      <img src={s.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate flex items-center gap-1">
                          {s.name}
                          {s.verified && <ShieldCheck className="w-3 h-3 text-primary" />}
                          {s.gold && <Award className="w-3 h-3 text-amber-600" />}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.country} · {s.rating.toFixed(1)}★ · {s.yearsActive}y
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  icon: Icon,
  suppliers,
  render,
  cols,
}: {
  label: string;
  icon: typeof Star;
  suppliers: Supplier[];
  render: (s: Supplier) => React.ReactNode;
  cols: boolean;
}) {
  return (
    <div
      className="grid gap-2 items-stretch"
      style={{ gridTemplateColumns: `90px repeat(${suppliers.length}, minmax(0,1fr))${cols ? " 64px" : ""}` }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground px-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      {suppliers.map((s) => (
        <div
          key={s.id}
          className="rounded-xl bg-card border border-border shadow-soft py-2 px-1.5 flex items-center justify-center"
        >
          {render(s)}
        </div>
      ))}
      {cols && <div />}
    </div>
  );
}

function RowValue({ children, best }: { children: React.ReactNode; best?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1 text-[11px] ${
        best ? "text-emerald-600 dark:text-emerald-400" : ""
      }`}
    >
      {children}
    </div>
  );
}
