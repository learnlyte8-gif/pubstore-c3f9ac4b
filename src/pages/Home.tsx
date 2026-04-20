import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Mic, TrendingUp, Sparkles, LayoutGrid, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CategoryGrid from "@/components/marketplace/CategoryGrid";
import PromoBanner from "@/components/marketplace/PromoBanner";
import FlashDeals from "@/components/marketplace/FlashDeals";
import ProductCard from "@/components/marketplace/ProductCard";
import { TRENDING, PRODUCTS, getRecommended, type Product } from "@/data/products";

const Home = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("interests, display_name, username")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        setInterests(data.interests ?? []);
        setName(data.display_name || data.username || "");
      }
    });
  }, []);

  const recommended = getRecommended(interests);
  const filtered: Product[] = query
    ? PRODUCTS.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
    : recommended;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search results inline; later route to /search
  };

  return (
    <div className="pb-6">
      {/* Search bar */}
      <section className="sticky top-12 z-30 bg-background/95 backdrop-blur border-b border-border">
        <form onSubmit={onSubmit} className="px-4 py-2.5 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands & shops"
              className="w-full h-10 bg-muted rounded-full pl-9 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Mic className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <button
            type="button"
            aria-label="Filters"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </form>
      </section>


function SectionHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex items-start gap-2">
        {Icon && (
          <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center mt-0.5">
            <Icon className="w-4 h-4 text-foreground" strokeWidth={1.8} />
          </span>
        )}
        <div>
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <button className="text-xs text-primary font-semibold">See all</button>
    </div>
  );
}

export default Home;
