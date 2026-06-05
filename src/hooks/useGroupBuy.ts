import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/hooks/useSocial";
import { toast } from "sonner";

export type GroupBuy = {
  id: string;
  owner_id: string;
  product_id: string;
  supplier_id: string;
  title: string;
  target_qty: number;
  deadline: string | null;
  status: "open" | "locked" | "fulfilled" | "cancelled";
  conversation_id: string | null;
  created_at: string;
};

export type GroupBuyMember = {
  group_id: string;
  user_id: string;
  qty: number;
  role: "owner" | "member" | "invited";
  joined_at: string;
};

/** All group buys the user is in (owner or member) or invited to. */
export function useMyGroupBuys() {
  const uid = useAuthUserId();
  return useQuery({
    queryKey: ["my-group-buys", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [{ data: members }, { data: owned }] = await Promise.all([
        supabase.from("group_buy_members").select("group_id").eq("user_id", uid!),
        supabase.from("group_buys").select("id").eq("owner_id", uid!),
      ]);
      const ids = Array.from(new Set([
        ...((members ?? []).map((m: any) => m.group_id)),
        ...((owned ?? []).map((o: any) => o.id)),
      ]));
      if (!ids.length) return [] as GroupBuy[];
      const { data } = await supabase.from("group_buys").select("*").in("id", ids).order("created_at", { ascending: false });
      return (data ?? []) as GroupBuy[];
    },
  });
}

export function useGroupBuy(id: string | undefined) {
  return useQuery({
    queryKey: ["group-buy", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("group_buys").select("*").eq("id", id!).maybeSingle();
      return data as GroupBuy | null;
    },
  });
}

export function useGroupBuyMembers(id: string | undefined) {
  return useQuery({
    queryKey: ["group-buy-members", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("group_buy_members").select("*").eq("group_id", id!);
      return (data ?? []) as GroupBuyMember[];
    },
  });
}

export function useGroupBuyInvites() {
  const uid = useAuthUserId();
  return useQuery({
    queryKey: ["gb-invites", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_buy_invites")
        .select("*")
        .eq("invitee_id", uid!)
        .eq("status", "pending");
      return data ?? [];
    },
  });
}

/** Pull the pending invite (if any) for the current user on a specific group. */
export function useMyInviteForGroup(groupId: string | undefined) {
  const uid = useAuthUserId();
  return useQuery({
    queryKey: ["gb-invite-mine", groupId, uid],
    enabled: !!uid && !!groupId,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_buy_invites")
        .select("*")
        .eq("group_id", groupId!)
        .eq("invitee_id", uid!)
        .maybeSingle();
      return data;
    },
  });
}

export async function respondToGroupBuyInvite(inviteId: string, accept: boolean) {
  const { error } = await supabase
    .from("group_buy_invites")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

/** Owner converts a locked group buy into a single pooled order. */
export async function placeGroupBuyOrder(groupId: string) {
  const { data, error } = await supabase.rpc("place_group_buy_order", { _group_id: groupId });
  if (error) throw error;
  return data as { id: string } | null;
}

export async function createGroupBuy(input: {
  productId: string;
  supplierId: string;
  title: string;
  targetQty: number;
  deadline?: string | null;
  inviteeIds?: string[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("auth");
  const { data, error } = await supabase
    .from("group_buys")
    .insert({
      owner_id: user.id,
      product_id: input.productId,
      supplier_id: input.supplierId,
      title: input.title,
      target_qty: input.targetQty,
      deadline: input.deadline ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("create failed");
  if (input.inviteeIds?.length) {
    await supabase.from("group_buy_invites").insert(
      input.inviteeIds.map((invitee_id) => ({
        group_id: data.id,
        inviter_id: user.id,
        invitee_id,
      })),
    );
  }
  return data as GroupBuy;
}

export function useJoinGroupBuy() {
  const qc = useQueryClient();
  return useCallback(async (groupId: string, qty: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("auth");
    const { error } = await supabase.from("group_buy_members")
      .upsert({ group_id: groupId, user_id: user.id, qty, role: "member" }, { onConflict: "group_id,user_id" });
    if (error) { toast.error("Couldn't join group buy"); throw error; }
    await qc.invalidateQueries({ queryKey: ["group-buy-members", groupId] });
    await qc.invalidateQueries({ queryKey: ["group-buy", groupId] });
  }, [qc]);
}

/** Realtime subscription for a single group buy (members & status). */
export function useGroupBuyRealtime(id: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`gb:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_buy_members", filter: `group_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["group-buy-members", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_buys", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["group-buy", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);
}
