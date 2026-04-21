import { Globe2, Factory, Package2, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k+`;
  return `${n}`;
};

async function fetchStats() {
  const [suppliers, products, countries, tradeAssured] = await Promise.all([
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("suppliers").select("country").not("country", "is", null),
    supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("trade_assurance", true),
  ]);
  const uniqCountries = new Set((countries.data ?? []).map((r: any) => r.country).filter(Boolean));
  return {
    suppliers: suppliers.count ?? 0,
    products: products.count ?? 0,
    countries: uniqCountries.size,
    tradeAssured: tradeAssured.count ?? 0,
  };
}

export default function StatsBar() {
  const { data } = useQuery({ queryKey: ["home-stats"], queryFn: fetchStats, staleTime: 60_000 });

  const items = [
    { icon: Factory, value: data ? fmt(data.suppliers) : "—", label: "Suppliers" },
    { icon: Package2, value: data ? fmt(data.products) : "—", label: "Products" },
    { icon: Globe2, value: data ? `${data.countries}` : "—", label: data?.countries === 1 ? "Country" : "Countries" },
    { icon: ShieldCheck, value: data ? fmt(data.tradeAssured) : "—", label: "Assured" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mt-3 rounded-2xl bg-gradient-to-br from-foreground to-foreground/85 text-background p-3 shadow-elevated">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col items-center text-center">
          <s.icon className="w-4 h-4 opacity-80" strokeWidth={2} />
          <p className="text-sm font-bold mt-1 leading-none">{s.value}</p>
          <p className="text-[10px] opacity-75 mt-0.5 leading-none">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
