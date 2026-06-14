import { useProducts } from "@/hooks/useCatalog";
import ProductCard from "./ProductCard";
import { Heart } from "lucide-react";

export default function RecommendationStrip({ title = "Because you browsed", subtitle = "Hand-picked for you" }: { title?: string; subtitle?: string }) {
  const { data = [] } = useProducts({ sortBy: "rating", limit: 8 });
  if (data.length === 0) return null;
  return (
    <div className="col-span-2 rounded-2xl border border-border bg-card shadow-card p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg bg-ig-gradient flex items-center justify-center shadow-pop">
          <Heart className="w-3.5 h-3.5 text-white fill-white" />
        </span>
        <div>
          <p className="text-sm font-extrabold leading-tight">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {data.map((p) => (
          <ProductCard key={`rec-${p.id}`} product={p} variant="compact" />
        ))}
      </div>
    </div>
  );
}
