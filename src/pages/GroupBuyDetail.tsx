import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Users, Clock, Target, Plus, Check } from "lucide-react";
import { useGroupBuy, useGroupBuyMembers, useGroupBuyRealtime, useJoinGroupBuy } from "@/hooks/useGroupBuy";
import { useAuthUserId } from "@/hooks/useSocial";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function GroupBuyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useAuthUserId();
  const { data: gb, isLoading } = useGroupBuy(id);
  const { data: members = [] } = useGroupBuyMembers(id);
  useGroupBuyRealtime(id);
  const join = useJoinGroupBuy();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <div className="px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  if (!gb) return (
    <div className="px-4 py-16 text-center">
      <p className="font-semibold">Group buy not found</p>
      <Link to="/home" className="text-primary text-sm mt-2 inline-block">Back home</Link>
    </div>
  );

  const total = members.reduce((s, m) => s + m.qty, 0);
  const pct = Math.min(100, Math.round((total / gb.target_qty) * 100));
  const mine = members.find((m) => m.user_id === me);
  const isMember = !!mine;
  const isLocked = gb.status !== "open";
  const deadlineLabel = gb.deadline ? new Date(gb.deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Open-ended";

  const handleJoin = async () => {
    if (!me) {
      navigate(`/auth?redirect=${encodeURIComponent(`/group-buy/${id}`)}`);
      return;
    }
    setBusy(true);
    try {
      await join(gb.id, qty);
      toast.success(mine ? "Pledge updated" : "Joined group buy");
    } finally { setBusy(false); }
  };

  const openChat = async () => {
    if (!gb.conversation_id) return;
    navigate(`/messages`);
  };

  return (
    <div className="pb-10">
      <header className="px-3 py-2 flex items-center gap-2 sticky top-0 z-10 glass-strong border-b border-border/60">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-bold text-sm flex-1 truncate">Group buy</p>
      </header>

      <section className="px-5 pt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Private group</p>
        <h1 className="text-xl font-extrabold mt-1 leading-tight">{gb.title}</h1>
        <Link to={`/product/${gb.product_id}`} className="text-xs text-muted-foreground underline mt-1 inline-block">
          View product
        </Link>
      </section>

      <section className="px-5 mt-5">
        <div className="flex items-end justify-between mb-1.5">
          <p className="text-sm font-bold tabular-nums">{total} / {gb.target_qty} units</p>
          <p className="text-xs font-semibold text-muted-foreground">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {members.length} members</span>
          <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Target {gb.target_qty}</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {deadlineLabel}</span>
        </div>
        {isLocked && (
          <p className="mt-3 text-xs font-bold text-emerald-600 uppercase tracking-wide">
            {gb.status === "locked" ? "Target reached — supplier notified" : gb.status}
          </p>
        )}
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Your pledge</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-full h-10 px-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full flex items-center justify-center font-bold">−</button>
            <input
              type="number" min={1} value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 bg-transparent text-center text-sm font-bold outline-none"
            />
            <button onClick={() => setQty((q) => q + 1)} className="w-8 h-8 rounded-full flex items-center justify-center font-bold"><Plus className="w-4 h-4" /></button>
          </div>
          <button
            onClick={handleJoin} disabled={busy || isLocked}
            className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isMember ? <><Check className="w-4 h-4" /> Update pledge</> : "Join group buy"}
          </button>
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Members</h2>
        <MembersList members={members} ownerId={gb.owner_id} />
      </section>

      {gb.conversation_id && (
        <section className="px-5 mt-6">
          <button onClick={openChat} className="w-full h-11 rounded-full bg-muted text-sm font-bold">
            Open group chat
          </button>
        </section>
      )}
    </div>
  );
}

function MembersList({ members, ownerId }: { members: any[]; ownerId: string }) {
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }>>({});
  useState(() => {
    (async () => {
      const ids = members.map((m) => m.user_id);
      if (!ids.length) return;
      const { data } = await supabase.from("profiles").select("user_id,display_name,username,avatar_url").in("user_id", ids);
      const map: typeof profiles = {};
      (data ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    })();
  });
  if (!members.length) return <p className="text-xs text-muted-foreground">No members yet</p>;
  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const p = profiles[m.user_id];
        const name = p?.display_name || p?.username || "Member";
        return (
          <li key={m.user_id}>
            <Link to={`/u/${m.user_id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted">
              <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-bold">
                {p?.avatar_url ? <img src={p.avatar_url} alt={name} className="w-full h-full object-cover" /> : name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{name}{m.user_id === ownerId && <span className="ml-1 text-[10px] uppercase font-bold text-primary">Owner</span>}</p>
              </div>
              <p className="text-xs font-bold tabular-nums">{m.qty}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
