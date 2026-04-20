import { Link } from "react-router-dom";
import { ShieldCheck, Award, MessageSquare, Clock, Truck, Star, ChevronRight } from "lucide-react";
import type { Supplier } from "@/data/products";

export default function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <Link
      to={`/supplier/${supplier.id}`}
      className="block mx-4 mt-3 rounded-xl border border-border bg-card overflow-hidden hover:border-foreground/30 transition"
    >
      <div className="p-3 flex items-start gap-3">
        <img
          src={supplier.logo}
          alt={supplier.name}
          className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug line-clamp-1">{supplier.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
            <span>{supplier.country}</span>
            <span>·</span>
            <span>{supplier.yearsActive} yrs</span>
            <span>·</span>
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span className="font-medium text-foreground">{supplier.rating.toFixed(1)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {supplier.verified && (
              <Badge icon={ShieldCheck} label="Verified" tone="primary" />
            )}
            {supplier.gold && <Badge icon={Award} label="Gold Supplier" tone="gold" />}
            {supplier.tradeAssurance && (
              <Badge icon={ShieldCheck} label="Trade Assurance" tone="success" />
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>

      <div className="grid grid-cols-3 border-t border-border divide-x divide-border text-center">
        <Stat icon={MessageSquare} value={`${supplier.responseRate}%`} label="Response rate" />
        <Stat icon={Clock} value={supplier.responseTime} label="Reply time" />
        <Stat icon={Truck} value={`${supplier.onTimeDelivery}%`} label="On-time" />
      </div>
    </Link>
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
    <div className="py-2 px-1">
      <div className="flex items-center justify-center gap-1 text-foreground">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-bold tabular-nums">{value}</span>
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
    primary: "bg-primary/10 text-primary",
    gold: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${tones[tone]}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
