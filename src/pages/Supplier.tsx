import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Award,
  MessageCircle,
  Clock,
  Truck,
  Star,
  MapPin,
  Calendar,
  Package,
  FileText,
  Share2,
  Heart,
} from "lucide-react";
import { useState } from "react";
import { useSupplier, useProducts } from "@/hooks/useCatalog";
import ProductCard from "@/components/marketplace/ProductCard";

export default function Supplier() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: supplier, isLoading } = useSupplier(id);
  const { data: products = [] } = useProducts({ supplierId: id });
  if (isLoading) return <p className="p-12 text-center text-sm text-muted-foreground">Loading…</p>;
  const [tab, setTab] = useState<"products" | "about" | "certs">("products");
  const [following, setFollowing] = useState(false);

  if (!supplier) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Supplier not found.</p>
        <Link to="/home" className="text-primary text-sm font-semibold mt-2 inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="relative h-40 bg-muted overflow-hidden">
        <img src={supplier.banner} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center shadow-card"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-2">
            <button
              aria-label="Share"
              className="w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center shadow-card"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFollowing((v) => !v)}
              aria-label="Follow"
              className="w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center shadow-card"
            >
              <Heart className={`w-4 h-4 ${following ? "fill-destructive text-destructive" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative">
        <div className="flex items-end gap-3">
          <img
            src={supplier.logo}
            alt={supplier.name}
            className="w-20 h-20 rounded-2xl object-cover border-4 border-background shadow-elevated bg-card"
          />
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap gap-1">
              {supplier.verified && (
                <Badge icon={ShieldCheck} label="Verified" tone="primary" />
              )}
              {supplier.gold && <Badge icon={Award} label="Gold" tone="gold" />}
              {supplier.tradeAssurance && (
                <Badge icon={ShieldCheck} label="Trade Assured" tone="success" />
              )}
            </div>
          </div>
        </div>

        <h1 className="text-lg font-bold mt-2 leading-tight">{supplier.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {supplier.country}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {supplier.yearsActive} yrs on PUBSTORE
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span className="font-medium text-foreground">{supplier.rating.toFixed(1)}</span>
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to="/messages"
            className="h-10 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 shadow-pop"
          >
            <MessageCircle className="w-4 h-4" /> Contact supplier
          </Link>
          <Link
            to="/rfq"
            className="h-10 rounded-full bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-1.5 shadow-card"
          >
            <FileText className="w-4 h-4" /> Request quote
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-card border border-border shadow-card p-3">
          <Stat icon={MessageCircle} value={`${supplier.responseRate}%`} label="Response" />
          <Stat icon={Clock} value={supplier.responseTime} label="Reply time" />
          <Stat icon={Truck} value={`${supplier.onTimeDelivery}%`} label="On-time" />
        </div>
      </div>

      <div className="mt-5 px-4 border-b border-border">
        <div className="flex gap-1">
          <TabBtn active={tab === "products"} onClick={() => setTab("products")}>
            Products ({products.length})
          </TabBtn>
          <TabBtn active={tab === "about"} onClick={() => setTab("about")}>
            About
          </TabBtn>
          <TabBtn active={tab === "certs"} onClick={() => setTab("certs")}>
            Certifications
          </TabBtn>
        </div>
      </div>

      {tab === "products" && (
        <div className="px-4 mt-4">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No products listed yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "about" && (
        <div className="px-4 mt-4 space-y-3">
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <h3 className="text-sm font-bold mb-1.5 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-primary" /> Company overview
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{supplier.about}</p>
          </div>
          <div className="rounded-2xl bg-card border border-border shadow-card p-4">
            <h3 className="text-sm font-bold mb-2">Business details</h3>
            <ul className="text-xs space-y-2">
              <Row label="Country / Region" value={`${supplier.country} (${supplier.countryCode})`} />
              <Row label="Years active" value={`${supplier.yearsActive} years`} />
              <Row label="Response rate" value={`${supplier.responseRate}%`} />
              <Row label="Avg. reply time" value={supplier.responseTime} />
              <Row label="On-time delivery" value={`${supplier.onTimeDelivery}%`} />
              <Row label="Rating" value={`${supplier.rating.toFixed(1)} / 5`} />
            </ul>
          </div>
        </div>
      )}

      {tab === "certs" && (
        <div className="px-4 mt-4 space-y-2">
          {[
            { name: "Business License Verified", by: "TÜV SÜD", date: "2024-08" },
            { name: "ISO 9001:2015", by: "Bureau Veritas", date: "2025-01" },
            { name: "Trade Assurance", by: "PUBSTORE", date: "2025-03" },
            { name: "Factory Audit Report", by: "SGS", date: "2024-11" },
          ].map((c) => (
            <div
              key={c.name}
              className="rounded-xl bg-card border border-border shadow-card p-3 flex items-center gap-3"
            >
              <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  By {c.by} · {c.date}
                </p>
              </div>
              <button className="text-[11px] font-semibold text-primary">View</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof ShieldCheck;
  value: string;
  label: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function Badge({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  tone: "primary" | "gold" | "success";
}) {
  const tones = {
    primary: "bg-primary/15 text-primary backdrop-blur",
    gold: "bg-amber-500/20 text-amber-700 dark:text-amber-300 backdrop-blur",
    success: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 backdrop-blur",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-soft ${tones[tone]}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
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
      className={`px-4 h-10 text-sm font-semibold border-b-2 transition ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </li>
  );
}
