import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ShoppingBag,
  Briefcase,
  BedDouble,
  Car,
  UtensilsCrossed,
  Wrench,
  Home,
  Factory,
  Sprout,
  Banknote,
  Key,
  Newspaper,
  Radio,
  Store,
  Heart,
  Star,
  MapPin,
  Clock,
  Sparkles,
  ShieldCheck,
  Award,
  Flame,
  Truck,
  Package,
  Plus,
  Timer,
  Gauge,
  Fuel,
  Cog,
  Users,
  Bed,
  Bath,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/useCatalog";
import { useInfiniteProducts } from "@/hooks/useInfiniteProducts";
import ProductCard from "./ProductCard";
import MasonryGrid from "./MasonryGrid";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";
import { fetchJobs } from "@/data/jobs";
import { fetchRestaurants } from "@/data/restaurants";
import { fetchNews, fetchStays, fetchVehicles, fetchIndustrial, fetchAgro } from "@/data/verticals";
import { fetchServiceProviders, fetchProperties, fetchCarRentals, fetchFinanceProducts } from "@/data/newVerticals";
import type { Product } from "@/data/products";
import type { JobPosting } from "@/data/jobs";
import type { Restaurant } from "@/data/restaurants";
import type { NewsArticle, Stay, Vehicle, IndustrialListing, AgroListing } from "@/data/verticals";
import type { ServiceProvider, Property, CarRental, FinanceProduct } from "@/data/newVerticals";

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function interleave(items: MixedItem[]): MixedItem[] {
  const products = shuffle(items.filter((it) => it.type === "product"));
  const others = shuffle(items.filter((it) => it.type !== "product"));

  const result: MixedItem[] = [];
  let p = 0;
  let o = 0;
  while (p < products.length || o < others.length) {
    // Place products more frequently than any single service (2 products per 1 other).
    if (p < products.length) result.push(products[p++]);
    if (p < products.length) result.push(products[p++]);
    if (o < others.length) result.push(others[o++]);
  }
  return result;
}

const fmtPrice = (n: number, currency = "$") => `${currency}${n.toLocaleString()}`;

// ============================================================
// Unified card data
// ============================================================

type MetaChip = { icon: LucideIcon; text: string };
type MenuPreview = { id: string; name: string; price: number; currency?: string; image: string | null };

type MixedItem = {
  id: string;
  type: string;
  label: string;
  icon: LucideIcon;
  href: string;
  image: string;
  title: string;
  subtitle?: string;
  price?: string;
  priceSub?: string;
  description?: string;
  rating?: number;
  sold?: number;
  badge?: string;
  saveKind?: "agro" | "stay" | "property" | "service" | "industrial" | "car-rental" | "finance" | "news";
  product?: Product;
  meta?: MetaChip[];
  menu?: MenuPreview[];
};

function normalizeProduct(p: Product): MixedItem {
  return {
    id: p.id,
    type: "product",
    label: "Product",
    icon: ShoppingBag,
    href: `/product/${p.id}`,
    image: p.image,
    title: p.title,
    subtitle: p.supplierName ? `${p.supplierName}${p.supplierLocation ? ` · ${p.supplierLocation}` : ""}` : undefined,
    price: fmtPrice(p.price),
    rating: p.rating,
    sold: p.sold,
    badge: p.badge,
    product: p,
  };
}

function normalizeJob(j: JobPosting): MixedItem {
  const salary = j.salary_min ? `${j.salary_currency} ${j.salary_min}+` : "Competitive";
  return {
    id: j.id,
    type: "job",
    label: "Job",
    icon: Briefcase,
    href: "/jobs",
    image: "/placeholder.svg",
    title: j.title,
    subtitle: [j.category, j.city, j.workplace_type?.replace("_", " ")].filter(Boolean).join(" · "),
    price: salary,
    badge: j.featured ? "Featured" : "New",
  };
}

function normalizeNews(n: NewsArticle): MixedItem {
  return {
    id: n.id,
    type: "news",
    label: "News",
    icon: Newspaper,
    href: `/news/${n.slug}`,
    image: n.cover ?? "/placeholder.svg",
    title: n.title,
    subtitle: `${n.category} · ${ago(n.published_at)} ago`,
    saveKind: "news",
  };
}

function normalizeRestaurant(r: Restaurant): MixedItem {
  return {
    id: r.id,
    type: "restaurant",
    label: "Food",
    icon: UtensilsCrossed,
    href: `/restaurants/${r.id}`,
    image: r.cover ?? "/placeholder.svg",
    title: r.name,
    subtitle: [r.cuisine, r.city].filter(Boolean).join(" · "),
    rating: r.rating,
    badge: r.delivery_enabled ? "Delivery" : undefined,
  };
}

function normalizeStay(s: Stay): MixedItem {
  return {
    id: s.id,
    type: "stay",
    label: "Stay",
    icon: BedDouble,
    href: `/stays/${s.id}`,
    image: s.cover ?? "/placeholder.svg",
    title: s.title,
    subtitle: [s.city, s.country].filter(Boolean).join(", "),
    price: `$${Math.round(s.price_per_night)}/night`,
    rating: s.rating,
    badge: s.superhost ? "Superhost" : undefined,
    saveKind: "stay",
  };
}

function normalizeVehicle(v: Vehicle): MixedItem {
  return {
    id: v.id,
    type: "vehicle",
    label: "Auto",
    icon: Car,
    href: `/auto/${v.id}`,
    image: v.cover ?? "/placeholder.svg",
    title: v.title,
    subtitle: [v.year, v.make, v.model, v.condition].filter(Boolean).join(" · "),
    price: fmtPrice(v.price),
    badge: v.badge ?? undefined,
  };
}

function normalizeService(p: ServiceProvider): MixedItem {
  return {
    id: p.id,
    type: "service",
    label: "Service",
    icon: Wrench,
    href: "/services",
    image: p.cover ?? "/placeholder.svg",
    title: p.display_name,
    subtitle: [p.category, p.city].filter(Boolean).join(" · "),
    price: p.hourly_rate ? `$${p.hourly_rate}/hr` : undefined,
    rating: p.rating,
    saveKind: "service",
  };
}

function normalizeProperty(p: Property): MixedItem {
  return {
    id: p.id,
    type: "property",
    label: "Property",
    icon: Home,
    href: "/properties",
    image: p.cover ?? "/placeholder.svg",
    title: p.title,
    subtitle: [p.listing_type, p.city].filter(Boolean).join(" · "),
    price: `$${Number(p.price).toLocaleString()}${p.price_period === "rent" || p.price_period === "shared" ? `/${p.price_period}` : ""}`,
    saveKind: "property",
  };
}

function normalizeIndustrial(it: IndustrialListing): MixedItem {
  return {
    id: it.id,
    type: "industrial",
    label: "Industrial",
    icon: Factory,
    href: `/industrial/${it.id}`,
    image: it.cover ?? "/placeholder.svg",
    title: it.title,
    subtitle: [it.category, it.subcategory].filter(Boolean).join(" · "),
    price: it.price != null ? fmtPrice(it.price) : "Quote",
    saveKind: "industrial",
  };
}

function normalizeAgro(it: AgroListing): MixedItem {
  return {
    id: it.id,
    type: "agro",
    label: "Agro",
    icon: Sprout,
    href: `/agro/${it.id}`,
    image: it.cover ?? "/placeholder.svg",
    title: it.title,
    subtitle: [it.kind, it.subcategory].filter(Boolean).join(" · "),
    price: it.price != null ? fmtPrice(it.price) : undefined,
    badge: it.organic ? "Organic" : undefined,
    saveKind: "agro",
  };
}

function normalizeFinance(p: FinanceProduct): MixedItem {
  return {
    id: p.id,
    type: "finance",
    label: "Finance",
    icon: Banknote,
    href: "/finance",
    image: p.cover ?? "/placeholder.svg",
    title: p.title,
    subtitle: p.kind.replace("_", " "),
    price: p.max_amount ? `up to $${p.max_amount.toLocaleString()}` : undefined,
    saveKind: "finance",
  };
}

function normalizeCarRental(r: CarRental): MixedItem {
  return {
    id: r.id,
    type: "car-rental",
    label: "Rental",
    icon: Key,
    href: `/car-rentals/${r.id}`,
    image: r.cover ?? "/placeholder.svg",
    title: r.title,
    subtitle: [r.vehicle_class, r.transmission, r.city].filter(Boolean).join(" · "),
    price: `$${r.price_per_day}/day`,
    badge: r.verified ? "Verified" : undefined,
    saveKind: "car-rental",
  };
}

function normalizeLive(s: any): MixedItem {
  return {
    id: s.id,
    type: "live",
    label: "Live",
    icon: Radio,
    href: `/live/${s.id}`,
    image: s.cover ?? "/placeholder.svg",
    title: s.title,
    subtitle: s.suppliers?.name,
    badge: "LIVE",
  };
}

function normalizeSupplier(s: any): MixedItem {
  return {
    id: s.id,
    type: "supplier",
    label: s.gold ? "Gold Supplier" : "Verified Supplier",
    icon: Store,
    href: `/supplier/${s.id}`,
    image: s.banner ?? "/placeholder.svg",
    title: s.name,
    subtitle: s.country,
    rating: s.rating,
    badge: s.gold ? "Gold" : s.verified ? "Verified" : undefined,
  };
}

// ============================================================
// Component
// ============================================================

export interface MixedFeedProps {
  verticals?: string[];
  tradeMode?: "all" | "retail" | "wholesale";
}

export default function MixedFeed({ verticals = [], tradeMode = "all" }: MixedFeedProps) {
  const showShop = verticals.length === 0 || verticals.includes("shop") || verticals.includes("market");
  const showJobs = verticals.length === 0 || verticals.includes("jobs");
  const showNews = verticals.length === 0 || verticals.includes("news");
  const showRestaurants = verticals.length === 0 || verticals.includes("restaurants");
  const showStays = verticals.length === 0 || verticals.includes("stays");
  const showVehicles = verticals.length === 0 || verticals.includes("vehicles");
  const showServices = verticals.length === 0 || verticals.includes("services");
  const showProperties = verticals.length === 0 || verticals.includes("properties");
  const showFinance = verticals.length === 0 || verticals.includes("finance");
  const showIndustrial = verticals.length === 0 || verticals.includes("industrial");
  const showAgro = verticals.length === 0 || verticals.includes("agro");
  const showCarRentals = verticals.length === 0 || verticals.includes("car_rentals");
  const showSuppliers = verticals.length === 0 || true; // always a few suppliers

  const productsQ = useInfiniteProducts({ tradeMode, pageSize: 24 });
  const jobsQ = useQuery({ queryKey: ["home-jobs"], queryFn: () => fetchJobs({ limit: 6 }), enabled: showJobs });
  const newsQ = useQuery({ queryKey: ["home-news"], queryFn: () => fetchNews({ limit: 4 }), enabled: showNews });
  const restaurantsQ = useQuery({ queryKey: ["home-restaurants"], queryFn: () => fetchRestaurants({ limit: 6 }), enabled: showRestaurants });
  const staysQ = useQuery({ queryKey: ["home-stays"], queryFn: () => fetchStays({ limit: 6 }), enabled: showStays });
  const vehiclesQ = useQuery({ queryKey: ["home-vehicles"], queryFn: () => fetchVehicles({ limit: 6 }), enabled: showVehicles });
  const servicesQ = useQuery({ queryKey: ["home-services"], queryFn: () => fetchServiceProviders({ limit: 6 }), enabled: showServices });
  const propertiesQ = useQuery({ queryKey: ["home-properties"], queryFn: () => fetchProperties({ limit: 6 }), enabled: showProperties });
  const industrialQ = useQuery({ queryKey: ["home-industrial"], queryFn: () => fetchIndustrial({ limit: 6 }), enabled: showIndustrial });
  const agroQ = useQuery({ queryKey: ["home-agro"], queryFn: () => fetchAgro({ limit: 6 }), enabled: showAgro });
  const financeQ = useQuery({ queryKey: ["home-finance"], queryFn: () => fetchFinanceProducts({ limit: 6 }), enabled: showFinance });
  const carRentalsQ = useQuery({ queryKey: ["home-car-rentals"], queryFn: () => fetchCarRentals({ limit: 6 }), enabled: showCarRentals });
  const suppliersQ = useQuery({
    queryKey: ["home-suppliers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name,country,logo,banner,gold,verified,rating")
        .or("gold.eq.true,verified.eq.true")
        .order("rating", { ascending: false })
        .limit(4);
      return (data ?? []) as any[];
    },
  });
  const liveQ = useQuery({
    queryKey: ["home-live"],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id,title,cover,viewer_count,supplier_id,suppliers(name,logo)")
        .eq("status", "live")
        .order("viewer_count", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const isLoading =
    productsQ.isLoading ||
    jobsQ.isLoading ||
    newsQ.isLoading ||
    restaurantsQ.isLoading ||
    staysQ.isLoading ||
    vehiclesQ.isLoading ||
    servicesQ.isLoading ||
    propertiesQ.isLoading ||
    industrialQ.isLoading ||
    agroQ.isLoading ||
    financeQ.isLoading ||
    carRentalsQ.isLoading ||
    suppliersQ.isLoading ||
    liveQ.isLoading;

  const items = useMemo(() => {
    const all: MixedItem[] = [];
    if (showShop) all.push(...(productsQ.items ?? []).map(normalizeProduct));
    if (showJobs) all.push(...(jobsQ.data ?? []).slice(0, 6).map(normalizeJob));
    if (showNews) all.push(...(newsQ.data ?? []).slice(0, 4).map(normalizeNews));
    if (showRestaurants) all.push(...(restaurantsQ.data ?? []).slice(0, 6).map(normalizeRestaurant));
    if (showStays) all.push(...(staysQ.data ?? []).slice(0, 6).map(normalizeStay));
    if (showVehicles) all.push(...(vehiclesQ.data ?? []).slice(0, 6).map(normalizeVehicle));
    if (showServices) all.push(...(servicesQ.data ?? []).slice(0, 6).map(normalizeService));
    if (showProperties) all.push(...(propertiesQ.data ?? []).slice(0, 6).map(normalizeProperty));
    if (showIndustrial) all.push(...(industrialQ.data ?? []).slice(0, 6).map(normalizeIndustrial));
    if (showAgro) all.push(...(agroQ.data ?? []).slice(0, 6).map(normalizeAgro));
    if (showFinance) all.push(...(financeQ.data ?? []).slice(0, 6).map(normalizeFinance));
    if (showCarRentals) all.push(...(carRentalsQ.data ?? []).slice(0, 6).map(normalizeCarRental));
    if (showSuppliers) all.push(...(suppliersQ.data ?? []).slice(0, 4).map(normalizeSupplier));
    all.push(...((liveQ.data as any[]) ?? []).slice(0, 4).map(normalizeLive));
    if (all.length === 0) return [];
    return interleave(all);
  }, [
    showShop,
    showJobs,
    showNews,
    showRestaurants,
    showStays,
    showVehicles,
    showServices,
    showProperties,
    showIndustrial,
    showAgro,
    showFinance,
    showCarRentals,
    showSuppliers,
    productsQ.items,
    jobsQ.data,
    newsQ.data,
    restaurantsQ.data,
    staysQ.data,
    vehiclesQ.data,
    servicesQ.data,
    propertiesQ.data,
    industrialQ.data,
    agroQ.data,
    financeQ.data,
    carRentalsQ.data,
    suppliersQ.data,
    liveQ.data,
  ]);

  if (isLoading) {
    return (
      <section className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="px-4 mt-8 text-center">
        <p className="text-sm font-semibold">Nothing here yet</p>
        <p className="text-xs text-muted-foreground mt-1">Check back when more listings go live.</p>
      </section>
    );
  }

  return (
    <section className="px-4 mt-4 animate-fade-in">
      <MasonryGrid>
        {items.map((item) =>
          item.type === "product" && item.product ? (
            <ProductCard key={`product-${item.id}`} product={item.product} />
          ) : (
            <MixedCard key={`${item.type}-${item.id}`} item={item} />
          )
        )}
      </MasonryGrid>
      {showShop && (
        <InfiniteScrollSentinel
          hasMore={!!productsQ.hasNextPage}
          isLoading={productsQ.isFetchingNextPage}
          onLoadMore={() => productsQ.fetchNextPage()}
        />
      )}
    </section>
  );
}

// ============================================================
// Card renderer
// ============================================================

function MixedCard({ item }: { item: MixedItem }) {
  const { toggleWishlist, isWishlisted, addToCart } = useShop();
  const liked = item.type === "product" ? isWishlisted(item.id) : false;

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.type !== "product") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to save items");
      return;
    }
    const wasLiked = liked;
    await toggleWishlist(item.id);
    toast.success(wasLiked ? "Removed from wishlist" : "Saved to wishlist");
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item.product) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sign in to add to cart");
      return;
    }
    addToCart(item.product.id, item.product.moq);
    toast.success("Added to cart", { description: item.product.title });
  };

  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      className="group relative block rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition overflow-hidden"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {item.image === "/placeholder.svg" || !item.image ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Icon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        ) : (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition" />

        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/95 backdrop-blur text-[9px] font-bold uppercase tracking-wider text-foreground shadow-soft">
          <Icon className="w-3 h-3 text-primary" />
          {item.label}
        </span>

        {item.badge && item.type !== "live" && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold uppercase tracking-wider shadow-soft">
            {item.badge}
          </span>
        )}

        {item.type === "product" && (
          <button
            onClick={handleLike}
            aria-label={liked ? "Remove from wishlist" : "Save to wishlist"}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-background/90 backdrop-blur shadow-soft flex items-center justify-center active:scale-90 transition"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
          </button>
        )}

      </div>

      <div className="p-2.5">
        <p className="text-xs font-bold leading-snug overflow-hidden whitespace-nowrap text-ellipsis break-words">{item.title}</p>
        {item.subtitle && (
          <p className="text-[10px] text-muted-foreground overflow-hidden whitespace-nowrap text-ellipsis break-words mt-0.5">{item.subtitle}</p>
        )}

        <div className="pt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {item.price && (
              <p className="text-sm font-black tracking-tight text-destructive truncate">{item.price}</p>
            )}
            {item.rating != null && item.rating > 0 && (
              <p className="text-[10px] flex items-center gap-1 text-muted-foreground">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{item.rating.toFixed(1)}</span>
                {item.sold != null && item.sold > 0 && <span>· {item.sold.toLocaleString()} sold</span>}
              </p>
            )}
          </div>

          {item.type === "product" && item.product && (
            <button
              onClick={handleAdd}
              aria-label="Add to cart"
              className="shrink-0 h-8 px-2.5 rounded-lg bg-foreground text-background text-[10px] font-bold flex items-center gap-1 hover:opacity-90 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>

        {item.type === "product" && item.product && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[8px] font-bold border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> Trade Assurance
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
