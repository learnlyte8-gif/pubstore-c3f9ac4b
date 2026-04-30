import { Link, useLocation } from "react-router-dom";
import { Store, Newspaper, BedDouble, Car, Factory, Navigation, Wrench, Home as HomeIcon, Truck, Banknote, Briefcase, type LucideIcon } from "lucide-react";

const DEPTS: { to: string; label: string; icon: LucideIcon; tone: string }[] = [
  { to: "/home",       label: "Market",     icon: Store,      tone: "from-primary to-primary/70" },
  { to: "/jobs",       label: "Jobs",       icon: Briefcase,  tone: "from-blue-700 to-indigo-500" },
  { to: "/rides",      label: "Rides",      icon: Navigation, tone: "from-emerald-500 to-teal-400" },
  { to: "/services",   label: "Services",   icon: Wrench,     tone: "from-violet-600 to-fuchsia-500" },
  { to: "/properties", label: "Property",   icon: HomeIcon,   tone: "from-sky-700 to-blue-500" },
  { to: "/logistics",  label: "Delivery",   icon: Truck,      tone: "from-orange-600 to-rose-500" },
  { to: "/finance",    label: "Finance",    icon: Banknote,   tone: "from-emerald-700 to-cyan-600" },
  { to: "/news",       label: "News",       icon: Newspaper,  tone: "from-rose-500 to-orange-400" },
  { to: "/stays",      label: "Stays",      icon: BedDouble,  tone: "from-amber-500 to-yellow-300" },
  { to: "/auto",       label: "Auto",       icon: Car,        tone: "from-zinc-900 to-zinc-600" },
  { to: "/industrial", label: "Industrial", icon: Factory,    tone: "from-sky-700 to-sky-400" },
];

export default function DepartmentsBar() {
  const loc = useLocation();
  return (
    <div className="px-4 mt-3">
      <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
        {DEPTS.map((d) => {
          const active = loc.pathname.startsWith(d.to);
          const Icon = d.icon;
          return (
            <Link
              key={d.to}
              to={d.to}
              className={`group shrink-0 flex flex-col items-center gap-1 ${active ? "scale-[1.04]" : "opacity-90"} transition-all`}
            >
              <span className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${d.tone} flex items-center justify-center shadow-elevated`}>
                <span className="absolute inset-[2px] rounded-[14px] bg-background/15 backdrop-blur-sm" />
                <Icon className="relative z-10 w-5 h-5 text-white" strokeWidth={2.4} />
                {active && <span className="absolute -bottom-1 right-0 w-2.5 h-2.5 rounded-full bg-foreground ring-2 ring-background" />}
              </span>
              <span className={`text-[10px] font-bold tracking-wide ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {d.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
