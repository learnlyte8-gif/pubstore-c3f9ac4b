import { useEffect, useState } from "react";
import { TrendingUp, Sparkles, LayoutGrid, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CategoryGrid from "@/components/marketplace/CategoryGrid";
import PromoBanner from "@/components/marketplace/PromoBanner";
import FlashDeals from "@/components/marketplace/FlashDeals";
import ProductCard from "@/components/marketplace/ProductCard";
import { TRENDING, PRODUCTS, getRecommended } from "@/data/products";

const Home = () => {
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

  return (
    <div className="pb-6">
      {name && (
        <div className="px-4 pt-4">
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
      )}

      <PromoBanner />
      <CategoryGrid />
      <FlashDeals />

      <section className="px-4 mt-6">
        <SectionHeader icon={TrendingUp} title="Trending now" subtitle="Most loved this week" />
        <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
          {TRENDING.map((p) => (
            <ProductCard key={p.id} product={p} variant="compact" />
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <SectionHeader icon={Sparkles} title="For you" subtitle="Picked from your interests" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          {recommended.slice(0, 12).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="px-4 mt-6">
        <SectionHeader icon={LayoutGrid} title="Explore more" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
};

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
          <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center mt-0.5 shadow-soft">
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
