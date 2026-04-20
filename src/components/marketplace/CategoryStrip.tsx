import { PRODUCTS, CATEGORIES } from "@/data/products";
import ProductCard from "./ProductCard";

interface Props {
  categoryId: string;
  title?: string;
}

export default function CategoryStrip({ categoryId, title }: Props) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const items = PRODUCTS.filter((p) => p.category === categoryId);
  if (!items.length) return null;
  const Icon = cat?.icon;

  return (
    <section className="px-4 mt-6">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shadow-soft">
              <Icon className="w-4 h-4" strokeWidth={1.8} />
            </span>
          )}
          <div>
            <h2 className="text-base font-bold leading-tight">{title ?? cat?.name}</h2>
            <p className="text-xs text-muted-foreground">Hand-picked for buyers</p>
          </div>
        </div>
        <button className="text-xs text-primary font-semibold">See all</button>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-3 -mx-1 px-1 pb-1">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} variant="compact" />
        ))}
      </div>
    </section>
  );
}
