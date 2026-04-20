import { Globe2, Factory, Package2, ShieldCheck } from "lucide-react";

const STATS = [
  { icon: Factory, value: "200k+", label: "Suppliers" },
  { icon: Package2, value: "10M+", label: "Products" },
  { icon: Globe2, value: "190+", label: "Countries" },
  { icon: ShieldCheck, value: "Trade", label: "Assurance" },
];

export default function StatsBar() {
  return (
    <div className="grid grid-cols-4 gap-2 mt-3 rounded-2xl bg-gradient-to-br from-foreground to-foreground/85 text-background p-3 shadow-elevated">
      {STATS.map((s) => (
        <div key={s.label} className="flex flex-col items-center text-center">
          <s.icon className="w-4 h-4 opacity-80" strokeWidth={2} />
          <p className="text-sm font-bold mt-1 leading-none">{s.value}</p>
          <p className="text-[10px] opacity-75 mt-0.5 leading-none">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
