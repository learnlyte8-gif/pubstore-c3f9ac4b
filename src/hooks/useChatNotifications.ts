import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Global subscriber: shows a sonner toast whenever a new message arrives in
 * any conversation the current user participates in (DM, group buy, supplier).
 * Suppressed while the user is already on the /messages route.
 */
export function useChatNotifications() {
  const location = useLocation();
  const navigate = useNavigate();
  const locRef = useRef(location.pathname);
  useEffect(() => { locRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const convIds = new Set<string>();
    const recentToasts = new Map<string, number>();

    const loadConvIds = async (uid: string) => {
      // Cap each source to the most recently active rooms — toasts only need
      // to fire for live chats, not the full historical inbox.
      const [{ data: buyerC }, { data: mySup }, { data: memberC }] = await Promise.all([
        supabase.from("conversations").select("id").eq("buyer_id", uid)
          .order("last_message_at", { ascending: false, nullsFirst: false }).limit(100),
        supabase.from("suppliers").select("id").eq("owner_id", uid).limit(20),
        supabase.from("conversation_members").select("conversation_id")
          .eq("user_id", uid).limit(100),
      ]);
      convIds.clear();
      (buyerC ?? []).forEach((r: any) => convIds.add(r.id));
      (memberC ?? []).forEach((r: any) => convIds.add(r.conversation_id));
      if (mySup?.length) {
        const supIds = mySup.map((s: any) => s.id);
        const { data: supC } = await supabase.from("conversations").select("id")
          .in("supplier_id", supIds)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100);
        (supC ?? []).forEach((r: any) => convIds.add(r.id));
      }
    };

    const handleNewMessage = async (uid: string, m: any) => {
      if (!m || m.sender_id === uid) return;
      if (!convIds.has(m.conversation_id)) {
        await loadConvIds(uid);
        if (!convIds.has(m.conversation_id)) return;
      }
      if (locRef.current.startsWith("/messages")) return;
      // de-dupe (realtime + retries)
      const now = Date.now();
      const last = recentToasts.get(m.id) ?? 0;
      if (now - last < 5000) return;
      recentToasts.set(m.id, now);

      const { data: conv } = await supabase
        .from("conversations")
        .select("kind, title, peer_user_id, buyer_id, supplier_id")
        .eq("id", m.conversation_id)
        .maybeSingle();
      let name = "New message";
      const kind = (conv?.kind ?? "buyer_supplier") as string;
      if (conv) {
        if (kind === "group_buy") {
          name = conv.title ?? "Group chat";
        } else if (kind === "dm") {
          const peerId = conv.peer_user_id ?? (conv.buyer_id === uid ? null : conv.buyer_id) ?? m.sender_id;
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("user_id", peerId)
            .maybeSingle();
          name = p?.display_name || p?.username || "Direct message";
        } else if (conv.supplier_id) {
          // Owner side: show sender profile; buyer side: show supplier
          if (conv.buyer_id === uid) {
            const { data: s } = await supabase.from("suppliers").select("name").eq("id", conv.supplier_id).maybeSingle();
            name = s?.name ?? "Supplier";
          } else {
            const { data: p } = await supabase
              .from("profiles").select("display_name, username")
              .eq("user_id", m.sender_id).maybeSingle();
            name = p?.display_name || p?.username || "Customer";
          }
        }
      }
      const body = (m.body && String(m.body).trim()) ? String(m.body) : "Sent an attachment";
      toast(name, {
        description: body.length > 120 ? body.slice(0, 120) + "…" : body,
        action: { label: "Open", onClick: () => navigate("/messages") },
      });
    };

    const subscribe = async (uid: string) => {
      await loadConvIds(uid);
      channel = supabase
        .channel(`chat-notify:${uid}:${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          void handleNewMessage(uid, payload.new);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => loadConvIds(uid))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members", filter: `user_id=eq.${uid}` }, () => loadConvIds(uid))
        .subscribe();
    };

    let currentUid: string | null = null;
    (async () => {
      // getSession reads from local storage — avoids the auth-token lock
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive || !session?.user) return;
      currentUid = session.user.id;
      await subscribe(session.user.id);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      const nextUid = s?.user?.id ?? null;
      if (nextUid === currentUid) return;
      if (channel) { supabase.removeChannel(channel); channel = null; }
      convIds.clear();
      currentUid = nextUid;
      if (nextUid) await subscribe(nextUid);
    });

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);
}
