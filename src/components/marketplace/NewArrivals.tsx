import { Link } from "react-router-dom";
import { PRODUCTS } from "@/data/products";

export default function NewArrivals() {
  const items = PRODUCTS.filter((p) => p.badge === "New" || p.badge === "Top").slice(0, 6);
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {items.map((p) => (
        <Link
          to={`/product/${p.id}`}
          key={p.id}
          className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-card hover:shadow-elevated transition group"
        >
          <img
            src={p.image}
            alt={p.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
            {p.badge && (
              <span className="inline-block bg-white/20 backdrop-blur text-[9px] font-bold px-1.5 py-0.5 rounded mb-1">
                {p.badge}
              </span>
            )}
            <p className="text-[10px] font-medium leading-tight line-clamp-2">{p.title}</p>
            <p className="text-xs font-bold mt-0.5">${p.price.toFixed(2)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
