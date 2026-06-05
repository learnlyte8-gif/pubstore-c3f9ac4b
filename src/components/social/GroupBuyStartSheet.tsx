import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Users, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId } from "@/hooks/useSocial";
import { createGroupBuy } from "@/hooks/useGroupBuy";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  supplierId: string;
}

type Friend = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };

export default function GroupBuyStartSheet({ open, onClose, productId, productTitle, supplierId }: Props) {
  const me = useAuthUserId();
  const navigate = useNavigate();
  const [title, setTitle] = useState(`Group buy: ${productTitle}`);
  const [targetQty, setTargetQty] = useState(10);
  const [deadline, setDeadline] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !me) return;
    (async () => {
      // Users you follow are your invite pool
      const { data: follows } = await supabase
        .from("user_follows")
        .select("followee_id")
        .eq("follower_id", me);
      const ids = (follows ?? []).map((f: any) => f.followee_id);
      if (!ids.length) { setFriends([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      setFriends((profs ?? []) as Friend[]);
    })();
  }, [open, me]);

  if (!open) return null;

  const list = friends.filter((f) =>
    (f.display_name || f.username || "").toLowerCase().includes(q.toLowerCase()),
  );

  const submit = async () => {
    if (!me) { navigate("/auth"); return; }
    if (!title.trim() || targetQty < 1) return;
    setBusy(true);
    try {
      const gb = await createGroupBuy({
        productId, supplierId, title: title.trim(), targetQty,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        inviteeIds: Array.from(picked),
      });
      toast.success("Group buy created");
      onClose();
      navigate(`/group-buy/${gb.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create group buy");
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div className="w-full max-h-[90vh] bg-background rounded-t-3xl shadow-elevated flex flex-col safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-muted" />
        <header className="px-4 py-2 flex items-center justify-between">
          <p className="font-extrabold flex items-center gap-1.5"><Users className="w-5 h-5" /> Start group buy</p>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
        </header>
        <div className="px-4 py-2 overflow-y-auto flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-10 mt-1 px-3 rounded-xl bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Target units</label>
              <input type="number" min={1} value={targetQty} onChange={(e) => setTargetQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-10 mt-1 px-3 rounded-xl bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deadline</label>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-10 mt-1 px-3 rounded-xl bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Invite (from your follows)</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {friends.length === 0 ? "Follow people first to invite them here." : "No matches"}
              </p>
            ) : (
              <ul className="mt-2 max-h-56 overflow-y-auto">
                {list.map((f) => {
                  const on = picked.has(f.user_id);
                  const name = f.display_name || f.username || "User";
                  return (
                    <li key={f.user_id}>
                      <button
                        onClick={() => setPicked((s) => { const n = new Set(s); n.has(f.user_id) ? n.delete(f.user_id) : n.add(f.user_id); return n; })}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/60"
                      >
                        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-bold">
                          {f.avatar_url ? <img src={f.avatar_url} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
                        </div>
                        <p className="flex-1 text-sm font-semibold text-left truncate">{name}</p>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                          {on && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border/60">
          <button onClick={submit} disabled={busy} className="w-full h-11 rounded-full bg-foreground text-background text-sm font-bold disabled:opacity-50">
            {busy ? "Creating…" : `Create group buy${picked.size ? ` · invite ${picked.size}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
