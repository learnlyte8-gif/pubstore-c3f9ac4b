import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Send, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Conversation = {
  id: string;
  buyer_id: string;
  supplier_id: string;
  last_message: string | null;
  last_message_at: string | null;
  supplier?: { id: string; name: string; logo: string | null; verified: boolean | null; response_time: string | null; response_rate: number | null; owner_id: string };
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
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
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .in("supplier_id", ids)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      supConvs = (data ?? []) as Conversation[];
    }
    const merged = [...((convs ?? []) as Conversation[]), ...supConvs];
    const supplierIds = Array.from(new Set(merged.map((c) => c.supplier_id)));
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id,name,logo,verified,response_time,response_rate,owner_id")
        .in("id", supplierIds);
      const map = new Map((sups ?? []).map((s) => [s.id, s as Conversation["supplier"]]));
      merged.forEach((c) => { c.supplier = map.get(c.supplier_id); });
    }
    setConversations(merged);
    setLoading(false);
  }, []);

  // Auth + initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) { setLoading(false); return; }
      setUserId(user.id);
      await loadConversations(user.id);
    })();
    return () => { alive = false; };
  }, [loadConversations]);

  // Auto-open or create conversation when ?supplier=ID is provided
  useEffect(() => {
    if (!userId || !initialSupplierId) return;
    (async () => {
      const existing = conversations.find((c) => c.supplier_id === initialSupplierId && c.buyer_id === userId);
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: userId, supplier_id: initialSupplierId })
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
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  // Realtime: refresh conversation list on new conversations or message previews
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`conv-list:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadConversations(userId),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadConversations]);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!draft.trim() || !activeId || !userId) return;
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: userId, body });
    if (error) return;
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

  const filtered = useMemo(
    () => conversations.filter((c) => (c.supplier?.name ?? "").toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  const active = conversations.find((c) => c.id === activeId);

  if (active) {
    return (
      <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)] lg:h-[calc(100dvh-3.5rem)]">
        <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft flex items-center gap-2">
          <button onClick={() => setActiveId(null)} aria-label="Back" className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {active.supplier?.logo && <img src={active.supplier.logo} alt="" className="w-9 h-9 rounded-full object-cover shadow-soft" />}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate flex items-center gap-1">
              {active.supplier?.name}
              {active.supplier?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {active.supplier?.response_time ? `Responds ${active.supplier.response_time}` : "Online"}
              {active.supplier?.response_rate ? ` · ${active.supplier.response_rate}%` : ""}
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-muted/20">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-12">Say hi — your messages are end-to-end encrypted.</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm shadow-card ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-0.5 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {fmtTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-border bg-card shadow-elevated flex items-center gap-2 safe-bottom">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Write a message..."
            className="flex-1 h-10 px-4 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
          />
          <button
            onClick={send}
            aria-label="Send"
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-pop"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 border-b border-border bg-card shadow-soft">
        <h1 className="text-xl font-bold mb-3">Messages</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-16">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 px-6">
          <p className="text-sm font-bold">No conversations yet</p>
          <p className="text-xs text-muted-foreground mt-1">Open a supplier and tap "Contact supplier" to start chatting.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition text-left"
              >
                {c.supplier?.logo && <img src={c.supplier.logo} alt="" className="w-12 h-12 rounded-full object-cover shadow-soft shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate flex items-center gap-1">
                      {c.supplier?.name ?? "Supplier"}
                      {c.supplier?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(c.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message ?? "No messages yet"}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
