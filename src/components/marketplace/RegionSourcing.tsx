const REGIONS = [
  { code: "CN", name: "China", count: "120k+ suppliers", flag: "🇨🇳", grad: "from-red-500/20 to-amber-500/20" },
  { code: "IN", name: "India", count: "45k+ suppliers", flag: "🇮🇳", grad: "from-orange-500/20 to-emerald-500/20" },
  { code: "TR", name: "Türkiye", count: "12k+ suppliers", flag: "🇹🇷", grad: "from-red-500/20 to-rose-500/20" },
  { code: "VN", name: "Vietnam", count: "8k+ suppliers", flag: "🇻🇳", grad: "from-yellow-500/20 to-red-500/20" },
];

export default function RegionSourcing() {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {REGIONS.map((r) => (
        <div
          key={r.code}
          className={`rounded-xl border border-border bg-gradient-to-br ${r.grad} p-3 shadow-card hover:shadow-elevated transition cursor-pointer`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{r.flag}</span>
            <div>
              <p className="text-sm font-bold leading-tight">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">{r.count}</p>
            </div>
          </div>
          <button className="mt-2 text-[10px] font-semibold text-primary">Source now →</button>
        </div>
      ))}
    </div>
  );
}
