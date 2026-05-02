import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShoppingBag, Sparkles, Flame, BedDouble, Car, Factory, Newspaper, Radio, Crown, Navigation, Wrench, Home as HomeIcon, Truck, Banknote, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Slide = {
  key: string;
  kind: string;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  bg: string;
  image?: string | null;
  icon: typeof ShoppingBag;
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

  // Run all queries in parallel
  const [deals, hot, sup, stays, vehicles, industrial, news, lives, services, properties, finance, carRentals] = await Promise.all([
    supabase.from("products").select("id,title,image,price,original_price,deal_ends_at").eq("active", true).not("deal_ends_at", "is", null).gt("deal_ends_at", now).order("deal_ends_at", { ascending: true }).limit(2),
    supabase.from("products").select("id,title,image,sold").eq("active", true).order("sold", { ascending: false }).limit(2),
    supabase.from("suppliers").select("id,name,country,banner,gold,verified").or("gold.eq.true,verified.eq.true").order("rating", { ascending: false }).limit(2),
    supabase.from("stays").select("id,title,city,country,cover,price_per_night").eq("active", true).order("rating", { ascending: false }).limit(2),
    supabase.from("vehicles").select("id,title,make,model,year,cover,price").eq("active", true).order("created_at", { ascending: false }).limit(2),
    supabase.from("industrial_listings").select("id,title,category,cover,price").eq("active", true).order("created_at", { ascending: false }).limit(2),
    supabase.from("news_articles").select("id,slug,title,dek,cover").eq("featured", true).order("published_at", { ascending: false }).limit(2),
    supabase.from("live_streams").select("id,title,cover,viewer_count").eq("status", "live").order("viewer_count", { ascending: false }).limit(2),
    supabase.from("service_providers").select("id,display_name,category,cover,hourly_rate,city").eq("active", true).order("rating", { ascending: false }).limit(2),
    supabase.from("properties").select("id,title,city,cover,price,listing_type,price_period").eq("active", true).order("featured", { ascending: false }).limit(2),
    supabase.from("finance_products").select("id,title,kind,cover,interest_rate,provider_name").eq("active", true).order("featured", { ascending: false }).limit(2),
    supabase.from("car_rentals").select("id,title,make,model,year,vehicle_class,cover,price_per_day,city,unlimited_km").eq("active", true).order("featured", { ascending: false }).order("rating", { ascending: false }).limit(2),
  ]);

  let g = 0;
  const nextG = () => GRADIENTS[g++ % GRADIENTS.length];

  (deals.data ?? []).forEach((d: any) => {
    const off = d.original_price && d.original_price > d.price
      ? Math.round(((Number(d.original_price) - Number(d.price)) / Number(d.original_price)) * 100)
      : null;
    slides.push({
      key: `deal-${d.id}`, kind: "Flash deal",
      title: off ? `${off}% OFF Today` : "Flash Deal",
      subtitle: d.title, cta: "Grab it",
      to: `/product/${d.id}`, bg: nextG(), image: d.image, icon: Flame,
    });
  });

  (lives.data ?? []).forEach((l: any) => slides.push({
    key: `live-${l.id}`, kind: "Live now",
    title: "🔴 Live now",
    subtitle: l.title, cta: "Join stream",
    to: `/live/${l.id}`, bg: "from-rose-600 via-red-600 to-orange-500",
    image: l.cover, icon: Radio,
  }));

  (hot.data ?? []).forEach((h: any) => slides.push({
    key: `hot-${h.id}`, kind: "Trending",
    title: "Trending now",
    subtitle: h.title, cta: "Shop now",
    to: `/product/${h.id}`, bg: nextG(), image: h.image, icon: Sparkles,
  }));

  (stays.data ?? []).forEach((s: any) => slides.push({
    key: `stay-${s.id}`, kind: "Stays",
    title: `From $${Number(s.price_per_night).toFixed(0)}/night`,
    subtitle: `${s.title}${s.city ? ` · ${s.city}` : ""}`,
    cta: "Book stay",
    to: `/stays`, bg: nextG(), image: s.cover, icon: BedDouble,
  }));

  (vehicles.data ?? []).forEach((v: any) => slides.push({
    key: `veh-${v.id}`, kind: "Vehicles",
    title: `$${Number(v.price).toLocaleString()}`,
    subtitle: `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? v.title}`.trim(),
    cta: "View vehicle",
    to: `/auto`, bg: nextG(), image: v.cover, icon: Car,
  }));

  (industrial.data ?? []).forEach((it: any) => slides.push({
    key: `ind-${it.id}`, kind: "Industrial",
    title: it.price ? `From $${Number(it.price).toLocaleString()}` : "Industrial",
    subtitle: it.title, cta: "Request quote",
    to: `/industrial`, bg: nextG(), image: it.cover, icon: Factory,
  }));

  (sup.data ?? []).forEach((s: any) => slides.push({
    key: `sup-${s.id}`, kind: "Supplier",
    title: s.gold ? "Gold Supplier" : "Verified Store",
    subtitle: `${s.name}${s.country ? ` · ${s.country}` : ""}`,
    cta: "Visit store",
    to: `/supplier/${s.id}`, bg: nextG(), image: s.banner, icon: Crown,
  }));

  (news.data ?? []).forEach((n: any) => slides.push({
    key: `news-${n.id}`, kind: "News",
    title: "Editorial",
    subtitle: n.title, cta: "Read story",
    to: `/news/${n.slug}`, bg: nextG(), image: n.cover, icon: Newspaper,
  }));

  (services.data ?? []).forEach((sv: any) => slides.push({
    key: `svc-${sv.id}`, kind: "Local pro",
    title: sv.hourly_rate ? `From $${sv.hourly_rate}/hr` : "Trusted pro",
    subtitle: `${sv.display_name} · ${sv.category}${sv.city ? ` · ${sv.city}` : ""}`,
    cta: "Hire now", to: `/services`, bg: nextG(), image: sv.cover, icon: Wrench,
  }));

  (properties.data ?? []).forEach((pr: any) => slides.push({
    key: `prop-${pr.id}`, kind: "Real estate",
    title: `$${Number(pr.price).toLocaleString()}${pr.listing_type === "rent" ? `/${pr.price_period}` : ""}`,
    subtitle: `${pr.title}${pr.city ? ` · ${pr.city}` : ""}`,
    cta: pr.listing_type === "sale" ? "View property" : "Book viewing",
    to: `/properties`, bg: nextG(), image: pr.cover, icon: HomeIcon,
  }));

  (finance.data ?? []).forEach((fp: any) => slides.push({
    key: `fin-${fp.id}`, kind: "Finance",
    title: fp.interest_rate != null ? `${fp.interest_rate}% APR` : "Get funded",
    subtitle: `${fp.title}${fp.provider_name ? ` · ${fp.provider_name}` : ""}`,
    cta: "Apply now", to: `/finance`, bg: nextG(), image: fp.cover, icon: Banknote,
  }));

  (carRentals.data ?? []).forEach((c: any) => slides.push({
    key: `car-${c.id}`, kind: "Car rental",
    title: `$${Number(c.price_per_day).toFixed(0)}/day${c.unlimited_km ? " · ∞ km" : ""}`,
    subtitle: `${c.year ?? ""} ${c.make ?? ""} ${c.model ?? c.title}${c.city ? ` · ${c.city}` : ""}`.trim(),
    cta: "Rent now",
    to: `/car-rentals/${c.id}`,
    bg: "from-orange-600 via-amber-600 to-yellow-500",
    image: c.cover, icon: Key,
  }));

  // Always advertise car rentals (fallback CTA)
  slides.push({
    key: "car-rentals-cta", kind: "Drive",
    title: "Keys in 60 seconds",
    subtitle: "Self-drive rentals — daily, weekly, monthly.",
    cta: "Browse fleet", to: "/car-rentals",
    bg: "from-orange-600 via-amber-600 to-yellow-500",
    image: null, icon: Key,
  });

  // Always advertise the rides system
  slides.push({
    key: "rides-cta", kind: "Rides",
    title: "Fair-fare rides",
    subtitle: "Set your price. Real drivers nearby.",
    cta: "Open rides", to: "/rides",
    bg: "from-emerald-500 via-teal-500 to-cyan-600",
    image: null, icon: Navigation,
  });

  // Always advertise logistics
  slides.push({
    key: "logistics-cta", kind: "Delivery",
    title: "Send anything, anywhere",
    subtitle: "Bike, car, van or truck — drivers bid on your delivery.",
    cta: "Request delivery", to: "/logistics",
    bg: "from-orange-600 via-red-600 to-rose-600",
    image: null, icon: Truck,
  });

  // Shuffle to mix verticals (but keep deal/live early)
  const head = slides.slice(0, 4);
  const tail = slides.slice(4).sort(() => Math.random() - 0.5);
  return [...head, ...tail];
}

const FALLBACK: Slide[] = [{
  key: "fb-1", kind: "Welcome",
  title: "Welcome to PUBSTORE",
  subtitle: "Source verified suppliers worldwide",
  cta: "Explore", to: "/categories",
  bg: GRADIENTS[0], icon: ShoppingBag,
}];

export default function PromoBanner() {
  const { data } = useQuery({ queryKey: ["promo-slides-v3"], queryFn: buildSlides, staleTime: 60_000 });
  const slides = data && data.length > 0 ? data : FALLBACK;
  const [i, setI] = useState(0);

  // Auto-cycle every 3.5s for that "always sliding" feel
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 3500);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[i % slides.length];
  const Icon = s.icon;

  return (
    <section className="px-4 mt-3">
      <Link
        to={s.to}
        key={s.key}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${s.bg} h-32 px-5 flex items-center transition-all duration-700 shadow-elevated animate-fade-in`}
      >
        {s.image && (
          <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" loading="lazy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />
        <div className="relative text-white max-w-[62%] z-10">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {s.kind}
          </p>
          <h3 className="text-xl font-bold leading-tight mt-0.5 line-clamp-1">{s.title}</h3>
          <p className="text-xs opacity-95 mt-0.5 line-clamp-2">{s.subtitle}</p>
          <span className="mt-2 inline-block bg-white text-foreground text-xs font-semibold px-3 py-1.5 rounded-full">
            {s.cta}
          </span>
        </div>
        <Icon className="absolute right-5 top-1/2 -translate-y-1/2 w-20 h-20 text-white/30 z-0" strokeWidth={1.4} />
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {slides.slice(0, Math.min(slides.length, 10)).map((_, idx) => (
              <span
                key={idx}
                className={`h-1 rounded-full transition-all ${idx === i % Math.min(slides.length, 10) ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </Link>
    </section>
  );
}
