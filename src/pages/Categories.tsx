import { useState } from "react";
import ProductCard from "@/components/marketplace/ProductCard";
import EmptyState from "@/components/EmptyState";
import { useCategories, useProducts } from "@/hooks/useCatalog";

export default function Categories() {
  const { data: cats = [] } = useCategories();
  const [active, setActive] = useState<string | null>(null);
  const activeId = active ?? cats[0]?.id ?? "";
  const { data: products = [], isLoading } = useProducts({ category: activeId, limit: 60 });
  const ActiveCat = cats.find((c) => c.id === activeId);
  const ActiveIcon = ActiveCat?.icon;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4rem)] lg:h-[calc(100dvh-3.5rem)]">
      <aside className="w-24 shrink-0 bg-muted/40 overflow-y-auto scrollbar-none border-r">
        <ul>
          {cats.map(({ id, name, icon: Icon }) => {
            const isActive = activeId === id;
            return (
              <li key={id}>
                <button
                  onClick={() => setActive(id)}
                  className={`w-full flex flex-col items-center gap-1 py-4 px-1 text-center transition ${
                    isActive ? "bg-background text-primary font-semibold border-l-2 border-primary shadow-card" : "text-muted-foreground hover:bg-background/60"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.7} />
                  <span className="text-[11px] leading-tight">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b bg-card shadow-soft flex items-center gap-2">
          {ActiveIcon && (
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-soft">
              <ActiveIcon className="w-5 h-5" strokeWidth={2} />
            </span>
          )}
          <div>
            <h2 className="font-bold text-base capitalize">{ActiveCat?.name}</h2>
            <p className="text-xs text-muted-foreground">{products.length} products</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-sm text-muted-foreground">Loading…</p>
        ) : products.length === 0 ? (
          <EmptyState title="No products yet" description="Be the first supplier to list in this category." />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3">
            {products.map((p) => (<ProductCard key={p.id} product={p} />))}
          </div>
        )}
      </div>
    </div>
  );
}
