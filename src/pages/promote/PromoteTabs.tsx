import { Link, useLocation } from "react-router-dom";
import { Megaphone, Link2, Wallet } from "lucide-react";

const TABS = [
  { to: "/promote", label: "Products", icon: Megaphone, match: (p: string) => p === "/promote" || p.startsWith("/promote/product") },
  { to: "/promote/links", label: "My promotions", icon: Link2, match: (p: string) => p.startsWith("/promote/links") },
  { to: "/promote/earnings", label: "Earnings", icon: Wallet, match: (p: string) => p.startsWith("/promote/earnings") },
];

export default function PromoteTabs() {
  const { pathname } = useLocation();
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold border transition ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
