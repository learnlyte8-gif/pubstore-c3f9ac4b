import { useEffect, useState, useCallback } from "react";
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
 */
export function useUnreadChats() {
  const [userId, setUserId] = useState<string | null>(null);
  const [perConversation, setPerConversation] = useState<Record<string, number>>({});
  const [chatsWithUnread, setChatsWithUnread] = useState(0);

  const recompute = useCallback(async (uid: string) => {
    // Get all conversations the user participates in (buyer or supplier owner)
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
    if (all.length === 0) {
      setPerConversation({});
      setChatsWithUnread(0);
      return;
    }

    const lastRead = readMap();
    // Fetch unread message counts in parallel
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

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setUserId(null);
        setPerConversation({});
        setChatsWithUnread(0);
        return;
      }
      setUserId(user.id);
      recompute(user.id);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      const uid = s?.user?.id ?? null;
      setUserId(uid);
      if (uid) recompute(uid);
      else { setPerConversation({}); setChatsWithUnread(0); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [recompute]);

  // Realtime: refresh on new messages or local read updates
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`unread-chats:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => recompute(userId))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => recompute(userId))
      .subscribe();
    const onRead = () => recompute(userId);
    window.addEventListener("pubstore:chat-read", onRead);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("pubstore:chat-read", onRead);
    };
  }, [userId, recompute]);

  return { perConversation, chatsWithUnread };
}
