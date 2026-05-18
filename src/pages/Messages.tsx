import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Search, Send, ShieldCheck, ArrowLeft, MessageCircle, Sparkles,
  Image as ImageIcon, Heart, Phone, Video, Info, Mic, Camera,
  Reply, Forward, Copy, Trash2, SmilePlus, X, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveMasterSupplierId, fetchProducts, type Product } from "@/data/products";
import SupplierStories from "@/components/marketplace/SupplierStories";
import { useUnreadChats, markConversationRead } from "@/hooks/useUnreadChats";
import AttachmentCard, { type ChatAttachment } from "@/components/chat/AttachmentCard";
import InquiryApprovalPanel from "@/components/marketplace/InquiryApprovalPanel";
import PendingInquiriesInbox from "@/components/marketplace/PendingInquiriesInbox";
import { toast } from "@/hooks/use-toast";

const chunk = <T,>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
};

type Conversation = {
  id: string;
  buyer_id: string;
  supplier_id: string | null;
  peer_user_id?: string | null;
  kind?: "buyer_supplier" | "dm" | "group_buy" | null;
  title?: string | null;
  last_message: string | null;
  last_message_at: string | null;
  supplier?: { id: string; name: string; logo: string | null; verified: boolean | null; response_time: string | null; response_rate: number | null; owner_id: string };
  peer?: { name: string; logo: string | null; verified: boolean | null; subtitle: string | null; supplierId?: string };
};

type TabKey = "unread" | "suppliers" | "people" | "groups" | "discover";

type Reactions = Record<string, string[]>; // emoji -> userIds

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment?: ChatAttachment | null;
  reply_to_id?: string | null;
  reactions?: Reactions | null;
  forwarded?: boolean | null;
};

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

const fmtTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const fmtDayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

const dayKey = (iso: string) => new Date(iso).toDateString();

// Cast helper for untyped Supabase rows -> Message
const toMsg = (r: any): Message => ({
  id: r.id,
  conversation_id: r.conversation_id,
  sender_id: r.sender_id,
  body: r.body,
  created_at: r.created_at,
  attachment: (r.attachment ?? null) as ChatAttachment | null,
  reply_to_id: r.reply_to_id ?? null,
  reactions: (r.reactions ?? {}) as Reactions,
  forwarded: r.forwarded ?? false,
});

// ============================================================
// Swipeable bubble — drag right (theirs) / left (mine) to reply
// ============================================================
function SwipeBubble({
  mine,
  onReply,
  onLongPress,
  onDoubleTap,
  children,
}: {
  mine: boolean;
  onReply: () => void;
  onLongPress: () => void;
  onDoubleTap: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const dragging = useRef(false);
  const decided = useRef<"none" | "swipe" | "scroll">("none");
  const lastTap = useRef(0);
  const lpTimer = useRef<number | null>(null);

  const dir = mine ? -1 : 1; // mine swipes left (-), theirs swipe right (+)
  const triggered = Math.abs(dx) > 56;

  const clearLP = () => {
    if (lpTimer.current) { window.clearTimeout(lpTimer.current); lpTimer.current = null; }
  };

  return (
    <div
      onTouchStart={(e) => {
        const t = e.touches[0];
        startX.current = t.clientX;
        startY.current = t.clientY;
        startT.current = Date.now();
        dragging.current = true;
        decided.current = "none";
        lpTimer.current = window.setTimeout(() => {
          if (decided.current !== "swipe") onLongPress();
        }, 420);
      }}
      onTouchMove={(e) => {
        if (!dragging.current) return;
        const t = e.touches[0];
        const ax = t.clientX - startX.current;
        const ay = t.clientY - startY.current;
        if (decided.current === "none") {
          if (Math.abs(ay) > 10 && Math.abs(ay) > Math.abs(ax)) {
            decided.current = "scroll";
            clearLP();
            return;
          }
          if (Math.abs(ax) > 8) {
            decided.current = "swipe";
            clearLP();
          }
        }
        if (decided.current !== "swipe") return;
        // only allow swipe in correct direction
        const proj = dir > 0 ? Math.max(0, ax) : Math.min(0, ax);
        setDx(Math.max(-90, Math.min(90, proj)));
      }}
      onTouchEnd={() => {
        clearLP();
        if (decided.current === "swipe" && triggered) {
          onReply();
        }
        dragging.current = false;
        setDx(0);
      }}
      onTouchCancel={() => { clearLP(); dragging.current = false; setDx(0); }}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      onClick={() => {
        const now = Date.now();
        if (now - lastTap.current < 320) {
          lastTap.current = 0;
          onDoubleTap();
        } else {
          lastTap.current = now;
        }
      }}
      className="relative"
    >
      {/* Reply icon revealed during swipe */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 ${mine ? "right-1" : "left-1"} pointer-events-none transition-opacity`}
        style={{ opacity: Math.min(1, Math.abs(dx) / 56) }}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${triggered ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Reply className="w-4 h-4" />
        </div>
      </div>
      <div
        style={{ transform: `translateX(${dx}px)`, transition: dragging.current ? "none" : "transform .2s ease-out" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const initialSupplierId = params.get("supplier");
  const initialPrefill = params.get("prefill");
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { perConversation } = useUnreadChats();
  const [tab, setTab] = useState<TabKey>("suppliers");

  const loadConversations = useCallback(async (uid: string) => {
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`buyer_id.eq.${uid}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    const { data: mySup } = await supabase.from("suppliers").select("id").eq("owner_id", uid);
    let supConvs: Conversation[] = [];
    if (mySup?.length) {
      const ids = mySup.map((s) => s.id);
      const batches = await Promise.all(
        chunk(ids, 50).map(async (group) => {
          const { data } = await supabase
            .from("conversations")
            .select("*")
            .in("supplier_id", group)
            .order("last_message_at", { ascending: false, nullsFirst: false });
          return (data ?? []) as Conversation[];
        }),
      );
      supConvs = batches.flat();
    }

    // Membership-based: DMs and group_buy chats where the user is a participant
    // but not the buyer or supplier owner.
    const { data: memberRows } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", uid);
    const memberIds = (memberRows ?? []).map((r: any) => r.conversation_id);
    let memberConvs: Conversation[] = [];
    if (memberIds.length) {
      const batches = await Promise.all(
        chunk(memberIds, 50).map(async (group) => {
          const { data } = await supabase
            .from("conversations")
            .select("*")
            .in("id", group);
          return (data ?? []) as Conversation[];
        }),
      );
      memberConvs = batches.flat();
    }

    const merged = [...((convs ?? []) as Conversation[]), ...supConvs, ...memberConvs]
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
      .sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
    const supplierIds = Array.from(new Set(merged.map((c) => c.supplier_id).filter(Boolean))) as string[];
    if (supplierIds.length) {
      const supBatches = await Promise.all(
        chunk(supplierIds, 50).map(async (group) => {
          const { data } = await supabase
            .from("suppliers")
            .select("id,name,logo,verified,response_time,response_rate,owner_id")
            .in("id", group);
          return data ?? [];
        }),
      );
      const sups = supBatches.flat();
      const map = new Map(sups.map((s) => [s.id, s as Conversation["supplier"]]));
      merged.forEach((c) => { if (c.supplier_id) c.supplier = map.get(c.supplier_id); });
    }

    // Profiles for owner-side buyer rows and DM peers
    const profileIds = new Set<string>();
    merged.forEach((c) => {
      if (c.supplier?.owner_id === uid && c.buyer_id !== uid) profileIds.add(c.buyer_id);
      if ((c.kind ?? "buyer_supplier") === "dm") {
        const peer = c.peer_user_id ?? (c.buyer_id === uid ? null : c.buyer_id);
        if (peer && peer !== uid) profileIds.add(peer);
      }
    });
    let profileMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (profileIds.size) {
      const profBatches = await Promise.all(
        chunk(Array.from(profileIds), 50).map(async (group) => {
          const { data } = await supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .in("user_id", group);
          return data ?? [];
        }),
      );
      profileMap = new Map(profBatches.flat().map((p: any) => [p.user_id, p]));
    }
    merged.forEach((c) => {
      const kind = c.kind ?? "buyer_supplier";
      if (kind === "group_buy") {
        c.peer = { name: c.title ?? "Group buy", logo: null, verified: false, subtitle: "Group chat" };
        return;
      }
      if (kind === "dm") {
        const peerId = c.peer_user_id ?? (c.buyer_id === uid ? null : c.buyer_id);
        const p = peerId ? profileMap.get(peerId) : null;
        const name = p?.display_name || p?.username || "Direct message";
        c.peer = { name, logo: p?.avatar_url ?? null, verified: false, subtitle: p?.username ? `@${p.username}` : "Direct message" };
        return;
      }
      const userIsOwner = c.supplier?.owner_id === uid;
      if (userIsOwner) {
        const p = profileMap.get(c.buyer_id);
        const name = p?.display_name || p?.username || "Customer";
        c.peer = { name, logo: p?.avatar_url ?? null, verified: false, subtitle: p?.username ? `@${p.username}` : "Customer", supplierId: c.supplier?.id };
      } else if (c.supplier) {
        c.peer = {
          name: c.supplier.name,
          logo: c.supplier.logo,
          verified: c.supplier.verified,
          subtitle: c.supplier.response_time ? `Responds ${c.supplier.response_time}` : "Active now",
          supplierId: c.supplier.id,
        };
      }
    });
    setConversations(merged);
    setLoading(false);
  }, []);

  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setLoading(false);
        if (initialSupplierId) {
          navigate(`/auth?redirect=${encodeURIComponent(`/messages?supplier=${initialSupplierId}`)}`, { replace: true });
        }
        return;
      }
      setUserId(user.id);
      await loadConversations(user.id);
    })();
    return () => { alive = false; };
  }, [loadConversations, initialSupplierId, navigate]);

  useEffect(() => {
    if (!userId || !initialSupplierId) return;
    (async () => {
      const targetSupplierId = await resolveMasterSupplierId(initialSupplierId);
      const existing = conversations.find((c) => c.supplier_id === targetSupplierId && c.buyer_id === userId);
      if (existing) {
        setActiveId(existing.id);
        if (initialPrefill) setDraft(initialPrefill);
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: userId, supplier_id: targetSupplierId })
        .select("*").single();
      if (error || !data) return;
      await loadConversations(userId);
      setActiveId(data.id);
      if (initialPrefill) setDraft(initialPrefill);
      setParams({}, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, initialSupplierId, conversations.length]);

  useEffect(() => {
    if (!activeId) { setMessages([]); setReplyTo(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (alive) setMessages((data ?? []).map(toMsg));
      markConversationRead(activeId);
    })();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = toMsg(payload.new);
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          markConversationRead(activeId, m.created_at);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = toMsg(payload.new);
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => prev.filter((x) => x.id !== (payload.old as any).id));
        },
      )
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [activeId]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`conv-list:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations(userId))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadConversations(userId))
      .subscribe();
    const refresh = () => { if (document.visibilityState === "visible") loadConversations(userId); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const poll = window.setInterval(refresh, 15000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(poll);
    };
  }, [userId, loadConversations]);

  const stickRef = useRef(true);
  const onThreadScroll = () => {
    const el = scrollRef.current; if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distance < 80;
  };
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const insertMessage = async (
    convId: string,
    payload: { body: string; attachment?: ChatAttachment | null; reply_to_id?: string | null; forwarded?: boolean },
  ) => {
    if (!userId) return null;
    const tempId = `temp:${Date.now()}`;
    const nowIso = new Date().toISOString();
    stickRef.current = true;
    if (convId === activeId) {
      setMessages((prev) => [...prev, {
        id: tempId, conversation_id: convId, sender_id: userId, body: payload.body,
        created_at: nowIso, attachment: payload.attachment ?? null,
        reply_to_id: payload.reply_to_id ?? null, reactions: {}, forwarded: payload.forwarded ?? false,
      }]);
    }
    const { data, error } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: userId,
      body: payload.body,
      attachment: (payload.attachment ?? null) as any,
      reply_to_id: payload.reply_to_id ?? null,
      forwarded: payload.forwarded ?? false,
    }).select("*").single();
    if (error || !data) {
      if (convId === activeId) setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return null;
    }
    const inserted = toMsg(data);
    if (convId === activeId) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m))
        .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i));
    }
    await supabase.from("conversations")
      .update({ last_message: payload.body, last_message_at: new Date().toISOString() })
      .eq("id", convId);
    return inserted;
  };

  const send = async () => {
    if (!draft.trim() || !activeId || !userId) return;
    const body = draft.trim();
    setDraft("");
    const reply = replyTo;
    setReplyTo(null);
    await insertMessage(activeId, { body, reply_to_id: reply?.id ?? null });
    const conv = conversations.find((c) => c.id === activeId);
    const otherId = conv?.buyer_id === userId ? conv?.supplier?.owner_id : conv?.buyer_id;
    if (otherId && otherId !== userId) {
      await supabase.from("notifications").insert({
        user_id: otherId, type: "message", title: "New message",
        body: body.length > 80 ? body.slice(0, 80) + "…" : body, link: "/messages",
      });
    }
  };

  const sendAttachment = async (attachment: ChatAttachment) => {
    if (!activeId || !userId) return;
    const previewLabel =
      attachment.kind === "product" ? `📦 ${attachment.title}`
      : attachment.kind === "supplier" ? `🏬 ${attachment.name}`
      : attachment.kind === "wishlist" ? `❤️ Wishlist · ${attachment.count} items`
      : attachment.kind === "cart-unlock" ? `✅ Cart unlocked · ${attachment.title}`
      : `🗂 Catalog · ${attachment.count} items`;
    await insertMessage(activeId, { body: previewLabel, attachment, reply_to_id: replyTo?.id ?? null });
    setReplyTo(null);
  };

  const sendHeartReply = async () => {
    if (!activeId || !userId) return;
    await insertMessage(activeId, { body: "❤️" });
  };

  // Long press / actions
  const openActions = (m: Message) => setActionMsg(m);
  const handleReply = (m: Message) => { setReplyTo(m); setActionMsg(null); };
  const handleCopy = async (m: Message) => {
    try { await navigator.clipboard.writeText(m.body); toast({ title: "Copied" }); } catch {}
    setActionMsg(null);
  };
  const handleDelete = async (m: Message) => {
    setActionMsg(null);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    await supabase.from("messages").delete().eq("id", m.id);
  };
  const toggleReaction = async (m: Message, emoji: string) => {
    if (!userId) return;
    const current: Reactions = { ...(m.reactions ?? {}) };
    Object.keys(current).forEach((k) => {
      current[k] = (current[k] ?? []).filter((u) => u !== userId);
      if (current[k].length === 0) delete current[k];
    });
    const had = (m.reactions?.[emoji] ?? []).includes(userId);
    if (!had) current[emoji] = [...(current[emoji] ?? []), userId];
    setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, reactions: current } : x));
    setActionMsg(null);
    await supabase.from("messages").update({ reactions: current as any }).eq("id", m.id);
  };
  const handleForward = async (target: Conversation) => {
    if (!forwardMsg) return;
    await insertMessage(target.id, {
      body: forwardMsg.body,
      attachment: forwardMsg.attachment ?? null,
      forwarded: true,
    });
    toast({ title: "Forwarded" });
    setForwardMsg(null);
  };

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  useEffect(() => {
    if (!productPickerOpen) return;
    let alive = true;
    setProductLoading(true);
    fetchProducts({ limit: 24, search: productQuery || undefined }).then((r) => {
      if (alive) { setProductResults(r); setProductLoading(false); }
    }).catch(() => alive && setProductLoading(false));
    return () => { alive = false; };
  }, [productPickerOpen, productQuery]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = (c.title ?? c.peer?.name ?? c.supplier?.name ?? "").toLowerCase();
      if (q && !name.includes(q)) return false;
      const k = c.kind ?? "buyer_supplier";
      if (tab === "unread") return (perConversation[c.id] ?? 0) > 0;
      if (tab === "suppliers") return k === "buyer_supplier";
      if (tab === "people") return k === "dm";
      if (tab === "groups") return k === "group_buy";
      return true;
    });
  }, [conversations, search, tab, perConversation]);

  const active = conversations.find((c) => c.id === activeId);
  const messageMap = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  if (active) {
    const supplierOwnerId = active.supplier?.owner_id;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-fade-in">
        {/* Header */}
        <div className="px-2 py-2 border-b border-border/60 glass-strong shadow-soft flex items-center gap-2 z-10 safe-top">
          <button onClick={() => setActiveId(null)} aria-label="Back" className="p-2 rounded-full hover:bg-muted active:scale-95 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative shrink-0">
            <div className="ring-gradient w-11 h-11 rounded-full p-[2px]">
              {active.peer?.logo ? (
                <img src={active.peer.logo} alt="" className="w-full h-full rounded-full object-cover bg-card" />
              ) : (
                <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {active.peer?.name?.[0] ?? active.supplier?.name?.[0] ?? "S"}
                </div>
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse-dot" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate flex items-center gap-1">
              {active.peer?.name ?? active.supplier?.name}
              {active.peer?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 fill-primary/20" />}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {active.peer?.subtitle ?? "Active now"}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button aria-label="Call" className="p-2 rounded-full hover:bg-muted active:scale-90 transition"><Phone className="w-5 h-5" strokeWidth={1.9} /></button>
            <button aria-label="Video" className="p-2 rounded-full hover:bg-muted active:scale-90 transition"><Video className="w-5 h-5" strokeWidth={1.9} /></button>
            {active.supplier && (
              <Link to={`/supplier/${active.supplier.id}`} aria-label="Info" className="p-2 rounded-full hover:bg-muted active:scale-90 transition">
                <Info className="w-5 h-5" strokeWidth={1.9} />
              </Link>
            )}
          </div>
        </div>

        {supplierOwnerId === userId && active.supplier && userId && (
          <InquiryApprovalPanel buyerId={active.buyer_id} supplierId={active.supplier.id} userId={userId} />
        )}

        {/* Thread */}
        <div ref={scrollRef} onScroll={onThreadScroll} className="chat-scroll flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
              <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 rounded-full bg-ig-gradient opacity-20 blur-xl" />
                <div className="relative w-full h-full rounded-full bg-ig-gradient flex items-center justify-center shadow-pop">
                  <MessageCircle className="w-9 h-9 text-white" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-base font-bold mb-1">Say hi 👋</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mb-4">
                Start the conversation. Tap and hold any message to reply, react, forward, or copy.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Is this in stock?", "What's the MOQ?", "Can you ship to my country?"].map((s) => (
                  <button key={s} onClick={() => setDraft(s)} className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-accent border border-border/60 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.sender_id === userId;
              const isHost = supplierOwnerId && m.sender_id === supplierOwnerId;
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const showDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
              const sameAsPrev = prev && prev.sender_id === m.sender_id && !showDay;
              const sameAsNext = next && next.sender_id === m.sender_id && dayKey(next.created_at) === dayKey(m.created_at);
              const showTail = !sameAsNext;
              const isLast = i === messages.length - 1;
              const att = m.attachment ?? null;
              const hasBody = m.body && m.body.trim().length > 0;
              const replied = m.reply_to_id ? messageMap.get(m.reply_to_id) : null;
              const reactionEntries = Object.entries(m.reactions ?? {}).filter(([, ids]) => ids.length > 0);

              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex items-center justify-center my-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                        {fmtDayLabel(m.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} ${sameAsPrev ? "mt-0.5" : "mt-2"}`}>
                    <SwipeBubble
                      mine={mine}
                      onReply={() => setReplyTo(m)}
                      onLongPress={() => openActions(m)}
                      onDoubleTap={() => toggleReaction(m, "❤️")}
                    >
                      {att ? (
                        <div className={`max-w-[80vw] flex flex-col ${mine ? "items-end" : "items-start"} gap-1 ${isLast ? "animate-bubble-pop" : ""}`}>
                          {m.forwarded && <p className="text-[10px] italic text-muted-foreground flex items-center gap-1 px-1"><Forward className="w-3 h-3" /> Forwarded</p>}
                          {hasBody && (
                            <div className={`relative px-3.5 py-2 text-sm rounded-2xl ${mine ? "bubble-mine rounded-br-md" : "bg-card text-foreground border border-border/50 shadow-soft rounded-bl-md"}`}>
                              {replied && <ReplyQuote message={replied} mine={mine} />}
                              <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                            </div>
                          )}
                          <AttachmentCard attachment={att} mine={mine} />
                          <p className="text-[10px] text-muted-foreground px-1">{fmtTime(m.created_at)}</p>
                          {reactionEntries.length > 0 && <ReactionChips entries={reactionEntries} mine={mine} />}
                        </div>
                      ) : (
                        <div className={`max-w-[78vw] flex flex-col ${mine ? "items-end" : "items-start"} ${isLast ? "animate-bubble-pop" : ""}`}>
                          {m.forwarded && <p className="text-[10px] italic text-muted-foreground flex items-center gap-1 px-1 mb-0.5"><Forward className="w-3 h-3" /> Forwarded</p>}
                          <div
                            className={`relative px-3.5 py-2 text-sm ${
                              mine
                                ? `bubble-mine rounded-2xl ${showTail ? "rounded-br-md bubble-tail-mine" : "rounded-br-2xl"}`
                                : `bg-card text-foreground border border-border/50 shadow-soft rounded-2xl ${showTail ? "rounded-bl-md bubble-tail-theirs" : "rounded-bl-2xl"}`
                            }`}
                          >
                            {!mine && isHost && showTail && (
                              <span className="inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-full bg-ig-gradient text-white text-[9px] font-bold uppercase tracking-wide">
                                <Sparkles className="w-2.5 h-2.5" /> Host
                              </span>
                            )}
                            {replied && <ReplyQuote message={replied} mine={mine} />}
                            <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                            <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/75" : "text-muted-foreground"} text-right`}>
                              {fmtTime(m.created_at)}
                            </p>
                          </div>
                          {reactionEntries.length > 0 && <ReactionChips entries={reactionEntries} mine={mine} />}
                        </div>
                      )}
                    </SwipeBubble>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply preview */}
        {replyTo && (
          <div className="px-3 py-2 border-t border-border/60 bg-muted/40 flex items-center gap-2 animate-fade-in">
            <div className="w-1 self-stretch rounded bg-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                Replying to {replyTo.sender_id === userId ? "yourself" : (active.peer?.name ?? "them")}
              </p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.body || "Attachment"}</p>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="p-1.5 rounded-full hover:bg-background/60">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Composer */}
        <div className="px-2 py-2 border-t border-border/60 glass-strong shadow-elevated flex items-center gap-1.5 safe-bottom">
          <button onClick={() => setProductPickerOpen(true)} aria-label="Share product" className="w-9 h-9 rounded-full bg-ig-gradient text-white flex items-center justify-center active:scale-90 transition shadow-soft">
            <Camera className="w-4 h-4" />
          </button>
          <div className="flex-1 relative flex items-center bg-muted rounded-full pr-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message..."
              className="flex-1 h-10 pl-4 pr-2 bg-transparent text-sm outline-none"
            />
            {!draft.trim() && (
              <>
                <button aria-label="Mic" className="w-8 h-8 rounded-full hover:bg-background/60 flex items-center justify-center text-foreground/70"><Mic className="w-4 h-4" /></button>
                <button onClick={() => setProductPickerOpen(true)} aria-label="Gallery" className="w-8 h-8 rounded-full hover:bg-background/60 flex items-center justify-center text-foreground/70"><ImageIcon className="w-4 h-4" /></button>
                <button onClick={sendHeartReply} aria-label="Heart" className="w-8 h-8 rounded-full hover:bg-background/60 flex items-center justify-center text-foreground/70"><Heart className="w-4 h-4" /></button>
              </>
            )}
          </div>
          {draft.trim() && (
            <button onClick={send} aria-label="Send" className="w-10 h-10 rounded-full flex items-center justify-center bg-ig-gradient text-white shadow-pop active:scale-90 transition">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action sheet */}
        {actionMsg && (
          <ActionSheet
            message={actionMsg}
            mine={actionMsg.sender_id === userId}
            onClose={() => setActionMsg(null)}
            onReply={() => handleReply(actionMsg)}
            onReact={(e) => toggleReaction(actionMsg, e)}
            onForward={() => { setForwardMsg(actionMsg); setActionMsg(null); }}
            onCopy={() => handleCopy(actionMsg)}
            onDelete={() => handleDelete(actionMsg)}
          />
        )}

        {/* Forward sheet */}
        {forwardMsg && (
          <ForwardSheet
            conversations={conversations.filter((c) => c.id !== activeId)}
            currentUserId={userId}
            onClose={() => setForwardMsg(null)}
            onPick={handleForward}
            preview={forwardMsg.body}
          />
        )}

        {/* Product picker overlay */}
        {productPickerOpen && (
          <div className="absolute inset-0 z-[70] bg-background/95 backdrop-blur-sm flex flex-col animate-fade-in">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60 safe-top">
              <button onClick={() => setProductPickerOpen(false)} aria-label="Close" className="p-2 rounded-full hover:bg-muted active:scale-90 transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <p className="font-bold text-sm">Share a product</p>
            </div>
            <div className="px-3 py-2 border-b border-border/60">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search products" className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {productLoading ? (
                <p className="text-center text-xs text-muted-foreground py-10">Loading…</p>
              ) : productResults.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-10">No products found</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {productResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        await sendAttachment({ kind: "product", id: p.id, title: p.title, image: p.image, price: p.price });
                        setProductPickerOpen(false);
                      }}
                      className="text-left active:scale-95 transition"
                    >
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[11px] font-semibold line-clamp-2 leading-snug mt-1">{p.title}</p>
                      <p className="text-[10px] font-bold text-destructive">${p.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>,
      document.body,
    );
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 border-b border-border/60 glass-strong sticky top-14 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-extrabold tracking-tight"><span className="text-gradient-ig">Messages</span></h1>
          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {filtered.length} {filtered.length === 1 ? "chat" : "chats"}
          </span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {([
            ["unread", "Unread"], ["suppliers", "Suppliers"], ["people", "People"], ["groups", "Groups"],
          ] as const).map(([k, label]) => {
            const active = tab === k;
            const count = k === "unread"
              ? Object.values(perConversation).filter((n) => n > 0).length
              : conversations.filter((c) => {
                  const ck = c.kind ?? "buyer_supplier";
                  if (k === "suppliers") return ck === "buyer_supplier";
                  if (k === "people") return ck === "dm";
                  if (k === "groups") return ck === "group_buy";
                  return false;
                }).length;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition ${active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
              >
                {label}{count > 0 && <span className={`ml-1.5 ${active ? "opacity-80" : ""}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-border/60"><SupplierStories /></div>

      {userId && <PendingInquiriesInbox userId={userId} />}

      {loading ? (
        <div className="px-4 pt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 px-6 animate-fade-in">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-ig-gradient opacity-20 blur-xl" />
            <div className="relative w-full h-full rounded-full bg-ig-gradient flex items-center justify-center shadow-pop">
              <MessageCircle className="w-9 h-9 text-white" strokeWidth={2} />
            </div>
          </div>
          <p className="text-base font-bold">No conversations yet</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] mx-auto">
            Open a supplier's store and tap <span className="font-semibold text-foreground">Contact supplier</span> to start chatting.
          </p>
        </div>
      ) : (
        <ul className="px-2 pt-2">
          {filtered.map((c, i) => {
            const unread = perConversation[c.id] ?? 0;
            return (
              <li key={c.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in">
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:scale-[0.99] transition text-left ${unread > 0 ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/60"}`}
                >
                  <div className="relative shrink-0">
                    <div className="ring-gradient rounded-full p-[2px]" style={{ width: 52, height: 52 }}>
                      {c.peer?.logo ? (
                        <img src={c.peer.logo} alt="" className="w-full h-full rounded-full object-cover bg-card" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                          {(c.peer?.name ?? c.supplier?.name ?? "S")[0]}
                        </div>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate flex items-center gap-1 ${unread > 0 ? "font-extrabold" : "font-bold"}`}>
                        {c.peer?.name ?? c.supplier?.name ?? "Conversation"}
                        {c.peer?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 fill-primary/20" />}
                      </p>
                      <span className={`text-[10px] shrink-0 ${unread > 0 ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {fmtTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${unread > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {c.last_message ?? "No messages yet — say hi 👋"}
                      </p>
                      {unread > 0 && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-soft">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ReplyQuote({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={`mb-1.5 -mt-0.5 -mx-1 px-2 py-1 rounded-lg border-l-[3px] text-[11px] leading-tight ${mine ? "bg-white/15 border-white/70" : "bg-muted/70 border-primary"}`}>
      <p className={`font-bold ${mine ? "text-primary-foreground" : "text-primary"} truncate`}>
        {message.body ? "Message" : message.attachment?.kind === "product" ? "Product" : "Attachment"}
      </p>
      <p className={`truncate ${mine ? "text-primary-foreground/80" : "text-foreground/70"}`}>
        {message.body || (message.attachment?.kind === "product" ? message.attachment.title : "Shared item")}
      </p>
    </div>
  );
}

function ReactionChips({ entries, mine }: { entries: [string, string[]][]; mine: boolean }) {
  return (
    <div className={`flex gap-1 -mt-1 ${mine ? "self-end" : "self-start"} ml-1`}>
      {entries.map(([emoji, ids]) => (
        <span key={emoji} className="text-[11px] bg-card border border-border/60 rounded-full px-1.5 py-0.5 shadow-soft flex items-center gap-0.5">
          <span>{emoji}</span>
          {ids.length > 1 && <span className="text-[9px] font-bold text-muted-foreground">{ids.length}</span>}
        </span>
      ))}
    </div>
  );
}

function ActionSheet({
  message, mine, onClose, onReply, onReact, onForward, onCopy, onDelete,
}: {
  message: Message;
  mine: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (e: string) => void;
  onForward: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-end animate-fade-in" onClick={onClose}>
      <div className="w-full bg-background rounded-t-3xl shadow-elevated p-2 pb-6 safe-bottom animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-1 mb-3 h-1.5 w-12 rounded-full bg-muted" />
        {/* Reactions row */}
        <div className="flex justify-around items-center px-2 py-2 mb-2 bg-muted/50 rounded-2xl">
          {QUICK_REACTIONS.map((e) => {
            const active = (message.reactions?.[e] ?? []).length > 0;
            return (
              <button key={e} onClick={() => onReact(e)} className={`text-2xl p-1.5 rounded-full active:scale-90 transition ${active ? "bg-primary/15" : ""}`}>
                {e}
              </button>
            );
          })}
        </div>
        <Action icon={<Reply className="w-5 h-5" />} label="Reply" onClick={onReply} />
        <Action icon={<Forward className="w-5 h-5" />} label="Forward" onClick={onForward} />
        <Action icon={<Copy className="w-5 h-5" />} label="Copy" onClick={onCopy} disabled={!message.body} />
        <Action icon={<SmilePlus className="w-5 h-5" />} label="React" onClick={() => onReact("❤️")} />
        {mine && <Action icon={<Trash2 className="w-5 h-5" />} label="Delete" onClick={onDelete} danger />}
      </div>
    </div>
  );
}

function Action({ icon, label, onClick, disabled, danger }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold active:scale-[0.99] transition ${danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted"} disabled:opacity-40`}
    >
      <span className={`w-9 h-9 rounded-full flex items-center justify-center ${danger ? "bg-destructive/10" : "bg-muted"}`}>{icon}</span>
      {label}
    </button>
  );
}

function ForwardSheet({
  conversations, currentUserId, onClose, onPick, preview,
}: {
  conversations: Conversation[];
  currentUserId: string | null;
  onClose: () => void;
  onPick: (c: Conversation) => void;
  preview: string;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = conversations.filter((c) => (c.peer?.name ?? c.supplier?.name ?? "").toLowerCase().includes(q.toLowerCase()));
  const send = async () => {
    for (const id of picked) {
      const c = conversations.find((x) => x.id === id);
      if (c) await onPick(c);
    }
    onClose();
  };
  return (
    <div className="absolute inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end animate-fade-in" onClick={onClose}>
      <div className="w-full max-h-[80vh] bg-background rounded-t-3xl shadow-elevated flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-muted" />
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={onClose} className="text-sm font-semibold text-muted-foreground">Cancel</button>
          <p className="font-bold text-sm">Forward to…</p>
          <button onClick={send} disabled={picked.size === 0} className="text-sm font-bold text-primary disabled:opacity-40">Send</button>
        </div>
        <div className="px-3 pb-2">
          <div className="px-3 py-2 rounded-xl bg-muted/60 text-xs text-muted-foreground line-clamp-2">{preview || "Attachment"}</div>
        </div>
        <div className="px-3">
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="w-full h-9 pl-9 pr-3 rounded-full bg-muted text-sm outline-none" />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-6 safe-bottom">
          {list.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">No chats</p>
          ) : list.map((c) => {
            const on = picked.has(c.id);
            return (
              <li key={c.id}>
                <button
                  onClick={() => setPicked((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted/60 transition text-left"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                    {c.peer?.logo ? <img src={c.peer.logo} alt="" className="w-full h-full object-cover" /> : (c.peer?.name ?? "S")[0]}
                  </div>
                  <p className="flex-1 font-semibold text-sm truncate">{c.peer?.name ?? c.supplier?.name ?? "Conversation"}</p>
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {on && <Check className="w-3.5 h-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
