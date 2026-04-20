import { useEffect, useState } from "react";

const slides = [
  {
    title: "Mega Sale",
    subtitle: "Up to 70% off electronics",
    cta: "Shop now",
    bg: "from-indigo-600 via-purple-600 to-pink-600",
  },
  {
    title: "New Season",
    subtitle: "Fashion drops landing daily",
    cta: "Discover",
    bg: "from-rose-500 via-orange-500 to-amber-500",
  },
  {
    title: "Free Shipping",
    subtitle: "On orders over $25 worldwide",
    cta: "Learn more",
    bg: "from-emerald-500 via-teal-500 to-cyan-600",
  },
];

export default function PromoBanner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, []);
  const s = slides[i];

  return (
    <section className="px-4 mt-3">
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${s.bg} h-32 px-5 flex items-center transition-all duration-700`}
      >
        <div className="text-white max-w-[60%]">
          <p className="text-xs font-medium uppercase tracking-wider opacity-90">PUBSTORE</p>
          <h3 className="text-2xl font-bold leading-tight mt-0.5">{s.title}</h3>
          <p className="text-xs opacity-95 mt-0.5">{s.subtitle}</p>
          <button className="mt-2 bg-white text-foreground text-xs font-semibold px-3 py-1.5 rounded-full">
            {s.cta}
          </button>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-7xl opacity-30">🛍️</div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-all ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
