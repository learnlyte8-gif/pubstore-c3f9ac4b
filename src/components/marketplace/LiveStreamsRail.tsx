import { Link } from "react-router-dom";
import { Radio, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function LiveStreamsRail() {
  const { data: streams = [] } = useQuery({
    queryKey: ["home-live-streams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id,title,cover,viewer_count,supplier_id,suppliers(name,logo)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  if (streams.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="px-4 flex items-end justify-between">
        <div>
          <h2 className="text-base font-bold leading-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-destructive/15 flex items-center justify-center">
              <Radio className="w-4 h-4 text-destructive animate-pulse" />
            </span>
            Live now
          </h2>
          <p className="text-xs text-muted-foreground">Suppliers streaming · join free</p>
        </div>
        <Link to="/live" className="text-xs text-primary font-semibold">See all</Link>
      </div>
      <div className="mt-3 -mx-1 px-1 pb-1 flex gap-3 overflow-x-auto scrollbar-none">
        {streams.map((s: any) => (
          <Link
            key={s.id}
            to={`/live/${s.id}`}
            className="relative shrink-0 w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-card"
          >
            {s.cover && (
              <img src={s.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-transparent to-foreground/30" />
            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse">
              LIVE
            </span>
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-foreground/50 text-background text-[9px] font-bold flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" />
              {s.viewer_count > 1000 ? (s.viewer_count / 1000).toFixed(1) + "K" : s.viewer_count}
            </span>
            <div className="absolute bottom-2 inset-x-2 text-background">
              {s.suppliers?.name && (
                <div className="flex items-center gap-1.5 mb-1">
                  {s.suppliers.logo && (
                    <img src={s.suppliers.logo} alt="" className="w-5 h-5 rounded-full object-cover ring-2 ring-background" />
                  )}
                  <p className="text-[10px] font-bold truncate">{s.suppliers.name.split(" ")[0]}</p>
                </div>
              )}
              <p className="text-[10px] leading-snug font-semibold line-clamp-2">{s.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
