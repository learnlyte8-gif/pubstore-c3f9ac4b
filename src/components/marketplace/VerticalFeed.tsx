import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Share2,
  ShoppingBag,
  Play,
  ShieldCheck,
  Award,
  Eye,
  Volume2,
} from "lucide-react";
import { PRODUCTS, SUPPLIERS, type Product, type Supplier } from "@/data/products";
import { useShop } from "@/store/shop";
import { toast } from "sonner";

type FeedItem = {
  id: string;
  product: Product;
  supplier: Supplier | undefined;
  caption: string;
  likes: number;
  comments: number;
  views: number;
  type: "post" | "reel";
  music?: string;
};

const CAPTIONS = [
  "Just landed in our warehouse 📦 limited stock!",
  "Bestseller of the week 🔥 grab before it's gone",
  "New arrival, free samples for first 50 buyers 🎁",
  "Behind the scenes at our factory ⚙️ quality you can trust",
  "Customer favorite — 4.9★ rating from 2k buyers ⭐",
  "Bulk pricing live now — DM for custom quotes 💬",
  "Sustainable, ethically sourced, ready to ship 🌱",
  "Trending in 12 countries this week 🌍",
  "Restock alert! Sold out twice last month ⚡",
  "Made for resellers, MOQ from 50 pcs 📈",
];

const MUSIC = [
  "Aurora · Runaway",
  "Drake · Passionfruit",
  "Tame Impala · The Less I Know",
  "Original sound · pubstore_official",
  "SZA · Snooze",
  "ROSALÍA · LA FAMA",
];

function buildFeed(productPool: Product[]): FeedItem[] {
  return productPool.map((p, i) => ({
    id: `${p.id}-${i}`,
    product: p,
    supplier: SUPPLIERS.find((s) => s.id === p.supplierId),
    caption: CAPTIONS[i % CAPTIONS.length],
    likes: 230 + ((p.sold * 7) % 9800),
    comments: 12 + (p.reviews % 380),
    views: 1200 + ((p.sold * 13) % 89000),
    type: i % 3 === 0 ? "reel" : "post",
    music: i % 3 === 0 ? MUSIC[i % MUSIC.length] : undefined,
  }));
}

export default function VerticalFeed({
  interests = [],
  followingIds = [],
  variant = "fyp",
}: {
  interests?: string[];
  followingIds?: string[];
  variant?: "fyp" | "following";
}) {
  const items = useMemo(() => {
    if (variant === "following") {
      const pool = PRODUCTS.filter((p) => followingIds.includes(p.supplierId));
      return buildFeed(pool);
    }
    // FYP: prioritize interests, then mix
    const liked = interests.length
      ? PRODUCTS.filter((p) => interests.some((i) => p.category === i))
      : [];
    const rest = PRODUCTS.filter((p) => !liked.includes(p));
    const mixed = [...liked, ...rest];
    return buildFeed(mixed);
  }, [interests, followingIds, variant]);

  if (variant === "following" && items.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-semibold">No follows yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Follow suppliers to see their drops here.
        </p>
        <Link
          to="/categories"
          className="inline-block mt-4 px-4 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold leading-9 shadow-card"
        >
          Discover suppliers
        </Link>
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
  const [localLikes, setLocalLikes] = useState(item.likes);

  const onLike = () => {
    toggleWishlist(p.id);
    setLocalLikes((v) => (liked ? v - 1 : v + 1));
  };

  return (
    <article className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Link to={s ? `/supplier/${s.id}` : "#"} className="shrink-0">
          <img src={s?.logo} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/30" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={s ? `/supplier/${s.id}` : "#"}
            className="text-xs font-bold leading-tight flex items-center gap-1 truncate"
          >
            {s?.name}
            {s?.verified && <ShieldCheck className="w-3 h-3 text-primary shrink-0" />}
            {s?.gold && <Award className="w-3 h-3 text-amber-600 shrink-0" />}
          </Link>
          <p className="text-[10px] text-muted-foreground truncate">
            {s?.country} · {item.type === "reel" ? "Reel" : "Sponsored"}
          </p>
        </div>
        <button className="text-xs font-bold text-primary px-3 h-7 rounded-full bg-primary/10">
          Follow
        </button>
      </div>

      {/* Media */}
      <Link to={`/product/${p.id}`} className="block relative aspect-square bg-muted">
        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
        {item.type === "reel" && (
          <>
            <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-foreground/40 backdrop-blur flex items-center justify-center text-background">
              <Volume2 className="w-4 h-4" />
            </span>
            <span className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-foreground/50 backdrop-blur text-background text-[10px] font-bold flex items-center gap-1">
              <Play className="w-3 h-3 fill-current" /> Reel
            </span>
          </>
        )}
        {p.originalPrice && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-card">
            -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
          </span>
        )}
      </Link>

      {/* Actions */}
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-3">
        <button onClick={onLike} aria-label="Like" className="flex items-center gap-1">
          <Heart
            className={`w-6 h-6 transition ${
              liked ? "fill-destructive text-destructive scale-110" : ""
            }`}
            strokeWidth={1.8}
          />
        </button>
        <Link to="/messages" aria-label="Comment">
          <MessageCircle className="w-6 h-6" strokeWidth={1.8} />
        </Link>
        <button
          aria-label="Share"
          onClick={() => toast.success("Link copied")}
        >
          <Share2 className="w-6 h-6" strokeWidth={1.8} />
        </button>
        <button
          onClick={() => {
            addToCart(p.id, p.moq);
            toast.success("Added to cart", { description: `${p.moq} × ${p.title}` });
          }}
          className="ml-auto flex items-center gap-1 px-3 h-8 rounded-full bg-foreground text-background text-xs font-bold shadow-card"
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* Stats */}
      <div className="px-3">
        <p className="text-xs font-bold">{localLikes.toLocaleString()} likes</p>
      </div>

      {/* Caption + product */}
      <div className="px-3 pt-1 pb-3">
        <p className="text-xs leading-snug">
          <Link to={s ? `/supplier/${s.id}` : "#"} className="font-bold mr-1">
            {s?.name?.split(" ")[0].toLowerCase()}
          </Link>
          {item.caption}
        </p>

        <Link
          to={`/product/${p.id}`}
          className="mt-2 flex items-center gap-2 rounded-2xl bg-muted/60 p-2 hover:bg-muted transition"
        >
          <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug line-clamp-2 font-medium">{p.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              MOQ {p.moq} {p.unit} · {p.leadTime}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold leading-tight">${p.price}</p>
            {p.originalPrice && (
              <p className="text-[10px] text-muted-foreground line-through">${p.originalPrice}</p>
            )}
          </div>
        </Link>

        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Eye className="w-3 h-3" /> {item.views.toLocaleString()} views ·{" "}
            {item.comments} comments
          </p>
          {item.music && (
            <p className="text-[10px] text-muted-foreground italic truncate max-w-[40%]">
              ♪ {item.music}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
