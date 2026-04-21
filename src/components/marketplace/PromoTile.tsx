import { Link } from "react-router-dom";
import { Sparkles, Megaphone, Tag, Crown } from "lucide-react";
import type { Product } from "@/data/products";

type Variant = "sponsored" | "deal" | "editor" | "new";

const variants: Record<
  Variant,
  { label: string; chip: string; bg: string; icon: typeof Sparkles; tag: string }
> = {
  sponsored: {
    label: "Sponsored",
    chip: "bg-foreground text-background",
    bg: "bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600",
    icon: Megaphone,
    tag: "Featured product",
  },
  deal: {
    label: "Deal of the day",
    chip: "bg-destructive text-destructive-foreground",
    bg: "bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400",
    icon: Tag,
    tag: "Lowest price this week",
  },
  editor: {
    label: "Editor's pick",
    chip: "bg-primary text-primary-foreground",
    bg: "bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-500",
    icon: Crown,
    tag: "Curated by Tapson",
  },
  new: {
    label: "Just dropped",
    chip: "bg-emerald-500 text-white",
    bg: "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600",
    icon: Sparkles,
    tag: "New on PUBSTORE",
  },
};

export default function PromoTile({
  product,
  variant = "sponsored",
  span = "col-span-2",
}: {
  product: Product;
  variant?: Variant;
  span?: string;
}) {
  const v = variants[variant];
  const Icon = v.icon;
  const off =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  return (
    <Link
      to={`/product/${product.id}`}
      className={`relative ${span} rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition group block`}
    >
      <div className={`absolute inset-0 ${v.bg} opacity-95`} />
      <img
        src={product.image}
        alt={product.title}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-40 group-hover:opacity-50 group-hover:scale-105 transition"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="relative p-3 h-full min-h-[170px] flex flex-col justify-between text-white">
        <div className="flex items-start justify-between gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-full ${v.chip} shadow-card`}>
            <Icon className="w-3 h-3" /> {v.label}
          </span>
          {off > 0 && (
            <span className="bg-white/95 text-destructive text-[11px] font-extrabold px-1.5 py-0.5 rounded">
              -{off}%
            </span>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold opacity-90 leading-tight">{v.tag}</p>
          <p className="text-sm font-extrabold leading-snug line-clamp-2 mt-0.5 drop-shadow">
            {product.title}
          </p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-lg font-black">${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span className="text-[11px] line-through opacity-70">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
            <span className="ml-auto text-[10px] font-bold bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
              Shop now →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
