import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart, MessageCircle, Share2, ShoppingBag, ShieldCheck, Award, Star,
} from "lucide-react";
import type { Product, Supplier } from "@/data/products";
import { fetchSupplier } from "@/data/products";
import { useShop } from "@/store/shop";
import { toast } from "sonner";

type FeedItem = {
  id: string;
  product: Product;
  supplier?: Supplier;
};

interface VFProps {
  interests?: string[];
  followingIds?: string[];
  variant?: "fyp" | "following";
  products?: Product[];
}

export default function VerticalFeed({
  interests = [],
  followingIds = [],
  variant = "fyp",
  products = [],
}: VFProps) {
  const [supplierMap, setSupplierMap] = useState<Map<string, Supplier>>(new Map());

  // Lazy-fetch suppliers for the products in this feed
  useEffect(() => {
    const ids = Array.from(new Set(products.map((p) => p.supplierId)));
    const missing = ids.filter((id) => !supplierMap.has(id));
    if (!missing.length) return;
    Promise.all(missing.map(fetchSupplier)).then((res) => {
      const next = new Map(supplierMap);
      res.forEach((s) => {
        if (s) next.set(s.id, s);
      });
      setSupplierMap(next);
    });
  }, [products]);

  const items: FeedItem[] = useMemo(() => {
    let pool = products;
    if (variant === "following" && followingIds.length) {
      pool = products.filter((p) => followingIds.includes(p.supplierId));
    } else if (interests.length) {
      const liked = products.filter((p) => interests.some((i) => p.category === i));
      const rest = products.filter((p) => !liked.includes(p));
      pool = [...liked, ...rest];
    }
    return pool.map((p) => ({
      id: p.id,
      product: p,
      supplier: supplierMap.get(p.supplierId),
    }));
  }, [products, interests, followingIds, variant, supplierMap]);

  if (!items.length) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-semibold">Nothing here yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          {variant === "following"
            ? "Follow some suppliers to see their latest products here."
            : "Check back when more products are listed."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 mt-4">
      {items.map((it) => (
        <FeedCard key={it.id} item={it} />
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const { product: p, supplier: s } = item;
  const { toggleWishlist, isWishlisted, addToCart } = useShop();
  const liked = isWishlisted(p.id);

  return (
    <article className="rounded-3xl bg-card border shadow-card overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Link to={s ? `/supplier/${s.id}` : "#"} className="shrink-0">
          <div className="w-9 h-9 rounded-full bg-muted ring-2 ring-primary/30 overflow-hidden flex items-center justify-center">
            {s?.logo && s.logo !== "/placeholder.svg" ? (
              <img src={s.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold">{s?.name?.[0] ?? "?"}</span>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={s ? `/supplier/${s.id}` : "#"}
            className="text-xs font-bold flex items-center gap-1 truncate"
          >
            {s?.name ?? "Supplier"}
            {s?.verified && <ShieldCheck className="w-3 h-3 text-primary shrink-0" />}
            {s?.gold && <Award className="w-3 h-3 text-amber-600 shrink-0" />}
          </Link>
          {s?.country && (
            <p className="text-[10px] text-muted-foreground truncate">{s.country}</p>
          )}
        </div>
      </div>

      <Link to={`/product/${p.id}`} className="block relative aspect-square bg-muted">
        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
      </Link>

      <div className="px-3 pt-2.5 pb-1 flex items-center gap-3">
        <button onClick={() => toggleWishlist(p.id)} aria-label="Save">
          <Heart
            className={`w-6 h-6 ${liked ? "fill-destructive text-destructive scale-110" : ""}`}
            strokeWidth={1.8}
          />
        </button>
        <Link to="/messages" aria-label="Message">
          <MessageCircle className="w-6 h-6" strokeWidth={1.8} />
        </Link>
        <button
          onClick={async () => {
            try {
              await navigator.share?.({
                title: p.title,
                url: `${window.location.origin}/product/${p.id}`,
              });
            } catch {
              navigator.clipboard?.writeText(`${window.location.origin}/product/${p.id}`);
              toast.success("Link copied");
            }
          }}
          aria-label="Share"
        >
          <Share2 className="w-6 h-6" strokeWidth={1.8} />
        </button>
        <button
          onClick={() => {
            addToCart(p.id, p.moq);
            toast.success("Added to cart");
          }}
          className="ml-auto flex items-center gap-1 px-3 h-8 rounded-full bg-foreground text-background text-xs font-bold shadow-card"
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {(p.rating > 0 || p.reviews > 0 || p.sold > 0) && (
        <div className="px-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          {p.rating > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {p.rating.toFixed(1)}
              {p.reviews > 0 && (
                <span className="text-muted-foreground font-normal">({p.reviews})</span>
              )}
            </span>
          )}
          {p.sold > 0 && <span>{p.sold.toLocaleString()} sold</span>}
        </div>
      )}

      <div className="px-3 pt-1 pb-3">
        {p.description && (
          <p className="text-xs leading-snug line-clamp-2">
            <Link to={s ? `/supplier/${s.id}` : "#"} className="font-bold mr-1">
              {s?.name?.split(" ")[0]?.toLowerCase()}
            </Link>
            {p.description}
          </p>
        )}
        <Link
          to={`/product/${p.id}`}
          className="mt-2 flex items-center gap-2 rounded-2xl bg-muted/60 p-2"
        >
          <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug line-clamp-2 font-medium">{p.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              MOQ {p.moq} {p.unit} · {p.leadTime}
            </p>
          </div>
          <p className="text-sm font-bold">${p.price}</p>
        </Link>
      </div>
    </article>
  );
}
