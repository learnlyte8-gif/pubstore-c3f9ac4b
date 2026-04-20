import { Link } from "react-router-dom";

const BRANDS = [
  { id: "b1", name: "Aurora", tag: "Electronics", color: "from-indigo-500 to-blue-600" },
  { id: "b2", name: "Lumière", tag: "Fashion", color: "from-pink-500 to-rose-600" },
  { id: "b3", name: "HomeCraft", tag: "Home", color: "from-emerald-500 to-teal-600" },
  { id: "b4", name: "Wellness", tag: "Beauty", color: "from-amber-500 to-orange-600" },
  { id: "b5", name: "Atlas", tag: "Sports", color: "from-violet-500 to-purple-600" },
  { id: "b6", name: "Nordic", tag: "Lifestyle", color: "from-slate-500 to-zinc-600" },
];

export default function BrandSpotlight() {
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {BRANDS.map((b) => (
        <Link
          to="/categories"
          key={b.id}
          className={`relative aspect-[4/3] rounded-xl bg-gradient-to-br ${b.color} p-2.5 flex flex-col justify-between text-white shadow-card hover:shadow-elevated transition overflow-hidden`}
        >
          <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-white/5" />
          <p className="text-[9px] uppercase tracking-wider opacity-90 font-semibold relative">{b.tag}</p>
          <p className="text-sm font-bold relative">{b.name}</p>
        </Link>
      ))}
    </div>
  );
}
