import { useEffect, useMemo, useState } from "react";
import { Search, Send, X, MessageCircle, ShieldCheck, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AttachmentCard, { type ChatAttachment } from "./AttachmentCard";
import { logShare } from "@/hooks/useSocial";

type Recipient = {
  // Stable key — for existing convs we use the conversation id; for new DM
  // targets we use `user:<userId>` and resolve/create on send.
  key: string;
  kind: "supplier" | "dm" | "group" | "followed_user";
  conversationId?: string;
  peerUserId?: string;
  name: string;
  logo: string | null;
  verified?: boolean;
  subtitle?: string;
};

export default function ShareToChatSheet({
  open,
  onClose,
  attachment,
  defaultNote = "",
}: {
  open: boolean;
  onClose: () => void;
  attachment: ChatAttachment | null;
  defaultNote?: string;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [note, setNote] = useState(defaultNote);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setNote(defaultNote);
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      // 1) Conversations I'm part of as buyer or owner
      const { data: buyerConvs } = await supabase
        .from("conversations")
        .select("*")
        .eq("buyer_id", user.id)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const { data: mySup } = await supabase.from("suppliers").select("id").eq("owner_id", user.id);
      let supConvs: any[] = [];
      if (mySup?.length) {
        const { data } = await supabase.from("conversations").select("*").in("supplier_id", mySup.map((s) => s.id));
        supConvs = data ?? [];
      }
      // 2) Group / DM conversations via membership
      const { data: memberRows } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);
      let memberConvs: any[] = [];
      const memberIds = (memberRows ?? []).map((r: any) => r.conversation_id);
      if (memberIds.length) {
        const { data } = await supabase.from("conversations").select("*").in("id", memberIds);
        memberConvs = data ?? [];
      }
      const mergedConvs = [...(buyerConvs ?? []), ...supConvs, ...memberConvs]
        .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

      // Hydrate supplier info for buyer_supplier conversations
      const supplierIds = Array.from(new Set(mergedConvs.map((c) => c.supplier_id).filter(Boolean)));
      const supMap = new Map<string, any>();
      if (supplierIds.length) {
        const { data: sups } = await supabase
          .from("suppliers")
          .select("id,name,logo,verified,owner_id")
          .in("id", supplierIds);
        (sups ?? []).forEach((s) => supMap.set(s.id, s));
      }

      // Hydrate DM peer profiles
      const peerIds = new Set<string>();
      mergedConvs.forEach((c) => {
        if ((c.kind ?? "buyer_supplier") === "dm") {
          const peer = c.peer_user_id ?? (c.buyer_id === user.id ? null : c.buyer_id);
          if (peer && peer !== user.id) peerIds.add(peer);
        }
      });

      // 3) Followed users — let users share to people they follow even without an existing DM
      const { data: follows } = await supabase
        .from("user_follows")
        .select("followee_id")
        .eq("follower_id", user.id);
      const followIds = (follows ?? []).map((f: any) => f.followee_id);
      followIds.forEach((id) => peerIds.add(id));

      const profMap = new Map<string, any>();
      if (peerIds.size) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", Array.from(peerIds));
        (profs ?? []).forEach((p) => profMap.set(p.user_id, p));
      }

      // Build recipient list
      const list: Recipient[] = [];
      const dmPeers = new Set<string>(); // peer ids that already have a DM

      mergedConvs.forEach((c) => {
        const kind = c.kind ?? "buyer_supplier";
        if (kind === "group_buy") {
          list.push({
            key: c.id, kind: "group", conversationId: c.id,
            name: c.title ?? "Group buy", logo: null, subtitle: "Group chat",
          });
        } else if (kind === "dm") {
          const peer = c.peer_user_id ?? (c.buyer_id === user.id ? null : c.buyer_id);
          if (peer) dmPeers.add(peer);
          const p = peer ? profMap.get(peer) : null;
          list.push({
            key: c.id, kind: "dm", conversationId: c.id, peerUserId: peer ?? undefined,
            name: p?.display_name || p?.username || "Direct message",
            logo: p?.avatar_url ?? null,
            subtitle: p?.username ? `@${p.username}` : "Direct message",
          });
        } else {
          const s = c.supplier_id ? supMap.get(c.supplier_id) : null;
          if (!s) return;
          list.push({
            key: c.id, kind: "supplier", conversationId: c.id,
            name: s.name, logo: s.logo, verified: !!s.verified, subtitle: "Supplier",
          });
        }
      });

      // Followed users without an existing DM → offer "Send to user"
      followIds.forEach((id: string) => {
        if (dmPeers.has(id)) return;
        const p = profMap.get(id);
        if (!p) return;
        list.push({
          key: `user:${id}`, kind: "followed_user", peerUserId: id,
          name: p.display_name || p.username || "Someone you follow",
          logo: p.avatar_url ?? null,
          subtitle: p.username ? `@${p.username} · Following` : "Following",
        });
      });

      if (alive) {
        setRecipients(list);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, defaultNote]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => r.name.toLowerCase().includes(q) || (r.subtitle ?? "").toLowerCase().includes(q));
  }, [recipients, search]);

  const grouped = useMemo(() => ({
    suppliers: filtered.filter((r) => r.kind === "supplier"),
    groups: filtered.filter((r) => r.kind === "group"),
    dms: filtered.filter((r) => r.kind === "dm"),
    followed: filtered.filter((r) => r.kind === "followed_user"),
  }), [filtered]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Resolve a recipient to a conversation_id, creating a DM if necessary. */
  const resolveConversationId = async (r: Recipient): Promise<string | null> => {
    if (r.conversationId) return r.conversationId;
    if (r.kind === "followed_user" && r.peerUserId && userId) {
      // Look for an existing DM either direction
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("kind", "dm")
        .or(`and(buyer_id.eq.${userId},peer_user_id.eq.${r.peerUserId}),and(buyer_id.eq.${r.peerUserId},peer_user_id.eq.${userId})`)
        .limit(1)
        .maybeSingle();
      if (existing?.id) return existing.id;
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: userId, peer_user_id: r.peerUserId, kind: "dm" })
        .select("id").single();
      if (error || !created) return null;
      // Add both as members
      await supabase.from("conversation_members").insert([
        { conversation_id: created.id, user_id: userId },
        { conversation_id: created.id, user_id: r.peerUserId },
      ]);
      return created.id;
    }
    return null;
  };

  const send = async () => {
    if (!attachment || !userId || selected.size === 0) return;
    setSending(true);
    try {
      const keys = Array.from(selected);
      const targetConvIds: string[] = [];
      for (const key of keys) {
        const r = recipients.find((x) => x.key === key);
        if (!r) continue;
        const convId = await resolveConversationId(r);
        if (convId) targetConvIds.push(convId);
      }

      const previewLabel =
        attachment.kind === "product" ? `📦 ${attachment.title}`
        : attachment.kind === "supplier" ? `🏬 ${attachment.name}`
        : attachment.kind === "wishlist" ? `❤️ Wishlist · ${attachment.count} items`
        : attachment.kind === "cart-unlock" ? `✅ Cart unlocked · ${attachment.title}`
        : `🗂 Catalog · ${attachment.count} items`;

      for (const convId of targetConvIds) {
        if (note.trim()) {
          await supabase.from("messages").insert({
            conversation_id: convId, sender_id: userId, body: note.trim(),
          });
        }
        await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id: userId,
          body: previewLabel,
          attachment,
        });
        await supabase.from("conversations")
          .update({ last_message: previewLabel, last_message_at: new Date().toISOString() })
          .eq("id", convId);

        // Log share for ranking
        const sharedKind = attachment.kind;
        if (sharedKind === "product") await logShare({ target: "product", id: attachment.id, channel: "chat", conversationId: convId });
        else if (sharedKind === "supplier") await logShare({ target: "supplier", id: attachment.id, channel: "chat", conversationId: convId });
        else if (sharedKind === "catalog") await logShare({ target: "catalog", id: attachment.id, channel: "chat", conversationId: convId });
      }

      toast.success(`Sent to ${targetConvIds.length} chat${targetConvIds.length === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not send");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const Section = ({ title, icon, items }: { title: string; icon: React.ReactNode; items: Recipient[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-2">
        <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {icon}<span>{title}</span>
        </div>
        <ul>
          {items.map((r) => {
            const isSel = selected.has(r.key);
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => toggle(r.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition active:scale-[0.99] ${
                    isSel ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {r.logo ? (
                      <img src={r.logo} alt="" className="w-full h-full object-cover" />
                    ) : r.kind === "group" ? (
                      <Users className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <span className="text-sm font-bold">{r.name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate flex items-center gap-1">
                      {r.name}
                      {r.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </p>
                    {r.subtitle && <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>}
                  </div>
                  <span
                    aria-hidden
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                      isSel ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSel && <span className="w-2 h-2 rounded-full bg-primary-foreground" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card border-t sm:border sm:rounded-3xl rounded-t-3xl shadow-elevated max-h-[85dvh] flex flex-col animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/60">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Share</p>
            <p className="font-bold text-base">Send to…</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {attachment && (
          <div className="px-4 py-3 border-b border-border/60 flex justify-center bg-muted/30">
            <AttachmentCard attachment={attachment} mine={false} />
          </div>
        )}

        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, groups, suppliers"
              className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 min-h-[120px]">
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-6">
              <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-semibold">Nothing to share with yet</p>
              <p className="text-xs text-muted-foreground mt-1">Follow people or start a supplier chat first.</p>
            </div>
          ) : (
            <>
              <Section title="Groups" icon={<Users className="w-3 h-3" />} items={grouped.groups} />
              <Section title="Direct messages" icon={<MessageCircle className="w-3 h-3" />} items={grouped.dms} />
              <Section title="Following" icon={<UserPlus className="w-3 h-3" />} items={grouped.followed} />
              <Section title="Suppliers" icon={<ShieldCheck className="w-3 h-3" />} items={grouped.suppliers} />
            </>
          )}
        </div>

        <div className="px-3 pt-2 pb-3 border-t border-border/60 safe-bottom space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write a message…"
            className="w-full h-10 px-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={send}
            disabled={selected.size === 0 || sending}
            className="w-full h-11 rounded-full bg-ig-gradient text-white font-bold text-sm flex items-center justify-center gap-2 shadow-pop disabled:opacity-50 active:scale-[0.98] transition"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : `Send${selected.size ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
