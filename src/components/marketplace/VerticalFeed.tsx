import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart, MessageCircle, Share2, ShoppingBag, Play, ShieldCheck, Award, Music2,
  Volume2, VolumeX, Bookmark, Radio, X, Eye, Maximize2,
} from "lucide-react";
import type { Product, Supplier } from "@/data/products";
import { fetchSupplier } from "@/data/products";
import { useShop } from "@/store/shop";
import { toast } from "sonner";

type FeedItem = {
  id: string;
  product: Product;
  supplier?: Supplier;
  caption: string;
  likes: number;
  comments: number;
  views: number;
  music?: string;
  isReel: boolean;
  isLive: boolean;
};

const CAPTIONS = [
  "Just landed in our warehouse 📦",
  "Bestseller of the week 🔥",
  "New arrival, free samples 🎁",
  "Quality you can trust ⚙️",
  "4.9★ rating from buyers ⭐",
  "Bulk pricing — DM for quotes 💬",
];
const MUSIC = ["Original sound · pubstore", "Aurora · Runaway", "SZA · Snooze"];

function buildFeed(pool: Product[], suppliers: Map<string, Supplier>): FeedItem[] {
  return pool.map((p, i) => {
    const isReel = i % 4 === 1;
    return {
      id: `${p.id}-${i}`,
      product: p,
      supplier: suppliers.get(p.supplierId),
      caption: CAPTIONS[i % CAPTIONS.length],
      likes: 230 + ((p.sold * 7) % 9800),
      comments: 12 + (p.reviews % 380),
      views: 1200 + ((p.sold * 13) % 89000),
      music: isReel ? MUSIC[i % MUSIC.length] : undefined,
      isReel,
      isLive: i % 11 === 3,
    };
  });
}

interface VFProps {
  interests?: string[];
  followingIds?: string[];
  variant?: "fyp" | "following";
  products?: Product[];
}

export default function VerticalFeed({ interests = [], followingIds = [], variant = "fyp", products = [] }: VFProps) {
  const [supplierMap, setSupplierMap] = useState<Map<string, Supplier>>(new Map());

  // Lazy-fetch suppliers for the products in this feed
  useEffect(() => {
    const ids = Array.from(new Set(products.map((p) => p.supplierId)));
    const missing = ids.filter((id) => !supplierMap.has(id));
    if (!missing.length) return;
    Promise.all(missing.map(fetchSupplier)).then((res) => {
      const next = new Map(supplierMap);
      res.forEach((s) => { if (s) next.set(s.id, s); });
      setSupplierMap(next);
    });
  }, [products]);

  const items = useMemo(() => {
    let pool = products;
    if (variant === "following" && followingIds.length) {
      pool = products.filter((p) => followingIds.includes(p.supplierId));
    } else if (interests.length) {
      const liked = products.filter((p) => interests.some((i) => p.category === i));
      const rest = products.filter((p) => !liked.includes(p));
      pool = [...liked, ...rest];
    }
    return buildFeed(pool, supplierMap);
  }, [products, interests, followingIds, variant, supplierMap]);

  const reels = useMemo(() => items.filter((it) => it.isReel), [items]);
  const [playerIdx, setPlayerIdx] = useState<number | null>(null);

  if (!items.length) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-semibold">Feed is empty</p>
        <p className="text-xs text-muted-foreground mt-1">Check back when more products are listed.</p>
      </div>
    );
  }

  const openReelById = (id: string) => {
    const idx = reels.findIndex((r) => r.id === id);
    if (idx >= 0) setPlayerIdx(idx);
  };

  return (
    <>
      <div className="space-y-4 px-4 mt-4">
        {items.map((it) => (
          <FeedCard key={it.id} item={it} onOpenReel={() => openReelById(it.id)} />
        ))}
      </div>
      {playerIdx !== null && (
        <ReelPlayer reels={reels} startIdx={playerIdx} onClose={() => setPlayerIdx(null)} />
      )}
    </>
  );
}

function FeedCard({ item, onOpenReel }: { item: FeedItem; onOpenReel: () => void }) {
  const { product: p, supplier: s } = item;
  const { toggleWishlist, isWishlisted, addToCart } = useShop();
  const liked = isWishlisted(p.id);
  const [localLikes, setLocalLikes] = useState(item.likes);
  const onLike = () => { toggleWishlist(p.id); setLocalLikes((v) => (liked ? v - 1 : v + 1)); };

  return (
    <article className="rounded-3xl bg-card border shadow-card overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Link to={s ? `/supplier/${s.id}` : "#"} className="shrink-0">
          <div className="w-9 h-9 rounded-full bg-muted ring-2 ring-primary/30 overflow-hidden flex items-center justify-center">
            {s?.logo && s.logo !== "/placeholder.svg" ? (
              <img src={s.logo} alt="" className="w-full h-full object-cover" />
            ) : <span className="text-xs font-bold">{s?.name?.[0] ?? "?"}</span>}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={s ? `/supplier/${s.id}` : "#"} className="text-xs font-bold flex items-center gap-1 truncate">
            {s?.name ?? "Supplier"}
            {s?.verified && <ShieldCheck className="w-3 h-3 text-primary shrink-0" />}
            {s?.gold && <Award className="w-3 h-3 text-amber-600 shrink-0" />}
          </Link>
          <p className="text-[10px] text-muted-foreground truncate">{s?.country} · {item.isReel ? "Reel" : "Post"}</p>
        </div>
      </div>

      <Link to={`/product/${p.id}`} className="block relative aspect-square bg-muted">
        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
        {item.isLive && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center gap-1 animate-pulse">
            <Radio className="w-3 h-3" /> LIVE
          </span>
        )}
        {item.isReel && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenReel(); }}
            className="absolute inset-0 flex items-center justify-center bg-foreground/10 hover:bg-foreground/20 transition group">
            <span className="w-16 h-16 rounded-full bg-background/85 backdrop-blur shadow-elevated flex items-center justify-center group-hover:scale-110 transition">
              <Play className="w-7 h-7 fill-foreground text-foreground ml-1" />
            </span>
            <span className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-foreground/70 backdrop-blur text-background text-[10px] font-bold flex items-center gap-1">
              <Maximize2 className="w-3 h-3" /> Watch reel
            </span>
          </button>
        )}
      </Link>

      <div className="px-3 pt-2.5 pb-1 flex items-center gap-3">
        <button onClick={onLike} aria-label="Like">
          <Heart className={`w-6 h-6 ${liked ? "fill-destructive text-destructive scale-110" : ""}`} strokeWidth={1.8} />
        </button>
        <Link to="/messages"><MessageCircle className="w-6 h-6" strokeWidth={1.8} /></Link>
        <button onClick={() => toast.success("Link copied")}><Share2 className="w-6 h-6" strokeWidth={1.8} /></button>
        <button onClick={() => { addToCart(p.id, p.moq); toast.success("Added to cart"); }}
          className="ml-auto flex items-center gap-1 px-3 h-8 rounded-full bg-foreground text-background text-xs font-bold shadow-card">
          <ShoppingBag className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <div className="px-3"><p className="text-xs font-bold">{localLikes.toLocaleString()} likes</p></div>

      <div className="px-3 pt-1 pb-3">
        <p className="text-xs leading-snug">
          <Link to={s ? `/supplier/${s.id}` : "#"} className="font-bold mr-1">{s?.name?.split(" ")[0]?.toLowerCase()}</Link>
          {item.caption}
        </p>
        <Link to={`/product/${p.id}`} className="mt-2 flex items-center gap-2 rounded-2xl bg-muted/60 p-2">
          <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug line-clamp-2 font-medium">{p.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">MOQ {p.moq} {p.unit} · {p.leadTime}</p>
          </div>
          <p className="text-sm font-bold">${p.price}</p>
        </Link>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-2">
          <Eye className="w-3 h-3" /> {item.views.toLocaleString()} views · {item.comments} comments
        </p>
      </div>
    </article>
  );
}

function ReelPlayer({ reels, startIdx, onClose }: { reels: FeedItem[]; startIdx: number; onClose: () => void }) {
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(startIdx);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-idx="${startIdx}"]`);
    el?.scrollIntoView({ block: "start" });
  }, [startIdx]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) setActiveIdx(Number((e.target as HTMLElement).dataset.idx));
      });
    }, { root, threshold: [0.6] });
    root.querySelectorAll("[data-reel]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  return (
    <div className="fixed inset-0 z-50 bg-foreground animate-fade-in">
      <button onClick={onClose} aria-label="Close" className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-foreground/50 backdrop-blur text-background flex items-center justify-center safe-top">
        <X className="w-5 h-5" />
      </button>
      <button onClick={() => setMuted(m => !m)} className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-foreground/50 backdrop-blur text-background flex items-center justify-center safe-top">
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <div ref={containerRef} className="h-[100dvh] overflow-y-auto snap-y snap-mandatory scrollbar-none">
        {reels.map((it, i) => (
          <section key={it.id} data-reel data-idx={i}
            className="relative w-full h-[100dvh] snap-start snap-always overflow-hidden bg-foreground">
            <img src={it.product.image} alt={it.product.title}
              className={`absolute inset-0 w-full h-full object-cover ${i === activeIdx ? "scale-110" : "scale-100"} transition-transform duration-[8000ms]`} />
            <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-transparent to-foreground/85 pointer-events-none" />
            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-4 z-10 text-background">
              <button><Heart className="w-7 h-7" strokeWidth={1.6} /></button>
              <Link to="/messages"><MessageCircle className="w-7 h-7" strokeWidth={1.6} /></Link>
              <button><Bookmark className="w-7 h-7" strokeWidth={1.6} /></button>
              <button><Share2 className="w-7 h-7" strokeWidth={1.6} /></button>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-3 pr-20 text-background z-10 safe-bottom">
              <p className="text-sm font-bold">{it.supplier?.name ?? "Supplier"}</p>
              <p className="text-xs mt-1 line-clamp-2">{it.caption}</p>
              {it.music && (
                <p className="text-[11px] flex items-center gap-1.5 mt-2 opacity-90">
                  <Music2 className="w-3 h-3" /> {it.music}
                </p>
              )}
              <Link to={`/product/${it.product.id}`} className="mt-3 flex items-center gap-2 rounded-2xl bg-background/10 backdrop-blur border border-background/20 p-2">
                <img src={it.product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold line-clamp-1">{it.product.title}</p>
                  <p className="text-[10px] opacity-70">MOQ {it.product.moq} {it.product.unit}</p>
                </div>
                <p className="text-sm font-bold mr-1">${it.product.price}</p>
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
