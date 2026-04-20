import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Radio,
  Heart,
  Send,
  ShoppingBag,
  Share2,
  X,
  Eye,
  ShieldCheck,
  Award,
  Pin,
  PinOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import { toast } from "sonner";
import { fetchSupplier, fetchProducts, type Supplier, type Product } from "@/data/products";
import EmptyState from "@/components/EmptyState";

type DbStream = {
  id: string;
  supplier_id: string;
  title: string;
  cover: string | null;
  status: "scheduled" | "live" | "ended";
  viewer_count: number;
  started_at: string;
  pinned_product_id: string | null;
};

type EnrichedStream = DbStream & { supplier?: Supplier };

export default function Live() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(id ?? null);
  const [streams, setStreams] = useState<EnrichedStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerMap, setOwnerMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("*")
        .eq("status", "live")
        .order("started_at", { ascending: false });
      const list = (data ?? []) as DbStream[];
      const supplierIds = Array.from(new Set(list.map((s) => s.supplier_id)));
      const [suppliers, ownersRes] = await Promise.all([
        Promise.all(supplierIds.map((sid) => fetchSupplier(sid))),
        supabase.from("suppliers").select("id, owner_id").in("id", supplierIds.length ? supplierIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const map = new Map<string, Supplier>();
      suppliers.forEach((s) => s && map.set(s.id, s));
      const owners = new Map<string, string>();
      (ownersRes.data ?? []).forEach((r: any) => owners.set(r.id, r.owner_id));
      if (!cancelled) {
        setStreams(list.map((s) => ({ ...s, supplier: map.get(s.supplier_id) })));
        setOwnerMap(owners);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel("live-streams-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const active = useMemo(() => streams.find((s) => s.id === activeId), [activeId, streams]);

  if (activeId && !active && !loading) {
    return (
      <div className="pt-16">
        <EmptyState title="Stream ended" description="This live stream is no longer available." />
        <div className="px-4 mt-4">
          <button onClick={() => setActiveId(null)} className="text-sm font-bold text-primary">← Back to live</button>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <LiveRoom
        stream={active}
        hostUserId={ownerMap.get(active.supplier_id) ?? null}
        onLeave={() => { setActiveId(null); navigate("/live"); }}
      />
    );
  }

  return <LiveBrowser streams={streams} loading={loading} onPick={(s) => setActiveId(s.id)} onBack={() => navigate(-1)} />;
}

function LiveBrowser({
  streams,
  loading,
  onPick,
  onBack,
}: {
  streams: EnrichedStream[];
  loading: boolean;
  onPick: (s: EnrichedStream) => void;
  onBack: () => void;
}) {
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
            {loading ? "Loading…" : `${streams.length} suppliers streaming · join free`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
      ) : streams.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={<Radio className="w-7 h-7 text-muted-foreground" />}
            title="No live streams right now"
            description="Suppliers will appear here when they go live. Check back soon."
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => onPick(streams[0])}
            className="mt-4 mx-4 block relative aspect-video rounded-3xl overflow-hidden shadow-elevated text-left w-[calc(100%-2rem)]"
          >
            {streams[0].cover && (
              <img src={streams[0].cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
            <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center gap-1 animate-pulse">
              <Radio className="w-3 h-3" /> LIVE
            </span>
            <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center gap-1">
              <Eye className="w-3 h-3" /> {streams[0].viewer_count.toLocaleString()}
            </span>
            <div className="absolute bottom-3 inset-x-3 text-white">
              <p className="text-sm font-bold leading-tight">{streams[0].title}</p>
              <p className="text-[11px] mt-0.5 opacity-90">
                {streams[0].supplier?.name} · {streams[0].supplier?.country}
              </p>
            </div>
          </button>

          {streams.length > 1 && (
            <>
              <h2 className="px-4 mt-6 text-sm font-bold">More streams</h2>
              <div className="grid grid-cols-2 gap-3 px-4 mt-2">
                {streams.slice(1).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPick(s)}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-card text-left"
                  >
                    {s.cover && <img src={s.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse">
                      LIVE
                    </span>
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-bold flex items-center gap-0.5">
                      <Eye className="w-2.5 h-2.5" />
                      {s.viewer_count > 1000 ? (s.viewer_count / 1000).toFixed(1) + "K" : s.viewer_count}
                    </span>
                    <div className="absolute bottom-2 inset-x-2 text-white">
                      <p className="text-[11px] font-bold leading-tight line-clamp-2">{s.title}</p>
                      <p className="text-[10px] opacity-80 mt-0.5 truncate">{s.supplier?.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

type ChatLine = {
  id: string;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
};

function LiveRoom({ stream, hostUserId, onLeave }: { stream: EnrichedStream; hostUserId: string | null; onLeave: () => void }) {
  const { addToCart } = useShop();
  const [viewers, setViewers] = useState(stream.viewer_count);
  const [likes, setLikes] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; left: number }[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [pinned, setPinned] = useState<Product[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(stream.pinned_product_id);
  const chatRef = useRef<HTMLDivElement>(null);
  const sentViewerBumpRef = useRef(false);

  // Get user + check ownership
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: prof }, { data: sup }] = await Promise.all([
        supabase.from("profiles").select("display_name,username").eq("user_id", user.id).maybeSingle(),
        supabase.from("suppliers").select("owner_id").eq("id", stream.supplier_id).maybeSingle(),
      ]);
      setMe({
        id: user.id,
        name: prof?.display_name || prof?.username || (user.email?.split("@")[0] ?? "Guest"),
      });
      setIsOwner(sup?.owner_id === user.id);
    });
  }, [stream.supplier_id]);

  // Load supplier products + initial chat
  useEffect(() => {
    fetchProducts({ supplierId: stream.supplier_id, limit: 8 }).then(setPinned);
    supabase
      .from("live_messages")
      .select("*")
      .eq("stream_id", stream.id)
      .order("created_at", { ascending: true })
      .limit(80)
      .then(({ data }) => setChat((data ?? []) as ChatLine[]));
    supabase
      .from("live_reactions")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", stream.id)
      .then(({ count }) => setLikes(count ?? 0));
  }, [stream.id, stream.supplier_id]);

  // Bump viewer count once per join
  useEffect(() => {
    if (sentViewerBumpRef.current) return;
    sentViewerBumpRef.current = true;
    supabase
      .from("live_streams")
      .update({ viewer_count: stream.viewer_count + 1 })
      .eq("id", stream.id)
      .then(() => {});
    return () => {
      supabase
        .from("live_streams")
        .select("viewer_count")
        .eq("id", stream.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.viewer_count > 0) {
            supabase.from("live_streams").update({ viewer_count: data.viewer_count - 1 }).eq("id", stream.id).then(() => {});
          }
        });
    };
  }, [stream.id, stream.viewer_count]);

  // Realtime: messages, reactions, viewer count
  useEffect(() => {
    const ch = supabase
      .channel(`live:${stream.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_messages", filter: `stream_id=eq.${stream.id}` },
        (payload) => {
          setChat((prev) => [...prev.slice(-79), payload.new as ChatLine]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_reactions", filter: `stream_id=eq.${stream.id}` },
        () => {
          setLikes((v) => v + 1);
          setHearts((h) => [...h, { id: Date.now() + Math.random(), left: 60 + Math.random() * 30 }]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${stream.id}` },
        (payload) => {
          const next = payload.new as DbStream;
          setViewers(next.viewer_count);
          setPinnedId(next.pinned_product_id);
          if (next.status === "ended") {
            toast.info("This stream just ended");
            onLeave();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [stream.id, onLeave]);

  // Auto-scroll
  useEffect(() => {
    chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [chat]);

  // Cleanup floating hearts
  useEffect(() => {
    if (!hearts.length) return;
    const t = setTimeout(() => setHearts((h) => h.slice(1)), 1800);
    return () => clearTimeout(t);
  }, [hearts]);

  const sendHeart = async () => {
    if (!me) {
      toast.error("Sign in to react");
      return;
    }
    await supabase.from("live_reactions").insert({ stream_id: stream.id, user_id: me.id, kind: "heart" });
  };

  const send = async () => {
    const t = input.trim();
    if (!t) return;
    if (!me) {
      toast.error("Sign in to chat");
      return;
    }
    setInput("");
    const { error } = await supabase
      .from("live_messages")
      .insert({ stream_id: stream.id, user_id: me.id, username: me.name, body: t });
    if (error) toast.error(error.message);
  };

  const quickBuy = (p: Product) => {
    addToCart(p.id, p.moq);
    toast.success("Added to cart");
  };

  const togglePin = async (productId: string) => {
    if (!isOwner) return;
    const next = pinnedId === productId ? null : productId;
    const { error } = await supabase.from("live_streams").update({ pinned_product_id: next }).eq("id", stream.id);
    if (error) { toast.error(error.message); return; }
    setPinnedId(next);
    toast.success(next ? "Product pinned" : "Product unpinned");
  };

  const pinnedProduct = pinned.find((p) => p.id === pinnedId);

  const startedMin = Math.max(1, Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 60000));

  const FloatingPinned = pinnedProduct ? (
    <div className="absolute left-3 right-3 bottom-32 z-10 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur text-foreground p-2 pr-3 shadow-elevated border border-white/40 max-w-[calc(100%-3.5rem)]">
        <Link to={`/product/${pinnedProduct.id}`} className="shrink-0 relative">
          <img src={pinnedProduct.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
          <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card">
            <Pin className="w-3 h-3" />
          </span>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Featured live</p>
          <p className="text-xs font-semibold line-clamp-1 leading-tight">{pinnedProduct.title}</p>
          <p className="text-sm font-extrabold leading-tight">${pinnedProduct.price}<span className="text-[10px] font-normal text-muted-foreground ml-1">/ {pinnedProduct.unit}</span></p>
        </div>
        <button
          onClick={() => quickBuy(pinnedProduct)}
          className="shrink-0 px-3 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-card whitespace-nowrap"
        >
          Buy now
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {stream.cover && (
        <img
          src={stream.cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-70"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />

      <header className="relative z-10 safe-top px-3 pt-3 flex items-center gap-2">
        {stream.supplier && (
          <Link
            to={`/supplier/${stream.supplier.id}`}
            className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full pl-1 pr-3 py-1"
          >
            {stream.supplier.logo && <img src={stream.supplier.logo} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <div className="text-xs leading-tight">
              <p className="font-bold flex items-center gap-1">
                {stream.supplier.name.split(" ")[0]}
                {stream.supplier.verified && <ShieldCheck className="w-3 h-3 text-sky-300" />}
                {stream.supplier.gold && <Award className="w-3 h-3 text-amber-300" />}
              </p>
              <p className="opacity-70 text-[10px]">{stream.supplier.country}</p>
            </div>
          </Link>
        )}
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

      <div className="relative z-10 px-3 mt-2">
        <p className="text-sm font-bold drop-shadow">{stream.title}</p>
        <p className="text-[10px] opacity-80">Started {startedMin}m ago · {likes.toLocaleString()} likes</p>
      </div>

      <div className="flex-1 relative z-10" />

      <div
        ref={chatRef}
        className="relative z-10 px-3 max-h-[42vh] overflow-y-auto scrollbar-none space-y-1.5 pb-2"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%)",
          maskImage: "linear-gradient(to bottom, transparent, black 30%)",
        }}
      >
        {chat.length === 0 && (
          <p className="text-[12px] text-white/60 italic">Be the first to say hi 👋</p>
        )}
        {chat.map((c) => {
          const isHost = stream.supplier && c.user_id === (stream.supplier as any).owner_id;
          return (
            <div key={c.id} className="text-[12px] leading-snug">
              <p>
                {isHost && (
                  <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-extrabold uppercase tracking-wide align-middle">
                    Host
                  </span>
                )}
                <span className={`font-bold mr-1 ${isHost ? "text-primary-foreground bg-primary/30 px-1 rounded" : ""}`}>
                  {c.username || "Guest"}
                </span>
                <span className="text-white/95">{c.body}</span>
              </p>
            </div>
          );
        })}
      </div>

      {FloatingPinned}

      <div className="pointer-events-none absolute right-2 bottom-24 z-10 w-20 h-64">
        {hearts.map((h) => (
          <Heart
            key={h.id}
            className="absolute bottom-0 w-7 h-7 fill-destructive text-destructive animate-[float-up_1.8s_ease-out_forwards]"
            style={{ left: h.left, animationFillMode: "forwards" }}
          />
        ))}
      </div>

      <div className="relative z-10 px-3 pb-4 pt-2 safe-bottom flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-full bg-white/15 backdrop-blur border border-white/20 px-4 h-10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={me ? "Say something…" : "Sign in to chat"}
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
              <ShoppingBag className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold">Live picks · {pinned.length}</p>
              <button onClick={() => setShowProducts(false)} className="ml-auto p-1.5 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {pinned.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No products listed yet</p>
              ) : (
                pinned.map((p) => {
                  const isPinned = p.id === pinnedId;
                  return (
                    <div key={p.id} className={`flex items-center gap-3 rounded-2xl border p-2 shadow-soft ${isPinned ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border"}`}>
                      <Link to={`/product/${p.id}`} onClick={() => setShowProducts(false)} className="shrink-0 relative">
                        <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                        {isPinned && (
                          <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card">
                            <Pin className="w-3 h-3" />
                          </span>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold line-clamp-2">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          MOQ {p.moq} {p.unit} · {p.leadTime}
                        </p>
                        <p className="text-sm font-bold mt-0.5">${p.price}</p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {isOwner && (
                          <button
                            onClick={() => togglePin(p.id)}
                            aria-label={isPinned ? "Unpin" : "Pin"}
                            className={`px-2 h-8 rounded-full text-[10px] font-bold flex items-center gap-1 ${isPinned ? "bg-muted text-foreground" : "bg-amber-400 text-foreground"}`}
                          >
                            {isPinned ? <><PinOff className="w-3 h-3" /> Unpin</> : <><Pin className="w-3 h-3" /> Pin</>}
                          </button>
                        )}
                        <button
                          onClick={() => quickBuy(p)}
                          className="px-3 h-8 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-card"
                        >
                          Buy now
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
