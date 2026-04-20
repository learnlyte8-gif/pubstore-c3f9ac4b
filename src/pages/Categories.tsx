import { useState } from "react";
import { CATEGORIES, PRODUCTS } from "@/data/products";
import ProductCard from "@/components/marketplace/ProductCard";

export default function Categories() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const products = PRODUCTS.filter((p) => p.category === active);
  const ActiveIcon = CATEGORIES.find((c) => c.id === active)!.icon;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4rem)] lg:h-[calc(100dvh-3.5rem)]">
      {/* Side rail */}
      <aside className="w-24 shrink-0 bg-muted/40 overflow-y-auto scrollbar-none border-r border-border shadow-inset">
        <ul>
          {CATEGORIES.map(({ id, name, icon: Icon }) => {
            const isActive = active === id;
            return (
              <li key={id}>
                <button
                  onClick={() => setActive(id)}
                  className={`w-full flex flex-col items-center gap-1 py-4 px-1 text-center transition ${
                    isActive
                      ? "bg-background text-primary font-semibold border-l-2 border-primary shadow-card"
                      : "text-muted-foreground hover:bg-background/60"
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

      {/* Main column */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b border-border bg-card shadow-soft flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-soft">
            <ActiveIcon className="w-5 h-5" strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-bold text-base capitalize">{CATEGORIES.find((c) => c.id === active)!.name}</h2>
            <p className="text-xs text-muted-foreground">{products.length} products</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {products.length === 0 && (
            <p className="col-span-2 text-center text-sm text-muted-foreground py-12">
              No products yet in this category.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
