import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FLAGS: Record<string, string> = {
  CN: "🇨🇳", IN: "🇮🇳", TR: "🇹🇷", VN: "🇻🇳", US: "🇺🇸", DE: "🇩🇪", IT: "🇮🇹",
  GB: "🇬🇧", FR: "🇫🇷", JP: "🇯🇵", KR: "🇰🇷", BR: "🇧🇷", MX: "🇲🇽", ZA: "🇿🇦",
  NG: "🇳🇬", KE: "🇰🇪", EG: "🇪🇬", ZW: "🇿🇼", AE: "🇦🇪", SA: "🇸🇦",
};
const flagFor = (code?: string | null, country?: string | null) =>
  (code && FLAGS[code.toUpperCase()]) ||
  (country && FLAGS[country.slice(0, 2).toUpperCase()]) ||
  "🌍";

const GRADS = [
  "from-red-500/20 to-amber-500/20",
  "from-orange-500/20 to-emerald-500/20",
  "from-sky-500/20 to-indigo-500/20",
  "from-rose-500/20 to-pink-500/20",
];

async function fetchRegions() {
  const { data } = await supabase
    .from("suppliers")
    .select("country, country_code")
    .not("country", "is", null);
  const counts = new Map<string, { name: string; code: string | null; n: number }>();
  (data ?? []).forEach((s: any) => {
    if (!s.country) return;
    const cur = counts.get(s.country) ?? { name: s.country, code: s.country_code, n: 0 };
    cur.n += 1;
    counts.set(s.country, cur);
  });
  return Array.from(counts.values()).sort((a, b) => b.n - a.n).slice(0, 4);
}

export default function RegionSourcing() {
  const { data: regions = [] } = useQuery({ queryKey: ["region-sourcing"], queryFn: fetchRegions, staleTime: 60_000 });

  if (regions.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-card p-5 text-center shadow-card">
        <Globe2 className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">More regions coming as suppliers join.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {regions.map((r, i) => (
        <Link
          to={`/categories?country=${encodeURIComponent(r.name)}`}
          key={r.name}
          className={`rounded-xl border border-border bg-gradient-to-br ${GRADS[i % GRADS.length]} p-3 shadow-card hover:shadow-elevated transition cursor-pointer`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{flagFor(r.code, r.name)}</span>
            <div>
              <p className="text-sm font-bold leading-tight">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {r.n} supplier{r.n === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <span className="mt-2 inline-block text-[10px] font-semibold text-primary">Source now →</span>
        </Link>
      ))}
    </div>
  );
}
