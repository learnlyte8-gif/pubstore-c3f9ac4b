import { Link } from "react-router-dom";
import { Truck, Package, Clock, MapPin } from "lucide-react";

const MOCK = [
  { id: "l1", title: "Same-day city delivery", lane: "Harare → Harare", eta: "Under 2 hrs", price: "$8", vehicle: "Motorbike", color: "from-rose-500 to-orange-500" },
  { id: "l2", title: "Cross-border freight", lane: "Joburg → Harare", eta: "48 hrs", price: "$420", vehicle: "10t Truck", color: "from-indigo-500 to-purple-600" },
  { id: "l3", title: "Bulk pallet move", lane: "Bulawayo → Mutare", eta: "24 hrs", price: "$180", vehicle: "5t Truck", color: "from-emerald-500 to-teal-600" },
];

export default function LogisticsRail() {
  return (
    <section className="px-4 mt-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-pop">
            <Truck className="w-4 h-4 text-white" strokeWidth={2.4} />
          </span>
          <div>
            <h2 className="text-base font-extrabold leading-tight tracking-tight">Move anything, anywhere</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Drivers ready to pick up now</p>
          </div>
        </div>
        <Link to="/logistics" className="text-xs font-bold text-primary">See all</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1 snap-x snap-mandatory">
        {MOCK.map((l) => (
          <Link key={l.id} to="/logistics" className={`shrink-0 w-60 snap-start rounded-2xl bg-gradient-to-br ${l.color} text-white shadow-card p-3.5 active:scale-[0.98] transition relative overflow-hidden`}>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-2xl" />
            <Package className="w-5 h-5 opacity-80" />
            <p className="font-extrabold text-sm mt-3 leading-tight">{l.title}</p>
            <p className="text-[11px] opacity-90 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.lane}</p>
            <p className="text-[11px] opacity-90 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {l.eta} · {l.vehicle}</p>
            <div className="mt-3 pt-2.5 border-t border-white/25 flex items-center justify-between">
              <span className="text-base font-black tracking-tight">{l.price}</span>
              <span className="text-[10px] font-bold bg-white/25 backdrop-blur px-2 py-1 rounded-full">Book now</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
