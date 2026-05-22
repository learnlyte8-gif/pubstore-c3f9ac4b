import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const chunk = <T,>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
};

const STORAGE_KEY = "pubstore:chat-last-read";

type LastReadMap = Record<string, string>;

function readMap(): LastReadMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeMap(map: LastReadMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event("pubstore:chat-read"));
  } catch {
    /* noop */
  }
}

export function markConversationRead(conversationId: string, atIso?: string) {
  const map = readMap();
  map[conversationId] = atIso ?? new Date().toISOString();
  writeMap(map);
}

export type ConversationUnread = {
  conversation_id: string;
  last_message_at: string | null;
  unread_count: number;
};

/**
 * Tracks unread message counts per conversation for the current user.
 * "Unread" = messages from someone else, newer than the locally-stored
 * last-read timestamp for that conversation.
 *
 * Performance: avoids the auth-token lock (uses getSession), debounces
 * realtime recomputes, and applies incremental updates from new-message
 * payloads instead of refetching every conversation's count.
 */
export function useUnreadChats() {
  const [userId, setUserId] = useState<string | null>(null);
  const [perConversation, setPerConversation] = useState<Record<string, number>>({});
  const [chatsWithUnread, setChatsWithUnread] = useState(0);
  const convIdsRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<number | null>(null);

  const recompute = useCallback(async (uid: string) => {
    const { data: buyerConvs } = await supabase
      .from("conversations")
      .select("id, last_message_at")
      .eq("buyer_id", uid);

    const { data: mySup } = await supabase.from("suppliers").select("id").eq("owner_id", uid);
    let supConvs: { id: string; last_message_at: string | null }[] = [];
    if (mySup?.length) {
      const ids = mySup.map((s) => s.id);
      const batches = await Promise.all(
        chunk(ids, 50).map(async (group) => {
          const { data } = await supabase
            .from("conversations")
            .select("id, last_message_at")
            .in("supplier_id", group);
          return data ?? [];
        }),
      );
      supConvs = batches.flat();
    }
    const all = [...(buyerConvs ?? []), ...supConvs].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    convIdsRef.current = new Set(all.map((c) => c.id));
    if (all.length === 0) {
      setPerConversation({});
      setChatsWithUnread(0);
      return;
    }

    const lastRead = readMap();
    const counts = await Promise.all(
      all.map(async (c) => {
        const since = lastRead[c.id] ?? "1970-01-01T00:00:00Z";
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .neq("sender_id", uid)
          .gt("created_at", since);
        return [c.id, count ?? 0] as const;
      }),
    );
    const map: Record<string, number> = {};
    let chats = 0;
    counts.forEach(([id, n]) => {
      map[id] = n;
      if (n > 0) chats += 1;
    });
    setPerConversation(map);
    setChatsWithUnread(chats);
  }, []);

  const scheduleRecompute = useCallback((uid: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void recompute(uid);
    }, 800);
  }, [recompute]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // getSession reads from local storage — no auth-token lock contention
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      const uid = session?.user?.id ?? null;
      if (!uid) {
        setUserId(null);
        setPerConversation({});
        setChatsWithUnread(0);
        return;
      }
      setUserId(uid);
      void recompute(uid);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      const uid = s?.user?.id ?? null;
      setUserId(uid);
      if (uid) void recompute(uid);
      else { setPerConversation({}); setChatsWithUnread(0); }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [recompute]);

  // Realtime: incremental update on new messages; debounced full recompute
  // on conversation list changes.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`unread-chats:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m: any = payload.new;
        if (!m || m.sender_id === userId) return;
        // If we know this conversation, just bump its counter. Otherwise
        // schedule a (debounced) full recompute to discover it.
        if (convIdsRef.current.has(m.conversation_id)) {
          setPerConversation((prev) => {
            const next = { ...prev, [m.conversation_id]: (prev[m.conversation_id] ?? 0) + 1 };
            const chats = Object.values(next).filter((n) => (n as number) > 0).length;
            setChatsWithUnread(chats);
            return next;
          });
        } else {
          scheduleRecompute(userId);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => scheduleRecompute(userId))
      .subscribe();
    const onRead = () => scheduleRecompute(userId);
    window.addEventListener("pubstore:chat-read", onRead);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("pubstore:chat-read", onRead);
    };
  }, [userId, scheduleRecompute]);

  return { perConversation, chatsWithUnread };
}
