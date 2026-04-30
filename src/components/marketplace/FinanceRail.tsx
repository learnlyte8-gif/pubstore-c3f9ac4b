import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchFinanceProducts } from "@/data/newVerticals";
import { Banknote, Percent, Sparkles } from "lucide-react";

export default function FinanceRail() {
  const { data: products = [] } = useQuery({ queryKey: ["home-finance"], queryFn: () => fetchFinanceProducts({ limit: 6 }) });
  if (products.length === 0) return null;
  return (
    <section className="mt-7 animate-fade-in">
      <div className="px-4 flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Finance & insurance</span>
          </div>
          <h2 className="text-[22px] font-serif leading-tight mt-1">Get funded</h2>
          <p className="text-xs text-muted-foreground">Loans, vehicle financing, insurance.</p>
        </div>
        <Link to="/finance" className="text-xs font-bold text-primary">See all</Link>
      </div>

      <div className="mt-3 -mx-1 px-1 pb-2 flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory">
        {products.map((p) => (
          <Link key={p.id} to="/finance" className="shrink-0 w-60 snap-start bg-gradient-to-br from-emerald-700 to-teal-800 text-white rounded-2xl shadow-card overflow-hidden p-3">
            <div className="flex items-start justify-between">
              <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-[9px] font-bold uppercase capitalize">{p.kind.replace("_", " ")}</span>
              <Banknote className="w-5 h-5 opacity-70" />
            </div>
            <p className="font-bold text-sm leading-tight mt-3 line-clamp-2">{p.title}</p>
            {p.provider_name && <p className="text-[10px] opacity-80 mt-0.5">{p.provider_name}</p>}
            <div className="flex gap-2 mt-2 text-[10px]">
              {p.interest_rate != null && <span className="px-2 py-0.5 rounded-full bg-white/20 font-bold flex items-center gap-0.5"><Percent className="w-2.5 h-2.5" /> {p.interest_rate}%</span>}
              {p.term_months && <span className="px-2 py-0.5 rounded-full bg-white/20 font-bold">{p.term_months}mo</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
