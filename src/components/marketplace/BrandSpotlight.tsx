import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const COLORS = [
  "from-indigo-500 to-blue-600",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-500 to-zinc-600",
];

async function fetchSpotlight() {
  // Featured = gold/verified suppliers, fallback to top-rated
  const { data: gold } = await supabase
    .from("suppliers")
    .select("id,name,country,logo,banner,gold,verified,rating")
    .or("gold.eq.true,verified.eq.true")
    .order("rating", { ascending: false })
    .limit(6);

  if (gold && gold.length >= 3) return gold;

  const { data: top } = await supabase
    .from("suppliers")
    .select("id,name,country,logo,banner,gold,verified,rating")
    .order("rating", { ascending: false })
    .limit(6);
  return top ?? [];
}

export default function BrandSpotlight() {
  const { data: brands = [] } = useQuery({ queryKey: ["brand-spotlight"], queryFn: fetchSpotlight, staleTime: 60_000 });

  if (brands.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {brands.map((b: any, i: number) => (
        <Link
          to={`/supplier/${b.id}`}
          key={b.id}
          className={`relative aspect-[4/3] rounded-xl bg-gradient-to-br ${COLORS[i % COLORS.length]} p-2.5 flex flex-col justify-between text-white shadow-card hover:shadow-elevated transition overflow-hidden`}
        >
          {b.banner && (
            <img src={b.banner} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" loading="lazy" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />
          <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-1">
            {b.gold && <Award className="w-3 h-3 text-amber-200" />}
            {b.verified && <ShieldCheck className="w-3 h-3 text-sky-200" />}
            <p className="text-[9px] uppercase tracking-wider opacity-90 font-semibold truncate">
              {b.country || "Featured"}
            </p>
          </div>
          <p className="text-sm font-bold relative leading-tight line-clamp-2">{b.name}</p>
        </Link>
      ))}
    </div>
  );
}
