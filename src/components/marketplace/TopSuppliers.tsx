import { Link } from "react-router-dom";
import { ShieldCheck, Star, MapPin } from "lucide-react";
import { SUPPLIERS } from "@/data/products";

export default function TopSuppliers() {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 mt-3">
      {SUPPLIERS.map((s) => (
        <Link
          to={`/supplier/${s.id}`}
          key={s.id}
          className="shrink-0 w-60 rounded-xl bg-card border border-border shadow-card hover:shadow-elevated transition overflow-hidden"
        >
          <div className="h-16 bg-muted relative">
            <img src={s.banner} alt="" className="w-full h-full object-cover" loading="lazy" />
            {s.gold && (
              <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                GOLD
              </span>
            )}
          </div>
          <div className="p-2.5 -mt-6 relative">
            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-background shadow-card bg-card">
              <img src={s.logo} alt={s.name} className="w-full h-full object-cover" />
            </div>
            <p className="mt-1.5 text-xs font-semibold leading-tight line-clamp-2">{s.name}</p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {s.country}
              </span>
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span className="text-foreground font-medium">{s.rating.toFixed(1)}</span>
              </span>
              {s.verified && (
                <span className="flex items-center gap-0.5 text-primary">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
