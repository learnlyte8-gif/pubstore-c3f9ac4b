import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Radio,
  Users,
  Heart,
  Send,
  ShoppingBag,
  Share2,
  Sparkles,
  Gift,
  X,
  Pin,
  Eye,
  ShieldCheck,
  Award,
} from "lucide-react";
import { SUPPLIERS, PRODUCTS, type Supplier, type Product } from "@/data/products";
import { useShop } from "@/store/shop";
import { toast } from "sonner";

type LiveStream = {
  id: string;
  supplier: Supplier;
  title: string;
  viewers: number;
  startedMin: number;
  thumb: string;
  pinnedProductIds: string[];
};

const TITLES = [
  "🔥 Factory tour + flash deals",
  "New collection drop · live Q&A",
  "Bulk pricing reveal — ask anything",
  "Behind the scenes: production line",
  "Live unboxing of the week's bestseller",
  "Custom orders & samples — live",
];

const STREAMS: LiveStream[] = SUPPLIERS.slice(0, 6).map((s, i) => {
  const pinned = PRODUCTS.filter((p) => p.supplierId === s.id).slice(0, 4);
  return {
    id: `live-${s.id}`,
    supplier: s,
    title: TITLES[i % TITLES.length],
    viewers: 240 + ((s.rating * 1000 * (i + 1)) | 0) % 4800,
    startedMin: 4 + (i * 7) % 55,
    thumb: pinned[0]?.image ?? s.banner,
    pinnedProductIds: pinned.map((p) => p.id),
  };
});

const SAMPLE_USERS = [
  "🇺🇸 Mark", "🇩🇪 Lukas", "🇰🇷 Jihun", "🇧🇷 Ana", "🇮🇳 Riya",
  "🇫🇷 Léa", "🇯🇵 Sora", "🇪🇸 Diego", "🇳🇬 Tunde", "🇨🇦 Olivia",
];
const SAMPLE_MSGS = [
  "What's the MOQ?",
  "Do you ship to UAE?",
  "🔥🔥🔥",
  "Custom branding possible?",
  "Price for 1000 units?",
  "Lead time?",
  "Can I get a sample?",
  "Looks great 👏",
  "Add me to wholesale list",
  "Following!",
];

export default function Live() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(id ?? null);

  const active = useMemo(() => STREAMS.find((s) => s.id === activeId), [activeId]);

  if (!active) {
    return <LiveBrowser onPick={(s) => setActiveId(s.id)} onBack={() => navigate(-1)} />;
  }
  return <LiveRoom stream={active} onLeave={() => setActiveId(null)} />;
}

function LiveBrowser({
  onPick,
  onBack,
}: {
  onPick: (s: LiveStream) => void;
  onBack: () => void;
}) {
  const featured = STREAMS[0];
  return (
    <div className="pb-6">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold leading-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-destructive animate-pulse" /> Live now
          </h1>
          <p className="text-xs text-muted-foreground">
            {STREAMS.length} suppliers streaming · join free
          </p>
        </div>
      </div>

      {/* Featured */}
      <button
        onClick={() => onPick(featured)}
        className="mt-4 mx-4 block relative aspect-video rounded-3xl overflow-hidden shadow-elevated text-left"
      >
        <img src={featured.thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
        <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center gap-1 animate-pulse">
          <Radio className="w-3 h-3" /> LIVE
        </span>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center gap-1">
          <Eye className="w-3 h-3" /> {featured.viewers.toLocaleString()}
        </span>
        <div className="absolute bottom-3 inset-x-3 text-white">
          <p className="text-sm font-bold leading-tight">{featured.title}</p>
          <p className="text-[11px] mt-0.5 opacity-90">
            {featured.supplier.name} · {featured.supplier.country}
          </p>
        </div>
      </button>

      {/* Grid */}
      <h2 className="px-4 mt-6 text-sm font-bold">More streams</h2>
      <div className="grid grid-cols-2 gap-3 px-4 mt-2">
        {STREAMS.slice(1).map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-card text-left"
          >
            <img src={s.thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse">
              LIVE
            </span>
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-bold flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" />
              {s.viewers > 1000 ? (s.viewers / 1000).toFixed(1) + "K" : s.viewers}
            </span>
            <div className="absolute bottom-2 inset-x-2 text-white">
              <p className="text-[11px] font-bold leading-tight line-clamp-2">{s.title}</p>
              <p className="text-[10px] opacity-80 mt-0.5 truncate">{s.supplier.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

type ChatLine = { id: number; user: string; text: string; tone?: "join" | "msg" | "buy" | "gift" };

function LiveRoom({ stream, onLeave }: { stream: LiveStream; onLeave: () => void }) {
  const { addToCart } = useShop();
  const [viewers, setViewers] = useState(stream.viewers);
  const [likes, setLikes] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; left: number }[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([
    { id: 1, user: "PUBSTORE", text: "Welcome to the live! Be respectful 💬", tone: "join" },
  ]);
  const [input, setInput] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(2);

  const pinned = stream.pinnedProductIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  // Simulate viewers + chat traffic
  useEffect(() => {
    const a = setInterval(() => setViewers((v) => v + (Math.random() > 0.3 ? 1 : -1)), 1500);
    const b = setInterval(() => {
      const user = SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)];
      const text = SAMPLE_MSGS[Math.floor(Math.random() * SAMPLE_MSGS.length)];
      pushChat(user, text, "msg");
    }, 2200);
    const c = setInterval(() => {
      const user = SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)];
      pushChat(user, "joined", "join");
    }, 5000);
    return () => {
      clearInterval(a);
      clearInterval(b);
      clearInterval(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [chat]);

  // Cleanup floating hearts
  useEffect(() => {
    if (!hearts.length) return;
    const t = setTimeout(() => setHearts((h) => h.slice(1)), 1800);
    return () => clearTimeout(t);
  }, [hearts]);

  const pushChat = (user: string, text: string, tone: ChatLine["tone"] = "msg") => {
    setChat((prev) => [...prev.slice(-80), { id: idRef.current++, user, text, tone }]);
  };

  const sendHeart = () => {
    setLikes((v) => v + 1);
    setHearts((h) => [...h, { id: Date.now() + Math.random(), left: 60 + Math.random() * 30 }]);
  };

  const send = () => {
    const t = input.trim();
    if (!t) return;
    pushChat("You", t, "msg");
    setInput("");
  };

  const quickBuy = (p: Product) => {
    addToCart(p.id, p.moq);
    pushChat("You", `bought ${p.title.split(" ").slice(0, 3).join(" ")}…`, "buy");
    toast.success("Added to cart");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Background */}
      <img
        src={stream.thumb}
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />

      {/* Header */}
      <header className="relative z-10 safe-top px-3 pt-3 flex items-center gap-2">
        <Link
          to={`/supplier/${stream.supplier.id}`}
          className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full pl-1 pr-3 py-1"
        >
          <img src={stream.supplier.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
          <div className="text-xs leading-tight">
            <p className="font-bold flex items-center gap-1">
              {stream.supplier.name.split(" ")[0]}
              {stream.supplier.verified && <ShieldCheck className="w-3 h-3 text-sky-300" />}
              {stream.supplier.gold && <Award className="w-3 h-3 text-amber-300" />}
            </p>
            <p className="opacity-70 text-[10px]">{stream.supplier.country}</p>
          </div>
          <button className="ml-2 px-2.5 h-6 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            Follow
          </button>
        </Link>
        <span className="px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center gap-1 animate-pulse">
          <Radio className="w-3 h-3" /> LIVE
        </span>
        <span className="px-2 py-1 rounded-full bg-black/40 backdrop-blur text-[10px] font-bold flex items-center gap-1">
          <Eye className="w-3 h-3" /> {viewers.toLocaleString()}
        </span>
        <button
          onClick={onLeave}
          aria-label="Close"
          className="ml-auto w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Title strip */}
      <div className="relative z-10 px-3 mt-2">
        <p className="text-sm font-bold drop-shadow">{stream.title}</p>
        <p className="text-[10px] opacity-80">Started {stream.startedMin}m ago · {likes.toLocaleString()} likes</p>
      </div>

      {/* Pinned product strip */}
      <button
        onClick={() => setShowProducts(true)}
        className="relative z-10 mx-3 mt-3 flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-2 text-left"
      >
        <span className="w-9 h-9 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0">
          <Pin className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">Featured product · {pinned.length} items</p>
          <p className="text-[10px] opacity-80 truncate">{pinned[0]?.title}</p>
        </div>
        <span className="px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
          Shop
        </span>
      </button>

      {/* Spacer to push chat down */}
      <div className="flex-1 relative z-10" />

      {/* Chat overlay */}
      <div
        ref={chatRef}
        className="relative z-10 px-3 max-h-[42vh] overflow-y-auto scrollbar-none space-y-1.5 pb-2"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%)",
          maskImage: "linear-gradient(to bottom, transparent, black 30%)",
        }}
      >
        {chat.map((c) => (
          <div key={c.id} className="text-[12px] leading-snug">
            {c.tone === "join" ? (
              <p className="text-white/70">
                <span className="font-bold text-white">{c.user}</span> {c.text} 👋
              </p>
            ) : c.tone === "buy" ? (
              <p className="text-emerald-300">
                <span className="font-bold">{c.user}</span> {c.text} 🛍️
              </p>
            ) : c.tone === "gift" ? (
              <p className="text-amber-300">
                🎁 <span className="font-bold">{c.user}</span> {c.text}
              </p>
            ) : (
              <p>
                <span className="font-bold mr-1">{c.user}</span>
                <span className="text-white/95">{c.text}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Floating hearts */}
      <div className="pointer-events-none absolute right-2 bottom-24 z-10 w-20 h-64">
        {hearts.map((h) => (
          <Heart
            key={h.id}
            className="absolute bottom-0 w-7 h-7 fill-destructive text-destructive animate-[float-up_1.8s_ease-out_forwards]"
            style={{ left: h.left, animationFillMode: "forwards" }}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="relative z-10 px-3 pb-4 pt-2 safe-bottom flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-full bg-white/15 backdrop-blur border border-white/20 px-4 h-10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Say something…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/60 text-white"
          />
          <button onClick={send} aria-label="Send">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setShowProducts(true)}
          aria-label="Shop"
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center"
        >
          <ShoppingBag className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            pushChat("You", "sent a gift", "gift");
            toast.success("Gift sent 🎁");
          }}
          aria-label="Gift"
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center"
        >
          <Gift className="w-4 h-4 text-amber-300" />
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            toast.success("Live link copied");
          }}
          aria-label="Share"
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={sendHeart}
          aria-label="Like"
          className="w-10 h-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-card"
        >
          <Heart className="w-4 h-4 fill-current" />
        </button>
      </div>

      {/* Products sheet */}
      {showProducts && (
        <div
          className="absolute inset-0 z-20 bg-black/60 flex items-end"
          onClick={() => setShowProducts(false)}
        >
          <div
            className="w-full max-h-[70vh] bg-background text-foreground rounded-t-3xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold">Live picks · {pinned.length}</p>
              <button onClick={() => setShowProducts(false)} className="ml-auto p-1.5 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {pinned.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-2 shadow-soft">
                  <Link to={`/product/${p.id}`} onClick={() => setShowProducts(false)} className="shrink-0">
                    <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold line-clamp-2">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      MOQ {p.moq} {p.unit} · {p.leadTime}
                    </p>
                    <p className="text-sm font-bold mt-0.5">${p.price}</p>
                  </div>
                  <button
                    onClick={() => quickBuy(p)}
                    className="px-3 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-card"
                  >
                    Buy now
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
