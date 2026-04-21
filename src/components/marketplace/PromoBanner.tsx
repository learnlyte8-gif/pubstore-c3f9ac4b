import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShoppingBag, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  bg: string;
  image?: string | null;
};

const GRADIENTS = [
  "from-indigo-600 via-purple-600 to-pink-600",
  "from-rose-500 via-orange-500 to-amber-500",
  "from-emerald-500 via-teal-500 to-cyan-600",
  "from-fuchsia-600 via-pink-600 to-rose-500",
  "from-sky-600 via-blue-600 to-indigo-700",
];

async function buildSlides(): Promise<Slide[]> {
  const slides: Slide[] = [];
  const now = new Date().toISOString();

  // 1. Live flash deal (deal_ends_at in future)
  const { data: deals } = await supabase
    .from("products")
    .select("id,title,image,price,original_price,deal_ends_at")
    .eq("active", true)
    .not("deal_ends_at", "is", null)
    .gt("deal_ends_at", now)
    .order("deal_ends_at", { ascending: true })
    .limit(1);
  if (deals?.[0]) {
    const d = deals[0];
    const off = d.original_price && d.original_price > d.price
      ? Math.round(((Number(d.original_price) - Number(d.price)) / Number(d.original_price)) * 100)
      : null;
    slides.push({
      key: `deal-${d.id}`,
      title: off ? `${off}% OFF Today` : "Flash Deal",
      subtitle: d.title,
      cta: "Grab it",
      to: `/product/${d.id}`,
      bg: GRADIENTS[0],
      image: d.image,
    });
  }

  // 2. Newest hot product
  const { data: hot } = await supabase
    .from("products")
    .select("id,title,image,sold")
    .eq("active", true)
    .order("sold", { ascending: false })
    .limit(1);
  if (hot?.[0]) {
    slides.push({
      key: `hot-${hot[0].id}`,
      title: "Trending now",
      subtitle: hot[0].title,
      cta: "Shop now",
      to: `/product/${hot[0].id}`,
      bg: GRADIENTS[1],
      image: hot[0].image,
    });
  }

  // 3. Featured supplier (gold first)
  const { data: sup } = await supabase
    .from("suppliers")
    .select("id,name,country,banner,gold,verified")
    .or("gold.eq.true,verified.eq.true")
    .order("rating", { ascending: false })
    .limit(1);
  if (sup?.[0]) {
    slides.push({
      key: `sup-${sup[0].id}`,
      title: sup[0].gold ? "Gold Supplier" : "Verified Store",
      subtitle: `${sup[0].name}${sup[0].country ? ` · ${sup[0].country}` : ""}`,
      cta: "Visit store",
      to: `/supplier/${sup[0].id}`,
      bg: GRADIENTS[2],
      image: sup[0].banner,
    });
  }

  return slides;
}

const FALLBACK: Slide[] = [
  {
    key: "fb-1",
    title: "Welcome to PUBSTORE",
    subtitle: "Source verified suppliers worldwide",
    cta: "Explore",
    to: "/categories",
    bg: GRADIENTS[0],
  },
];

export default function PromoBanner() {
  const { data } = useQuery({ queryKey: ["promo-slides"], queryFn: buildSlides, staleTime: 60_000 });
  const slides = data && data.length > 0 ? data : FALLBACK;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[i % slides.length];

  return (
    <section className="px-4 mt-3">
      <Link
        to={s.to}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${s.bg} h-32 px-5 flex items-center transition-all duration-700 shadow-elevated`}
      >
        {s.image && (
          <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" loading="lazy" />
        )}
        <div className="relative text-white max-w-[60%]">
          <p className="text-xs font-medium uppercase tracking-wider opacity-90 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> PUBSTORE
          </p>
          <h3 className="text-xl font-bold leading-tight mt-0.5 line-clamp-1">{s.title}</h3>
          <p className="text-xs opacity-95 mt-0.5 line-clamp-2">{s.subtitle}</p>
          <span className="mt-2 inline-block bg-white text-foreground text-xs font-semibold px-3 py-1.5 rounded-full">
            {s.cta}
          </span>
        </div>
        <ShoppingBag className="absolute right-5 top-1/2 -translate-y-1/2 w-20 h-20 text-white/25" strokeWidth={1.4} />
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={`h-1 rounded-full transition-all ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </Link>
    </section>
  );
}
