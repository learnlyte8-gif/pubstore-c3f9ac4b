import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Share2,
  ShoppingBag,
  Play,
  ShieldCheck,
  Award,
  Music2,
  Volume2,
  VolumeX,
  Bookmark,
  Radio,
  X,
  Eye,
  Maximize2,
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
  music?: string;
  isReel: boolean;
  isLive: boolean;
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
  return productPool.map((p, i) => {
    const isReel = i % 4 === 1; // ~25% of items are reels (opt-in)
    return {
      id: `${p.id}-${i}`,
      product: p,
      supplier: SUPPLIERS.find((s) => s.id === p.supplierId),
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
    const liked = interests.length
      ? PRODUCTS.filter((p) => interests.some((i) => p.category === i))
      : [];
    const rest = PRODUCTS.filter((p) => !liked.includes(p));
    return buildFeed([...liked, ...rest]);
  }, [interests, followingIds, variant]);

  // Full-screen reel player state — only opens on explicit user opt-in
  const reels = useMemo(() => items.filter((it) => it.isReel), [items]);
  const [playerIdx, setPlayerIdx] = useState<number | null>(null);

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
        <ReelPlayer
          reels={reels}
          startIdx={playerIdx}
          onClose={() => setPlayerIdx(null)}
        />
      )}
    </>
  );
}

/* ========== Inline social-style card ========== */

function FeedCard({ item, onOpenReel }: { item: FeedItem; onOpenReel: () => void }) {
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
            {s?.country} · {item.isReel ? "Reel" : "Post"}
          </p>
        </div>
        <button className="text-xs font-bold text-primary px-3 h-7 rounded-full bg-primary/10">
          Follow
        </button>
      </div>

      {/* Media (links to product detail by default) */}
      <Link to={`/product/${p.id}`} className="block relative aspect-square bg-muted">
        <img src={p.image} alt={p.title} className="w-full h-full object-cover" />

        {item.isLive && (
          <Link
            to={`/live/live-${s?.id}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center gap-1 animate-pulse shadow-card"
          >
            <Radio className="w-3 h-3" /> LIVE
          </Link>
        )}

        {p.originalPrice && !item.isLive && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-card">
            -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
          </span>
        )}

        {/* Reel opt-in — only shows when this item is a reel */}
        {item.isReel && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenReel();
            }}
            className="absolute inset-0 flex items-center justify-center bg-foreground/10 hover:bg-foreground/20 transition group"
            aria-label="Watch reel full screen"
          >
            <span className="w-16 h-16 rounded-full bg-background/85 backdrop-blur shadow-elevated flex items-center justify-center group-hover:scale-110 transition">
              <Play className="w-7 h-7 fill-foreground text-foreground ml-1" />
            </span>
            <span className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-foreground/70 backdrop-blur text-background text-[10px] font-bold flex items-center gap-1">
              <Maximize2 className="w-3 h-3" /> Watch reel
            </span>
          </button>
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
        <button aria-label="Share" onClick={() => toast.success("Link copied")}>
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
            <Eye className="w-3 h-3" /> {item.views.toLocaleString()} views · {item.comments} comments
          </p>
          {item.music && (
            <p className="text-[10px] text-muted-foreground italic truncate max-w-[40%] flex items-center gap-1">
              <Music2 className="w-3 h-3" /> {item.music}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/* ========== Full-screen reel player (opt-in) ========== */

function ReelPlayer({
  reels,
  startIdx,
  onClose,
}: {
  reels: FeedItem[];
  startIdx: number;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(startIdx);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Scroll to start reel
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-idx="${startIdx}"]`);
    el?.scrollIntoView({ block: "start" });
  }, [startIdx]);

  // Track which reel is in view
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setActiveIdx(Number((e.target as HTMLElement).dataset.idx));
          }
        });
      },
      { root, threshold: [0.6] }
    );
    root.querySelectorAll("[data-reel]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black animate-fade-in">
      <button
        onClick={onClose}
        aria-label="Close reels"
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center safe-top"
      >
        <X className="w-5 h-5" />
      </button>
      <div
        ref={containerRef}
        className="h-[100dvh] overflow-y-auto snap-y snap-mandatory scrollbar-none"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {reels.map((it, i) => (
          <ReelSlide
            key={it.id}
            item={it}
            index={i}
            active={i === activeIdx}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ))}
      </div>
    </div>
  );
}

function ReelSlide({
  item,
  index,
  active,
  muted,
  onToggleMute,
}: {
  item: FeedItem;
  index: number;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const { product: p, supplier: s } = item;
  const { toggleWishlist, isWishlisted, addToCart } = useShop();
  const liked = isWishlisted(p.id);
  const [localLikes, setLocalLikes] = useState(item.likes);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active || paused) return;
    setProgress(0);
    const start = performance.now();
    const dur = 8000;
    let raf = 0;
    const tick = (t: number) => {
      const pr = Math.min(1, (t - start) / dur);
      setProgress(pr);
      if (pr < 1 && active && !paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, paused]);

  const onLike = () => {
    toggleWishlist(p.id);
    setLocalLikes((v) => (liked ? v - 1 : v + 1));
  };

  return (
    <section
      data-reel
      data-idx={index}
      className="relative w-full h-[100dvh] snap-start snap-always overflow-hidden bg-black"
      onClick={() => setPaused((v) => !v)}
    >
      <img
        src={p.image}
        alt={p.title}
        className={`absolute inset-0 w-full h-full object-cover transition-transform ease-linear ${
          active && !paused ? "scale-110 duration-[8000ms]" : "scale-100 duration-700"
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/85 pointer-events-none" />

      {/* Progress */}
      <div className="absolute top-3 left-14 right-14 h-0.5 bg-white/20 rounded-full overflow-hidden safe-top">
        <div className="h-full bg-white" style={{ width: `${(active ? progress : 0) * 100}%` }} />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white safe-top"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {paused && active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-16 h-16 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
            <Play className="w-8 h-8 fill-current" />
          </span>
        </div>
      )}

      {/* Side action bar */}
      <div className="absolute right-2 bottom-32 flex flex-col items-center gap-4 z-10">
        <Link
          to={s ? `/supplier/${s.id}` : "#"}
          onClick={(e) => e.stopPropagation()}
          className="relative"
        >
          <img
            src={s?.logo}
            alt=""
            className="w-11 h-11 rounded-full object-cover ring-2 ring-white"
          />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center border-2 border-black">
            +
          </span>
        </Link>

        <SideBtn
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          icon={
            <Heart
              className={`w-7 h-7 ${liked ? "fill-destructive text-destructive" : "text-white"}`}
              strokeWidth={1.6}
            />
          }
          label={fmt(localLikes)}
        />
        <SideBtn
          to="/messages"
          icon={<MessageCircle className="w-7 h-7 text-white" strokeWidth={1.6} />}
          label={fmt(item.comments)}
        />
        <SideBtn
          onClick={(e) => {
            e.stopPropagation();
            setSaved((v) => !v);
            toast.success(saved ? "Removed from saved" : "Saved");
          }}
          icon={
            <Bookmark
              className={`w-7 h-7 ${saved ? "fill-amber-400 text-amber-400" : "text-white"}`}
              strokeWidth={1.6}
            />
          }
          label="Save"
        />
        <SideBtn
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(window.location.origin + `/product/${p.id}`);
            toast.success("Link copied");
          }}
          icon={<Share2 className="w-7 h-7 text-white" strokeWidth={1.6} />}
          label="Share"
        />

        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-black ring-2 ring-white/40 overflow-hidden flex items-center justify-center animate-[spin_6s_linear_infinite]">
          <img src={s?.logo} alt="" className="w-5 h-5 rounded-full object-cover" />
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 p-3 pr-20 text-white z-10 safe-bottom">
        <Link
          to={s ? `/supplier/${s.id}` : "#"}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-bold"
        >
          @{s?.name?.split(" ")[0].toLowerCase()}
          {s?.verified && <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />}
          {s?.gold && <Award className="w-3.5 h-3.5 text-amber-300" />}
        </Link>
        <p className="text-xs leading-snug mt-1.5 line-clamp-2">{item.caption}</p>

        {item.music && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/90">
            <Music2 className="w-3 h-3" />
            <div className="overflow-hidden flex-1">
              <p className="whitespace-nowrap animate-[marquee_18s_linear_infinite]">
                {item.music} · {item.music} · {item.music}
              </p>
            </div>
          </div>
        )}

        <Link
          to={`/product/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-2"
        >
          <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-snug line-clamp-1">{p.title}</p>
            <p className="text-[10px] text-white/70">
              MOQ {p.moq} {p.unit} · {p.leadTime}
            </p>
          </div>
          <div className="text-right shrink-0 mr-1">
            <p className="text-sm font-bold">${p.price}</p>
            {p.originalPrice && (
              <p className="text-[10px] text-white/60 line-through">${p.originalPrice}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToCart(p.id, p.moq);
              toast.success("Added to cart", { description: `${p.moq} × ${p.title}` });
            }}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card"
            aria-label="Add to cart"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </section>
  );
}

function SideBtn({
  icon,
  label,
  onClick,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  to?: string;
}) {
  const inner = (
    <>
      {icon}
      <span className="text-[10px] font-bold text-white drop-shadow">{label}</span>
    </>
  );
  if (to)
    return (
      <Link to={to} onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-0.5">
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5">
      {inner}
    </button>
  );
}

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
