import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const chunk = <T,>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
};

const STORAGE_KEY = "pubstore:chat-last-read";
const STOP_DELAY_MS = 250;

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

type ConversationRef = { id: string; last_message_at: string | null };

type UnreadState = {
  perConversation: Record<string, number>;
  chatsWithUnread: number;
};

const EMPTY_STATE: UnreadState = {
  perConversation: {},
  chatsWithUnread: 0,
};

let state: UnreadState = EMPTY_STATE;
const listeners = new Set<(next: UnreadState) => void>();
const convIds = new Set<string>();

let currentUserId: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;
let recomputeTimer: number | null = null;
let stopTimer: number | null = null;
let subscriberCount = 0;
let started = false;
let readListenerAttached = false;

const emit = () => {
  listeners.forEach((listener) => listener(state));
};

const setState = (next: UnreadState) => {
  state = next;
  emit();
};

const clearRecomputeTimer = () => {
  if (recomputeTimer) {
    window.clearTimeout(recomputeTimer);
    recomputeTimer = null;
  }
};

const resetState = () => {
  convIds.clear();
  setState(EMPTY_STATE);
};

const loadTrackedConversations = async (uid: string): Promise<ConversationRef[]> => {
  const [{ data: buyerConvs }, { data: mySup }, { data: memberRows }] = await Promise.all([
    supabase.from("conversations").select("id, last_message_at").eq("buyer_id", uid),
    supabase.from("suppliers").select("id").eq("owner_id", uid),
    supabase.from("conversation_members").select("conversation_id").eq("user_id", uid),
  ]);

  let supConvs: ConversationRef[] = [];
  if (mySup?.length) {
    const supplierIds = mySup.map((supplier) => supplier.id);
    const batches = await Promise.all(
      chunk(supplierIds, 50).map(async (group) => {
        const { data } = await supabase
          .from("conversations")
          .select("id, last_message_at")
          .in("supplier_id", group);
        return (data ?? []) as ConversationRef[];
      }),
    );
    supConvs = batches.flat();
  }

  const memberIds = (memberRows ?? []).map((row) => row.conversation_id);
  let memberConvs: ConversationRef[] = [];
  if (memberIds.length) {
    const batches = await Promise.all(
      chunk(memberIds, 50).map(async (group) => {
        const { data } = await supabase
          .from("conversations")
          .select("id, last_message_at")
          .in("id", group);
        return (data ?? []) as ConversationRef[];
      }),
    );
    memberConvs = batches.flat();
  }

  return [...(buyerConvs ?? []), ...supConvs, ...memberConvs].filter(
    (conversation, index, all) => all.findIndex((candidate) => candidate.id === conversation.id) === index,
  );
};

const recompute = async (uid: string) => {
  const conversations = await loadTrackedConversations(uid);
  if (currentUserId !== uid) return;

  convIds.clear();
  conversations.forEach((conversation) => convIds.add(conversation.id));

  if (conversations.length === 0) {
    resetState();
    return;
  }

  const lastRead = readMap();
  const counts = await Promise.all(
    conversations.map(async (conversation) => {
      const since = lastRead[conversation.id] ?? "1970-01-01T00:00:00Z";
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", uid)
        .gt("created_at", since);
      return [conversation.id, count ?? 0] as const;
    }),
  );

  if (currentUserId !== uid) return;

  const perConversation: Record<string, number> = {};
  let chatsWithUnread = 0;

  counts.forEach(([conversationId, unreadCount]) => {
    perConversation[conversationId] = unreadCount;
    if (unreadCount > 0) chatsWithUnread += 1;
  });

  setState({ perConversation, chatsWithUnread });
};

const scheduleRecompute = (uid: string) => {
  clearRecomputeTimer();
  recomputeTimer = window.setTimeout(() => {
    void recompute(uid);
  }, 800);
};

const handleIncomingMessage = (uid: string, payload: { new: any }) => {
  const message = payload.new;
  if (!message || message.sender_id === uid) return;

  if (!convIds.has(message.conversation_id)) {
    scheduleRecompute(uid);
    return;
  }

  const nextPerConversation = {
    ...state.perConversation,
    [message.conversation_id]: (state.perConversation[message.conversation_id] ?? 0) + 1,
  };

  setState({
    perConversation: nextPerConversation,
    chatsWithUnread: Object.values(nextPerConversation).filter((count) => count > 0).length,
  });
};

const removeExistingUnreadChannels = async () => {
  const unreadChannels = supabase
    .getChannels()
    .filter((existingChannel) => existingChannel.topic.startsWith("realtime:unread-chats:"));

  if (!unreadChannels.length) return;

  await Promise.allSettled(unreadChannels.map((existingChannel) => supabase.removeChannel(existingChannel)));
};

const detachRealtime = async () => {
  clearRecomputeTimer();

  if (channel) {
    const activeChannel = channel;
    channel = null;
    await supabase.removeChannel(activeChannel);
  }

  await removeExistingUnreadChannels();

  if (readListenerAttached) {
    window.removeEventListener("pubstore:chat-read", onRead);
    readListenerAttached = false;
  }
};

async function attachRealtime(uid: string) {
  await detachRealtime();
  if (currentUserId !== uid) return;

  const nextChannel = supabase
    .channel(`unread-chats:${uid}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      handleIncomingMessage(uid, payload as { new: any });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
      scheduleRecompute(uid);
    })
    .subscribe();

  channel = nextChannel;

  if (!readListenerAttached) {
    window.addEventListener("pubstore:chat-read", onRead);
    readListenerAttached = true;
  }
}

function onRead() {
  if (currentUserId) scheduleRecompute(currentUserId);
}

const handleAuthChange = async (uid: string | null) => {
  if (uid === currentUserId) return;

  currentUserId = uid;

  if (!uid) {
    await detachRealtime();
    resetState();
    return;
  }

  resetState();
  await attachRealtime(uid);
  void recompute(uid);
};

const startStore = async () => {
  if (started) return;
  started = true;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    void handleAuthChange(session?.user?.id ?? null);
  });
  authSubscription = data.subscription;

  const { data: sessionData } = await supabase.auth.getSession();
  await handleAuthChange(sessionData.session?.user?.id ?? null);
};

const stopStore = async () => {
  started = false;

  authSubscription?.unsubscribe();
  authSubscription = null;

  currentUserId = null;
  await detachRealtime();
  resetState();
};

/**
 * Shared unread-chat store used by multiple screens without opening multiple
 * auth listeners / realtime channels for the same user.
 */
export function useUnreadChats() {
  const [snapshot, setSnapshot] = useState<UnreadState>(state);

  const onStoreChange = useCallback((next: UnreadState) => {
    setSnapshot(next);
  }, []);

  useEffect(() => {
    if (stopTimer) {
      window.clearTimeout(stopTimer);
      stopTimer = null;
    }

    subscriberCount += 1;
    listeners.add(onStoreChange);
    onStoreChange(state);
    void startStore();

    return () => {
      listeners.delete(onStoreChange);
      subscriberCount = Math.max(0, subscriberCount - 1);

      if (subscriberCount === 0) {
        stopTimer = window.setTimeout(() => {
          if (subscriberCount === 0) void stopStore();
        }, STOP_DELAY_MS);
      }
    };
  }, [onStoreChange]);

  return snapshot;
}