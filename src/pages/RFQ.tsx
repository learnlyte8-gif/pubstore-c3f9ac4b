import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Plus,
  Send,
  ShieldCheck,
  Clock,
  Inbox,
  Star,
  Package,
  Globe2,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, SUPPLIERS } from "@/data/products";

type Quote = {
  id: string;
  supplierId: string;
  pricePerUnit: number;
  leadTime: string;
  moq: number;
  notes: string;
};

type RFQ = {
  id: string;
  title: string;
  category: string;
  qty: number;
  unit: string;
  targetPrice: number;
  shipTo: string;
  details: string;
  date: string;
  status: "open" | "closed";
  quotes: Quote[];
};

const SEED: RFQ[] = [
  {
    id: "RFQ-2026-1042",
    title: "Custom branded power banks 10000mAh",
    category: "electronics",
    qty: 2000,
    unit: "piece",
    targetPrice: 6.5,
    shipTo: "Nairobi, Kenya",
    details: "Need PD 22.5W, custom logo print on top, gift box packaging.",
    date: "2026-04-15",
    status: "open",
    quotes: [
      {
        id: "q1",
        supplierId: "s1",
        pricePerUnit: 6.2,
        leadTime: "20 days",
        moq: 1000,
        notes: "Logo print included. Sample available in 5 days.",
      },
      {
        id: "q2",
        supplierId: "s3",
        pricePerUnit: 5.9,
        leadTime: "28 days",
        moq: 2000,
        notes: "Brown box only at this price; gift box +$0.40/unit.",
      },
    ],
  },
  {
    id: "RFQ-2026-0987",
    title: "Cotton tote bags with print",
    category: "fashion",
    qty: 5000,
    unit: "piece",
    targetPrice: 1.2,
    shipTo: "Lagos, Nigeria",
    details: "240 gsm cotton, single-color screen print, 2 sizes.",
    date: "2026-04-10",
    status: "open",
    quotes: [
      {
        id: "q1",
        supplierId: "s2",
        pricePerUnit: 1.35,
        leadTime: "22 days",
        moq: 3000,
        notes: "Includes print and folding. Sea freight quoted separately.",
      },
    ],
  },
];

export default function RFQ() {
  const [rfqs, setRfqs] = useState<RFQ[]>(SEED);
  const [tab, setTab] = useState<"inbox" | "new">("inbox");
  const [openId, setOpenId] = useState<string | null>(null);

  const open = openId ? rfqs.find((r) => r.id === openId) : null;
  if (open) return <RFQDetail rfq={open} onBack={() => setOpenId(null)} />;

  const handleSubmit = (rfq: Omit<RFQ, "id" | "date" | "status" | "quotes">) => {
    const newRfq: RFQ = {
      ...rfq,
      id: `RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      status: "open",
      quotes: [],
    };
    setRfqs([newRfq, ...rfqs]);
    toast.success("RFQ posted", { description: "Verified suppliers will respond shortly." });
    setTab("inbox");
  };

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-2 bg-card shadow-soft border-b border-border">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Request for Quotation
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Post once, get quotes from verified suppliers in 24h.
        </p>
        <div className="flex gap-1 mt-3 border-b border-border -mb-2">
          <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")}>
            <Inbox className="w-3.5 h-3.5 mr-1" />
            Inbox ({rfqs.length})
          </TabBtn>
          <TabBtn active={tab === "new"} onClick={() => setTab("new")}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New RFQ
          </TabBtn>
        </div>
      </div>

      {tab === "inbox" && (
        <ul className="px-4 mt-3 space-y-3">
          {rfqs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">No RFQs yet.</p>
          )}
          {rfqs.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setOpenId(r.id)}
                className="w-full text-left rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight flex-1">{r.title}</p>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === "open"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" /> {r.qty.toLocaleString()} {r.unit}
                  </span>
                  <span>Target ${r.targetPrice.toFixed(2)}</span>
                  <span className="flex items-center gap-1">
                    <Globe2 className="w-3 h-3" /> {r.shipTo}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{r.id} · {r.date}</span>
                  <span className="font-semibold text-primary">
                    {r.quotes.length} quote{r.quotes.length === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === "new" && <RFQForm onSubmit={handleSubmit} onCancel={() => setTab("inbox")} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 text-xs font-semibold border-b-2 transition flex items-center ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RFQForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (rfq: Omit<RFQ, "id" | "date" | "status" | "quotes">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [qty, setQty] = useState(100);
  const [unit, setUnit] = useState("piece");
  const [targetPrice, setTargetPrice] = useState(0);
  const [shipTo, setShipTo] = useState("");
  const [details, setDetails] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !shipTo || qty < 1) {
      toast.error("Please fill in product, quantity and shipping destination.");
      return;
    }
    onSubmit({ title, category, qty, unit, targetPrice, shipTo, details });
  };

  return (
    <form onSubmit={submit} className="px-4 mt-4 space-y-3 pb-4">
      <Field label="Product name *">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Custom branded power banks 10000mAh"
          className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </Field>

      <Field label="Category">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Quantity *">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 0)}
            className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>
        <Field label="Unit">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="piece">piece</option>
            <option value="pair">pair</option>
            <option value="set">set</option>
            <option value="pack">pack</option>
            <option value="box">box</option>
            <option value="kg">kg</option>
          </select>
        </Field>
        <Field label="Target $">
          <input
            type="number"
            min={0}
            step={0.01}
            value={targetPrice}
            onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
            className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>
      </div>

      <Field label="Ship to *">
        <input
          value={shipTo}
          onChange={(e) => setShipTo(e.target.value)}
          placeholder="City, Country"
          className="w-full h-10 px-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </Field>

      <Field label="Details">
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Materials, packaging, certifications, sample requirements..."
          className="w-full p-3 rounded-lg bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
        />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-full bg-muted text-foreground text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-pop flex items-center justify-center gap-1.5"
        >
          <Send className="w-4 h-4" /> Post RFQ
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function RFQDetail({ rfq, onBack }: { rfq: RFQ; onBack: () => void }) {
  return (
    <div className="pb-8">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted" aria-label="Back">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{rfq.id}</p>
          <p className="text-[10px] text-muted-foreground">Posted {rfq.date}</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-card border border-border shadow-card p-4">
          <h2 className="text-base font-bold leading-tight">{rfq.title}</h2>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <Detail label="Quantity" value={`${rfq.qty.toLocaleString()} ${rfq.unit}`} />
            <Detail label="Target price" value={`$${rfq.targetPrice.toFixed(2)}`} />
            <Detail label="Ship to" value={rfq.shipTo} />
            <Detail label="Category" value={CATEGORIES.find((c) => c.id === rfq.category)?.name ?? rfq.category} />
          </div>
          {rfq.details && (
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{rfq.details}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            Quotes received ({rfq.quotes.length})
          </h3>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Live
          </span>
        </div>

        <ul className="mt-2 space-y-3">
          {rfq.quotes.length === 0 && (
            <li className="rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">
              Waiting for supplier quotes…
            </li>
          )}
          {rfq.quotes.map((q) => {
            const sup = SUPPLIERS.find((s) => s.id === q.supplierId);
            if (!sup) return null;
            const savings = ((rfq.targetPrice - q.pricePerUnit) / rfq.targetPrice) * 100;
            return (
              <li
                key={q.id}
                className="rounded-2xl bg-card border border-border shadow-card overflow-hidden"
              >
                <div className="p-3 flex items-center gap-2.5 border-b border-border">
                  <img src={sup.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">
                      {sup.name}
                      {sup.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{sup.country}</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {sup.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/supplier/${sup.id}`}
                    className="text-[10px] font-semibold text-primary"
                  >
                    View
                  </Link>
                </div>
                <div className="p-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-base font-bold text-destructive">${q.pricePerUnit.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">per {rfq.unit}</p>
                  </div>
                  <div>
                    <p className="text-base font-bold">{q.leadTime}</p>
                    <p className="text-[10px] text-muted-foreground">lead time</p>
                  </div>
                  <div>
                    <p className="text-base font-bold">{q.moq}</p>
                    <p className="text-[10px] text-muted-foreground">MOQ</p>
                  </div>
                </div>
                {savings > 0 && (
                  <div className="px-3 pb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {savings.toFixed(0)}% under target
                    </span>
                  </div>
                )}
                {q.notes && (
                  <p className="px-3 pb-2 text-[11px] text-muted-foreground leading-relaxed">
                    {q.notes}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 p-3 border-t border-border bg-muted/20">
                  <Link
                    to="/messages"
                    className="h-9 rounded-full bg-card border border-border text-xs font-semibold flex items-center justify-center"
                  >
                    Message
                  </Link>
                  <button className="h-9 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                    Accept quote
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}
