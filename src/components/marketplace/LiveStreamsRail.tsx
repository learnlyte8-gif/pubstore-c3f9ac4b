import { Link } from "react-router-dom";
import { Radio, Eye } from "lucide-react";
import { SUPPLIERS, PRODUCTS } from "@/data/products";

const LIVE_TITLES = [
  "🔥 Factory tour",
  "Bulk pricing live Q&A",
  "New collection drop",
  "Behind the scenes",
  "Custom orders open",
];

const STREAMS = SUPPLIERS.slice(0, 6).map((s, i) => {
  const thumb = PRODUCTS.find((p) => p.supplierId === s.id)?.image ?? s.banner;
  return {
    id: `live-${s.id}`,
    supplier: s,
    title: LIVE_TITLES[i % LIVE_TITLES.length],
    viewers: 240 + (i * 411) % 4800,
    thumb,
  };
});

export default function LiveStreamsRail() {
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
        {STREAMS.map((s) => (
          <Link
            key={s.id}
            to={`/live/${s.id}`}
            className="relative shrink-0 w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-card"
          >
            <img src={s.thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse">
              LIVE
            </span>
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-bold flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" />
              {s.viewers > 1000 ? (s.viewers / 1000).toFixed(1) + "K" : s.viewers}
            </span>
            <div className="absolute bottom-2 inset-x-2 text-white">
              <div className="flex items-center gap-1.5 mb-1">
                <img src={s.supplier.logo} alt="" className="w-5 h-5 rounded-full object-cover ring-2 ring-white" />
                <p className="text-[10px] font-bold truncate">{s.supplier.name.split(" ")[0]}</p>
              </div>
              <p className="text-[10px] leading-snug font-semibold line-clamp-2">{s.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
