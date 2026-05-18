import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LikeTarget = "product" | "supplier" | "catalog" | "post";

/** Auth user id, kept in sync with auth state. */
export function useAuthUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUid(s?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return uid;
}

// ============================================================
// LIKES
// ============================================================
export function useLikeCount(target: LikeTarget, id: string | undefined) {
  return useQuery({
    queryKey: ["like-count", target, id],
    enabled: !!id,
    queryFn: async () => {
      const { count } = await supabase
        .from("post_likes")
        .select("id", { count: "exact", head: true })
        .eq("target_type", target)
        .eq("target_id", id!);
      return count ?? 0;
    },
  });
}

export function useMyLike(target: LikeTarget, id: string | undefined) {
  const uid = useAuthUserId();
  return useQuery({
    queryKey: ["my-like", target, id, uid],
    enabled: !!id && !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("user_id", uid!)
        .eq("target_type", target)
        .eq("target_id", id!)
        .maybeSingle();
      return !!data;
    },
  });
}

export function useToggleLike(target: LikeTarget, id: string | undefined) {
  const uid = useAuthUserId();
  const qc = useQueryClient();
  const { data: liked = false } = useMyLike(target, id);

  const toggle = useCallback(async () => {
    if (!uid) {
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!id) return;
    // optimistic
    qc.setQueryData(["my-like", target, id, uid], !liked);
    qc.setQueryData<number>(["like-count", target, id], (n) => Math.max(0, (n ?? 0) + (liked ? -1 : 1)));
    if (liked) {
      await supabase.from("post_likes").delete()
        .eq("user_id", uid).eq("target_type", target).eq("target_id", id);
    } else {
      const { error } = await supabase.from("post_likes")
        .insert({ user_id: uid, target_type: target, target_id: id });
      if (error && error.code !== "23505") {
        toast.error("Couldn't save like");
        qc.setQueryData(["my-like", target, id, uid], liked);
      }
    }
  }, [uid, id, target, liked, qc]);

  return { liked, toggle };
}

// ============================================================
// USER FOLLOWS
// ============================================================
export function useIsFollowingUser(targetUserId: string | undefined) {
  const uid = useAuthUserId();
  return useQuery({
    queryKey: ["user-follow", uid, targetUserId],
    enabled: !!uid && !!targetUserId && uid !== targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", uid!)
        .eq("followee_id", targetUserId!)
        .maybeSingle();
      return !!data;
    },
  });
}

export function useUserFollowCounts(targetUserId: string | undefined) {
  return useQuery({
    queryKey: ["user-follow-counts", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("followee_id", targetUserId!),
        supabase.from("user_follows").select("id", { count: "exact", head: true }).eq("follower_id", targetUserId!),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
  });
}

export function useToggleFollowUser(targetUserId: string | undefined) {
  const uid = useAuthUserId();
  const qc = useQueryClient();
  const { data: following = false } = useIsFollowingUser(targetUserId);

  const toggle = useCallback(async () => {
    if (!uid) {
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!targetUserId || uid === targetUserId) return;
    qc.setQueryData(["user-follow", uid, targetUserId], !following);
    qc.setQueryData<{ followers: number; following: number }>(
      ["user-follow-counts", targetUserId],
      (c) => c ? { ...c, followers: Math.max(0, c.followers + (following ? -1 : 1)) } : c,
    );
    if (following) {
      await supabase.from("user_follows").delete()
        .eq("follower_id", uid).eq("followee_id", targetUserId);
    } else {
      const { error } = await supabase.from("user_follows")
        .insert({ follower_id: uid, followee_id: targetUserId });
      if (error && error.code !== "23505") {
        toast.error("Couldn't follow");
        qc.setQueryData(["user-follow", uid, targetUserId], following);
      }
    }
  }, [uid, targetUserId, following, qc]);

  return { following, toggle };
}

// ============================================================
// SHARES (logging only; the UI sheet handles delivery)
// ============================================================
export async function logShare(input: {
  target: LikeTarget;
  id: string;
  channel: "chat" | "external" | "copy";
  conversationId?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("shares").insert({
    user_id: user.id,
    target_type: input.target,
    target_id: input.id,
    channel: input.channel,
    conversation_id: input.conversationId ?? null,
  });
}

// ============================================================
// PERSONALIZED FEED
// ============================================================
export function usePersonalizedFeed(limit = 60) {
  const uid = useAuthUserId();
  return useQuery({
    queryKey: ["personalized-feed", uid, limit],
    queryFn: async () => {
      if (!uid) {
        const { data } = await supabase.from("products").select("*")
          .eq("active", true).order("created_at", { ascending: false }).limit(limit);
        return (data ?? []) as any[];
      }
      const { data: ranked } = await supabase.rpc("personalized_feed", { _user_id: uid, _limit: limit });
      const ids = (ranked ?? []).map((r: any) => r.product_id);
      if (!ids.length) return [];
      const { data: prods } = await supabase.from("products").select("*").in("id", ids);
      const map = new Map((prods ?? []).map((p: any) => [p.id, p]));
      return ids.map((id) => map.get(id)).filter(Boolean);
    },
  });
}
