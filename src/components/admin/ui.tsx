import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export const fmt = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;

/** Console page wrapper: title row + content, Google-Cloud-ish spacing. */
export function ConsolePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight truncate">{title}</h1>
          {description && <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card shadow-sm ${className}`}>{children}</div>;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: { icon: any; label: string; value: React.ReactNode; hint?: string; to?: string }) {
  const inner = (
    <div className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-[12px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[26px] font-semibold tracking-tight mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-[12px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
  return to ? (
    <Link to={to} className="rounded-xl border bg-card shadow-sm hover:bg-muted/40 transition block">{inner}</Link>
  ) : (
    <Card>{inner}</Card>
  );
}

export function FilterRow({
  filter,
  setFilter,
  onRefresh,
  options,
}: {
  filter: string;
  setFilter: (v: any) => void;
  onRefresh: () => void;
  options?: readonly string[];
}) {
  const opts = options ?? (["pending", "approved", "declined", "all"] as const);
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex gap-1 overflow-x-auto">
        {opts.map((o) => (
          <button
            key={o}
            onClick={() => setFilter(o)}
            className={`px-3 h-7 rounded-full text-[12px] font-medium border capitalize whitespace-nowrap ${
              filter === o ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
            }`}
          >
            {o.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <button onClick={onRefresh} className="ml-auto text-[12px] font-medium inline-flex items-center gap-1 px-2 h-7 rounded-md hover:bg-muted">
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status ?? "unknown");
  const good = ["approved", "active", "refunded", "delivered", "resolved", "settled", "published"];
  const bad = ["declined", "rejected", "cancelled", "failed", "suspended", "exhausted"];
  const cls = good.includes(s)
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : bad.includes(s)
    ? "bg-red-500/15 text-red-700 dark:text-red-300"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>{s.replace(/_/g, " ")}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export function SkeletonList() {
  return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
}

export function Empty({ label }: { label: string }) {
  return <div className="text-center text-[13px] text-muted-foreground py-12 rounded-xl border bg-card">{label}</div>;
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-3 shadow-sm">{children}</div>;
}
