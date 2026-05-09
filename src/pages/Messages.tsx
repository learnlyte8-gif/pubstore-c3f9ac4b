import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, Send, ShieldCheck, ArrowLeft, MessageCircle, Smile, Paperclip, Sparkles, Image as ImageIcon, Heart, Phone, Video, Info, Mic, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveMasterSupplierId, fetchProducts, type Product } from "@/data/products";
import SupplierStories from "@/components/marketplace/SupplierStories";
import { useUnreadChats, markConversationRead } from "@/hooks/useUnreadChats";
import AttachmentCard, { type ChatAttachment } from "@/components/chat/AttachmentCard";

const chunk = <T,>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
};

type Conversation = {
  id: string;
  buyer_id: string;
  supplier_id: string;
  last_message: string | null;
  last_message_at: string | null;
  supplier?: { id: string; name: string; logo: string | null; verified: boolean | null; response_time: string | null; response_rate: number | null; owner_id: string };
  peer?: { name: string; logo: string | null; verified: boolean | null; subtitle: string | null; supplierId?: string };
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachment?: ChatAttachment | null;
};

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

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const initialSupplierId = params.get("supplier");
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { perConversation } = useUnreadChats();

  const loadConversations = useCallback(async (uid: string) => {
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`buyer_id.eq.${uid}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    // Also pull supplier-side conversations (where the user owns a supplier)
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
    const merged = [...((convs ?? []) as Conversation[]), ...supConvs]
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
      .sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
    const supplierIds = Array.from(new Set(merged.map((c) => c.supplier_id)));
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
      merged.forEach((c) => { c.supplier = map.get(c.supplier_id); });
    }
    // Resolve peer (the "other" party in each conversation) for display
    const buyerIdsToFetch = Array.from(
      new Set(
        merged
          .filter((c) => c.supplier?.owner_id === uid && c.buyer_id !== uid)
          .map((c) => c.buyer_id),
      ),
    );
    let profileMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (buyerIdsToFetch.length) {
      const profBatches = await Promise.all(
        chunk(buyerIdsToFetch, 50).map(async (group) => {
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

  // Auth + initial load
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

  // Auto-open or create conversation when ?supplier=ID is provided
  useEffect(() => {
    if (!userId || !initialSupplierId) return;
    (async () => {
      // Mirror stores share their master's owner — route conversation to master.
      const targetSupplierId = await resolveMasterSupplierId(initialSupplierId);
      const existing = conversations.find((c) => c.supplier_id === targetSupplierId && c.buyer_id === userId);
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: userId, supplier_id: targetSupplierId })
        .select("*")
        .single();
      if (error || !data) return;
      await loadConversations(userId);
      setActiveId(data.id);
      setParams({}, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, initialSupplierId, conversations.length]);

  // Load messages + subscribe to realtime when a conversation is opened
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (alive) setMessages((data ?? []) as Message[]);
      markConversationRead(activeId);
    })();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          );
          // Auto-mark read while viewing the conversation
          markConversationRead(activeId, (payload.new as Message).created_at);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  // Realtime: refresh conversation list on new conversations or messages.
  // Also refresh on tab focus / visibility so chats started from another
  // account/device show up immediately even if a realtime event was missed.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`conv-list:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadConversations(userId),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => loadConversations(userId),
      )
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

  // Native auto-scroll: only stick to bottom if user is already near bottom.
  // Use 'auto' (instant) so incoming messages never trigger a smooth-scroll "shake".
  const stickRef = useRef(true);
  const onThreadScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distance < 80;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!draft.trim() || !activeId || !userId) return;
    const body = draft.trim();
    setDraft("");
    // Optimistic insert so the bubble appears instantly with no layout shift
    const tempId = `temp:${Date.now()}`;
    const nowIso = new Date().toISOString();
    stickRef.current = true;
    setMessages((prev) => [
      ...prev,
      { id: tempId, conversation_id: activeId, sender_id: userId, body, created_at: nowIso },
    ]);
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: userId, body })
      .select("*")
      .single();
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? (inserted as Message) : m)).filter(
        // de-dupe in case realtime already delivered
        (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
      ),
    );
    await supabase
      .from("conversations")
      .update({ last_message: body, last_message_at: new Date().toISOString() })
      .eq("id", activeId);

    // Notify the other party
    const conv = conversations.find((c) => c.id === activeId);
    const otherId = conv?.buyer_id === userId ? conv?.supplier?.owner_id : conv?.buyer_id;
    if (otherId && otherId !== userId) {
      await supabase.from("notifications").insert({
        user_id: otherId,
        type: "message",
        title: "New message",
        body: body.length > 80 ? body.slice(0, 80) + "…" : body,
        link: "/messages",
      });
    }
  };

  const sendAttachment = async (attachment: ChatAttachment) => {
    if (!activeId || !userId) return;
    const previewLabel =
      attachment.kind === "product" ? `📦 ${attachment.title}`
      : attachment.kind === "supplier" ? `🏬 ${attachment.name}`
      : attachment.kind === "wishlist" ? `❤️ Wishlist · ${attachment.count} items`
      : `🗂 Catalog · ${attachment.count} items`;
    const tempId = `temp:${Date.now()}`;
    stickRef.current = true;
    setMessages((prev) => [
      ...prev,
      { id: tempId, conversation_id: activeId, sender_id: userId, body: previewLabel, created_at: new Date().toISOString(), attachment },
    ]);
    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: userId, body: previewLabel, attachment: attachment as any })
      .select("*").single();
    if (inserted) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? (inserted as Message) : m)));
    }
    await supabase.from("conversations")
      .update({ last_message: previewLabel, last_message_at: new Date().toISOString() })
      .eq("id", activeId);
  };

  // Double-tap a bubble to send ❤️ — Instagram style
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  const sendHeartReply = async () => {
    if (!activeId || !userId) return;
    const tempId = `temp:${Date.now()}`;
    stickRef.current = true;
    setMessages((prev) => [...prev, { id: tempId, conversation_id: activeId, sender_id: userId, body: "❤️", created_at: new Date().toISOString() }]);
    const { data: inserted } = await supabase.from("messages")
      .insert({ conversation_id: activeId, sender_id: userId, body: "❤️" })
      .select("*").single();
    if (inserted) setMessages((prev) => prev.map((m) => (m.id === tempId ? (inserted as Message) : m)));
    await supabase.from("conversations").update({ last_message: "❤️", last_message_at: new Date().toISOString() }).eq("id", activeId);
  };
  const onBubbleTap = (mid: string) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === mid && now - last.t < 350) {
      lastTapRef.current = null;
      sendHeartReply();
    } else {
      lastTapRef.current = { id: mid, t: now };
    }
  };

  // Product picker for in-chat sharing
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

  const filtered = useMemo(
    () => conversations.filter((c) => (c.peer?.name ?? c.supplier?.name ?? "").toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  const active = conversations.find((c) => c.id === activeId);

  if (active) {
    const supplierOwnerId = active.supplier?.owner_id;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-fade-in">
        {/* Header */}
        <div className="px-2 py-2 border-b border-border/60 glass-strong shadow-soft flex items-center gap-2 z-10 safe-top">
          <button
            onClick={() => setActiveId(null)}
            aria-label="Back"
            className="p-2 rounded-full hover:bg-muted active:scale-95 transition"
          >
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

        {/* Thread */}
        <div
          ref={scrollRef}
          onScroll={onThreadScroll}
          className="chat-scroll flex-1 overflow-y-auto px-4 py-4 space-y-1.5"
        >
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
                Start the conversation. Suppliers usually respond within minutes.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Is this in stock?", "What's the MOQ?", "Can you ship to my country?"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft(s)}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-accent border border-border/60 transition"
                  >
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
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex items-center justify-center my-4">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                        {fmtDayLabel(m.created_at)}
                      </span>
                    </div>
                  )}
                  <div onClick={() => onBubbleTap(m.id)} className={`flex ${mine ? "justify-end" : "justify-start"} ${sameAsPrev ? "mt-0.5" : "mt-2"} cursor-pointer select-none`}>
                    {att ? (
                      <div className={`max-w-[80%] flex flex-col ${mine ? "items-end" : "items-start"} gap-1 ${isLast ? "animate-bubble-pop" : ""}`}>
                        {hasBody && (
                          <div
                            className={`relative px-3.5 py-2 text-sm rounded-2xl ${
                              mine
                                ? "bubble-mine rounded-br-md"
                                : "bg-card text-foreground border border-border/50 shadow-soft rounded-bl-md"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                          </div>
                        )}
                        <AttachmentCard attachment={att} mine={mine} />
                        <p className={`text-[10px] ${mine ? "text-muted-foreground" : "text-muted-foreground"} px-1`}>
                          {fmtTime(m.created_at)}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`relative max-w-[78%] px-3.5 py-2 text-sm ${isLast ? "animate-bubble-pop" : ""} ${
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
                        <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/75" : "text-muted-foreground"} text-right`}>
                          {fmtTime(m.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

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
            <button
              onClick={send}
              aria-label="Send"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-ig-gradient text-white shadow-pop active:scale-90 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

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
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search products"
                  className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
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
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Sticky glass header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60 glass-strong sticky top-14 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-gradient-ig">Messages</span>
          </h1>
          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {filtered.length} {filtered.length === 1 ? "chat" : "chats"}
          </span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Supplier stories — moved here from Home */}
      <div className="border-b border-border/60">
        <SupplierStories />
      </div>

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
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:scale-[0.99] transition text-left ${
                  unread > 0 ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/60"
                }`}
              >
                <div className="relative shrink-0">
                  <div className="ring-gradient rounded-full p-[2px]" style={{ width: 52, height: 52 }}>
                    {c.supplier?.logo ? (
                      <img src={c.supplier.logo} alt="" className="w-full h-full rounded-full object-cover bg-card" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                        {(c.supplier?.name ?? "S")[0]}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate flex items-center gap-1 ${unread > 0 ? "font-extrabold" : "font-bold"}`}>
                      {c.supplier?.name ?? "Supplier"}
                      {c.supplier?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 fill-primary/20" />}
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
          );})}
        </ul>
      )}
    </div>
  );
}
