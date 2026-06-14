import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { FLASH_DEALS } from "@/data/products";
import ProductCard from "./ProductCard";

const useCountdown = (hours: number) => {
  const [end] = useState(() => Date.now() + hours * 3600 * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, end - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { h, m, s };
};

const pad = (n: number) => n.toString().padStart(2, "0");

export default function FlashDeals() {
  const { h, m, s } = useCountdown(6);

  return (
    <section className="px-4 mt-4">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 p-3 shadow-elevated">
        <div className="flex items-center justify-between text-white mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 fill-white" />
            <h2 className="text-base font-bold">Flash Deals</h2>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-90">Ends in</span>
            <TimeBox v={pad(h)} />
            <span>:</span>
            <TimeBox v={pad(m)} />
            <span>:</span>
            <TimeBox v={pad(s)} />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          {FLASH_DEALS.map((p) => (
            <ProductCard key={p.id} product={p} variant="compact" />
          ))}
        </div>
      </div>
    </section>
  );
}

function TimeBox({ v }: { v: string }) {
  return (
    <span className="bg-black/30 text-white text-xs font-bold rounded px-1.5 py-0.5 tabular-nums min-w-[1.6rem] text-center">
      {v}
    </span>
  );
}
