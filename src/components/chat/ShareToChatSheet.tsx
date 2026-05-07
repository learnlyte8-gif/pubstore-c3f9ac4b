import { useEffect, useMemo, useState } from "react";
import { Search, Send, X, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AttachmentCard, { type ChatAttachment } from "./AttachmentCard";

type ConvRow = {
  id: string;
  buyer_id: string;
  supplier_id: string;
  supplier?: { id: string; name: string; logo: string | null; verified: boolean | null; owner_id: string };
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
  const [conversations, setConversations] = useState<ConvRow[]>([]);
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

      const { data: buyerConvs } = await supabase
        .from("conversations")
        .select("*")
        .eq("buyer_id", user.id)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const { data: mySup } = await supabase.from("suppliers").select("id").eq("owner_id", user.id);
      let supConvs: ConvRow[] = [];
      if (mySup?.length) {
        const ids = mySup.map((s) => s.id);
        const { data } = await supabase.from("conversations").select("*").in("supplier_id", ids);
        supConvs = (data ?? []) as ConvRow[];
      }
      const merged = [...((buyerConvs ?? []) as ConvRow[]), ...supConvs];
      const supplierIds = Array.from(new Set(merged.map((c) => c.supplier_id)));
      if (supplierIds.length) {
        const { data: sups } = await supabase
          .from("suppliers")
          .select("id,name,logo,verified,owner_id")
          .in("id", supplierIds);
        const map = new Map((sups ?? []).map((s) => [s.id, s as ConvRow["supplier"]]));
        merged.forEach((c) => { c.supplier = map.get(c.supplier_id); });
      }
      if (alive) {
        setConversations(merged);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, defaultNote]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.supplier?.name ?? "").toLowerCase().includes(q));
  }, [conversations, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!attachment || !userId || selected.size === 0) return;
    setSending(true);
    try {
      const ids = Array.from(selected);
      for (const convId of ids) {
        const previewLabel =
          attachment.kind === "product" ? `📦 ${attachment.title}`
          : attachment.kind === "supplier" ? `🏬 ${attachment.name}`
          : attachment.kind === "wishlist" ? `❤️ Wishlist · ${attachment.count} items`
          : `🗂 Catalog · ${attachment.count} items`;

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
      }
      toast.success(`Sent to ${ids.length} chat${ids.length === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not send");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

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
              placeholder="Search chats"
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
              <p className="text-sm font-semibold">No chats yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start a chat with a supplier first.</p>
            </div>
          ) : (
            <ul>
              {filtered.map((c) => {
                const isSel = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition active:scale-[0.99] ${
                        isSel ? "bg-primary/10" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-muted shrink-0">
                        {c.supplier?.logo ? (
                          <img src={c.supplier.logo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                            {(c.supplier?.name ?? "S")[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate flex items-center gap-1">
                          {c.supplier?.name ?? "Supplier"}
                          {c.supplier?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </p>
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
