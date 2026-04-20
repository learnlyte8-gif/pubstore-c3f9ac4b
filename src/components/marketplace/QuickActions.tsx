import { Link } from "react-router-dom";
import { FileText, Package, Truck, Wallet, BadgePercent, GitCompare } from "lucide-react";

const ACTIONS = [
  { icon: FileText, label: "Request quote", to: "/rfq", tone: "bg-primary/10 text-primary" },
  { icon: Package, label: "Track order", to: "/orders", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { icon: GitCompare, label: "Compare", to: "/compare", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { icon: Truck, label: "Logistics", to: "/categories", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { icon: Wallet, label: "Trade Pay", to: "/account", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { icon: BadgePercent, label: "Coupons", to: "/account", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-6 gap-1.5 mt-3 rounded-2xl bg-card border border-border shadow-card p-2.5">
      {ACTIONS.map((a) => (
        <Link
          to={a.to}
          key={a.label}
          className="flex flex-col items-center gap-1 py-1.5 rounded-lg hover:bg-muted/60 transition"
        >
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.tone}`}>
            <a.icon className="w-4 h-4" strokeWidth={2} />
          </span>
          <span className="text-[9.5px] font-medium leading-tight text-center">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
