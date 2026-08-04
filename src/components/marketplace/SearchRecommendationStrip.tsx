import { Sparkles } from "lucide-react";
import ProductCard from "./ProductCard";
import { useSearchRecommendations } from "@/hooks/useSearchRecommendations";

/**
 * "Because you searched" — semantic/AI recommendations built from the
 * shopper's most recent search phrases. Renders nothing for shoppers who
 * haven't searched yet.
 */
export default function SearchRecommendationStrip({ limit = 12 }: { limit?: number }) {
  const { data, isLoading } = useSearchRecommendations(limit);
  const products = data?.products ?? [];
  const queries = data?.queries ?? [];

  if (!isLoading && products.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg bg-ig-gradient flex items-center justify-center shadow-pop">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-tight">Because you searched</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {queries.length ? `AI matches for “${queries[0]}”` : "AI-matched to your searches"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-1 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 w-32 shrink-0 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {products.map((p) => (
            <ProductCard key={`sreco-${p.id}`} product={p} variant="compact" />
          ))}
        </div>
      )}
    </div>
  );
}
