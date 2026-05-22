import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Flame, BedDouble, Car, Factory, Radio, Crown, Key, ShoppingBag, Newspaper, Wrench, Home as HomeIcon, Banknote, Navigation, Truck } from "lucide-react";

type Slide = {
  key: string;
  kind: string;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  bg: string;
  image?: string | null;
  icon: any;
};

const GRADIENTS = [
  "from-indigo-600 via-purple-600 to-pink-600",
  "from-rose-500 via-orange-500 to-amber-500",
  "from-emerald-500 via-teal-500 to-cyan-600",
  "from-fuchsia-600 via-pink-600 to-rose-500",
  "from-sky-600 via-blue-600 to-indigo-700",
  "from-amber-500 via-yellow-500 to-orange-600",
  "from-violet-600 via-fuchsia-600 to-pink-500",
  "from-zinc-800 via-zinc-700 to-zinc-600",
];

async function buildSlides(): Promise<Slide[]> {
  const slides: Slide[] = [];
  const now = new Date().toISOString();
  const [deals, hot, sup, stays, vehicles, industrial, lives, carRentals] = await Promise.all([
    supabase.from("products").select("id,title,image,price,original_price,deal_ends_at").eq("active", true).not("deal_ends_at", "is", null).gt("deal_ends_at", now).order("deal_ends_at", { ascending: true }).limit(2),
    supabase.from("products").select("id,title,image,sold").eq("active", true).order("sold", { ascending: false }).limit(2),
    supabase.from("suppliers").select("id,name,country,banner,gold,verified").or("gold.eq.true,verified.eq.true").order("rating", { ascending: false }).limit(1),
    supabase.from("stays").select("id,title,city,cover,price_per_night").eq("active", true).order("rating", { ascending: false }).limit(1),
    supabase.from("vehicles").select("id,title,make,model,year,cover,price").eq("active", true).order("created_at", { ascending: false }).limit(1),
    supabase.from("industrial_listings").select("id,title,cover,price").eq("active", true).order("created_at", { ascending: false }).limit(1),
    supabase.from("live_streams").select("id,title,cover,viewer_count").eq("status", "live").order("viewer_count", { ascending: false }).limit(1),
    supabase.from("car_rentals").select("id,title,make,model,year,cover,price_per_day,city,unlimited_km").eq("active", true).order("featured", { ascending: false }).limit(1),
  ]);

  let g = 0;
  const nextG = () => GRADIENTS[g++ % GRADIENTS.length];

  (deals.data ?? []).forEach((d: any) => {
    const off = d.original_price && d.original_price > d.price
      ? Math.round(((Number(d.original_price) - Number(d.price)) / Number(d.original_price)) * 100) : null;
    slides.push({ key: `deal-${d.id}`, kind: "Flash deal", title: off ? `${off}% OFF` : "Flash Deal", subtitle: d.title, cta: "Grab it", to: `/product/${d.id}`, bg: nextG(), image: d.image, icon: Flame });
  });
  (lives.data ?? []).forEach((l: any) => slides.push({ key: `live-${l.id}`, kind: "Live", title: "🔴 Live now", subtitle: l.title, cta: "Join", to: `/live/${l.id}`, bg: "from-rose-600 via-red-600 to-orange-500", image: l.cover, icon: Radio }));
  (hot.data ?? []).forEach((h: any) => slides.push({ key: `hot-${h.id}`, kind: "Trending", title: "Trending", subtitle: h.title, cta: "Shop", to: `/product/${h.id}`, bg: nextG(), image: h.image, icon: Sparkles }));
  (stays.data ?? []).forEach((s: any) => slides.push({ key: `stay-${s.id}`, kind: "Stays", title: `$${Number(s.price_per_night).toFixed(0)}/night`, subtitle: `${s.title} · ${s.city ?? ""}`, cta: "Book", to: `/stays`, bg: nextG(), image: s.cover, icon: BedDouble }));
  (vehicles.data ?? []).forEach((v: any) => slides.push({ key: `veh-${v.id}`, kind: "Vehicles", title: `$${Number(v.price).toLocaleString()}`, subtitle: `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? v.title}`.trim(), cta: "View", to: `/auto`, bg: nextG(), image: v.cover, icon: Car }));
  (industrial.data ?? []).forEach((it: any) => slides.push({ key: `ind-${it.id}`, kind: "Industrial", title: it.price ? `$${Number(it.price).toLocaleString()}` : "Industrial", subtitle: it.title, cta: "Quote", to: `/industrial`, bg: nextG(), image: it.cover, icon: Factory }));
  (sup.data ?? []).forEach((s: any) => slides.push({ key: `sup-${s.id}`, kind: "Supplier", title: s.gold ? "Gold Supplier" : "Verified", subtitle: `${s.name}${s.country ? ` · ${s.country}` : ""}`, cta: "Visit", to: `/supplier/${s.id}`, bg: nextG(), image: s.banner, icon: Crown }));
  (carRentals.data ?? []).forEach((c: any) => slides.push({ key: `car-${c.id}`, kind: "Rentals", title: `$${Number(c.price_per_day).toFixed(0)}/day`, subtitle: `${c.year ?? ""} ${c.make ?? ""} ${c.model ?? c.title}`.trim(), cta: "Rent", to: `/car-rentals/${c.id}`, bg: "from-orange-600 via-amber-600 to-yellow-500", image: c.cover, icon: Key }));

  slides.push({ key: "rides", kind: "Rides", title: "Fair-fare rides", subtitle: "Set your price. Drivers nearby.", cta: "Open", to: "/rides", bg: "from-emerald-500 via-teal-500 to-cyan-600", image: null, icon: Navigation });
  slides.push({ key: "logistics", kind: "Delivery", title: "Send anything", subtitle: "Drivers bid on your delivery.", cta: "Send", to: "/logistics", bg: "from-orange-600 via-red-600 to-rose-600", image: null, icon: Truck });

  return slides;
}

const FALLBACK: Slide[] = [
  { key: "fb-1", kind: "Welcome", title: "Welcome to PUBSTORE", subtitle: "Source verified suppliers worldwide", cta: "Explore", to: "/categories", bg: GRADIENTS[0], icon: ShoppingBag },
  { key: "fb-2", kind: "Trending", title: "Trending now", subtitle: "Best-selling products", cta: "Shop", to: "/categories", bg: GRADIENTS[1], icon: Sparkles },
  { key: "fb-3", kind: "Stays", title: "Stays worldwide", subtitle: "Book unique places", cta: "Book", to: "/stays", bg: GRADIENTS[2], icon: BedDouble },
];

export default function Promo3DCarousel() {
  const { data } = useQuery({ queryKey: ["promo-3d-slides-v1"], queryFn: buildSlides, staleTime: 60_000 });
  const slides = useMemo(() => (data && data.length >= 3 ? data : [...(data ?? []), ...FALLBACK].slice(0, Math.max(3, data?.length ?? 3))), [data]);
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setActive((v) => (v + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length]);

  const n = slides.length;
  if (n === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) setActive((v) => (v + (dx < 0 ? 1 : -1) + n) % n);
    touchX.current = null;
  };

  return (
    <section className="mt-3 px-4">
      <div
        className="relative h-44 sm:h-52 w-full overflow-visible"
        style={{ perspective: "1200px" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>
          {slides.map((s, i) => {
            let offset = i - active;
            if (offset > n / 2) offset -= n;
            if (offset < -n / 2) offset += n;
            const abs = Math.abs(offset);
            const isActive = offset === 0;
            const visible = abs <= 2;
            const tx = offset * 55; // % translate
            const rotY = offset * -28;
            const scale = isActive ? 1 : abs === 1 ? 0.82 : 0.66;
            const opacity = visible ? (isActive ? 1 : abs === 1 ? 0.85 : 0.45) : 0;
            const z = 100 - abs;
            const Icon = s.icon;

            return (
              <Link
                key={s.key}
                to={s.to}
                aria-hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={(e) => { if (!isActive) { e.preventDefault(); setActive(i); } }}
                className={`absolute inset-0 mx-auto max-w-[88%] rounded-3xl overflow-hidden bg-gradient-to-br ${s.bg} transition-all duration-700 ease-out will-change-transform`}
                style={{
                  transform: `translateX(${tx}%) translateZ(${isActive ? 0 : -120}px) rotateY(${rotY}deg) scale(${scale})`,
                  opacity,
                  zIndex: z,
                  boxShadow: isActive
                    ? "0 30px 60px -20px rgba(0,0,0,0.55), 0 18px 35px -15px rgba(0,0,0,0.4)"
                    : "0 18px 40px -20px rgba(0,0,0,0.5)",
                  pointerEvents: visible ? "auto" : "none",
                }}
              >
                {s.image && (
                  <img src={s.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10" />
                <div className="relative h-full p-4 flex flex-col justify-between text-white z-10">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-95">
                    <Sparkles className="w-3 h-3" /> {s.kind}
                  </div>
                  <div className="max-w-[70%]">
                    <h3 className="text-xl font-extrabold leading-tight line-clamp-1 drop-shadow-md">{s.title}</h3>
                    <p className="text-xs opacity-95 mt-1 line-clamp-2 drop-shadow">{s.subtitle}</p>
                    <span className="mt-2 inline-block bg-white text-foreground text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg">{s.cta}</span>
                  </div>
                </div>
                <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-20 h-20 text-white/25 z-0" strokeWidth={1.3} />
              </Link>
            );
          })}
        </div>

        {/* Reflection / ground shadow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-14px] w-[70%] h-6 rounded-[50%]"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35), rgba(0,0,0,0) 70%)",
            filter: "blur(6px)",
          }}
        />
      </div>

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-foreground" : "w-1.5 bg-foreground/30"}`}
          />
        ))}
      </div>
    </section>
  );
}
