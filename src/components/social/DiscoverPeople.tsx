import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus, MessageCircle, Check, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Person = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio?: string | null;
};

export default function DiscoverPeople({
  currentUserId,
  onOpenConversation,
}: {
  currentUserId: string | null;
  onOpenConversation: (conversationId: string) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Suggested = recent profiles, exclude self.
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .order("created_at", { ascending: false })
        .limit(60);
      let mine = new Set<string>();
      if (currentUserId) {
        const { data: f } = await supabase
          .from("user_follows").select("followee_id").eq("follower_id", currentUserId);
        mine = new Set((f ?? []).map((r: any) => r.followee_id));
      }
      if (!alive) return;
      setFollowing(mine);
      setPeople((profs ?? []).filter((p: any) => p.user_id !== currentUserId) as Person[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [currentUserId]);

  const filtered = people.filter((p) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (p.display_name ?? "").toLowerCase().includes(t)
      || (p.username ?? "").toLowerCase().includes(t)
      || (p.bio ?? "").toLowerCase().includes(t);
  });

  const toggleFollow = async (uid: string) => {
    if (!currentUserId) {
      window.location.href = `/auth?redirect=${encodeURIComponent("/messages")}`;
      return;
    }
    setBusy(uid);
    const isFollowing = following.has(uid);
    const next = new Set(following);
    if (isFollowing) {
      next.delete(uid);
      setFollowing(next);
      await supabase.from("user_follows").delete()
        .eq("follower_id", currentUserId).eq("followee_id", uid);
    } else {
      next.add(uid);
      setFollowing(next);
      const { error } = await supabase.from("user_follows")
        .insert({ follower_id: currentUserId, followee_id: uid });
      if (error && error.code !== "23505") {
        next.delete(uid);
        setFollowing(new Set(next));
        toast.error("Couldn't follow");
      } else {
        toast.success("Followed");
      }
    }
    setBusy(null);
  };

  const startChat = async (peer: Person) => {
    if (!currentUserId) {
      window.location.href = `/auth?redirect=${encodeURIComponent("/messages")}`;
      return;
    }
    setBusy(peer.user_id);
    try {
      // Find existing DM
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("kind", "dm")
        .or(`and(buyer_id.eq.${currentUserId},peer_user_id.eq.${peer.user_id}),and(buyer_id.eq.${peer.user_id},peer_user_id.eq.${currentUserId})`)
        .limit(1)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({
            buyer_id: currentUserId,
            peer_user_id: peer.user_id,
            kind: "dm",
            title: peer.display_name || peer.username || "Direct message",
          } as any)
          .select("id").single();
        if (error) throw error;
        convId = created!.id;
        await supabase.from("conversation_members").insert([
          { conversation_id: convId, user_id: currentUserId },
          { conversation_id: convId, user_id: peer.user_id },
        ]);
      }
      onOpenConversation(convId!);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't start chat");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-3 pt-3">
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find friends by name or @username"
          className="w-full h-10 pl-9 pr-3 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <p className="px-1 pb-2 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
        Suggested for you
      </p>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse px-2">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-ig-gradient/20 mx-auto mb-3 flex items-center justify-center">
            <UserPlus className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm font-bold">No people to suggest yet</p>
          <p className="text-xs text-muted-foreground mt-1">Check back soon as more sellers and buyers join.</p>
        </div>
      ) : (
        <ul className="space-y-1 pb-6">
          {filtered.map((p) => {
            const isFollowing = following.has(p.user_id);
            const name = p.display_name || p.username || "User";
            return (
              <li key={p.user_id}>
                <div className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-muted/60 transition">
                  <Link to={`/u/${p.user_id}`} className="shrink-0">
                    <div className="ring-gradient rounded-full p-[2px]" style={{ width: 50, height: 50 }}>
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover bg-card" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                          {name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </Link>
                  <Link to={`/u/${p.user_id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate flex items-center gap-1">
                      {name}
                      {p.username && <ShieldCheck className="w-3 h-3 text-primary/60 hidden" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.username ? `@${p.username}` : (p.bio ?? "Tap to view profile")}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleFollow(p.user_id)}
                      disabled={busy === p.user_id}
                      className={`h-8 px-3 rounded-full text-[11px] font-bold transition active:scale-95 flex items-center gap-1 ${
                        isFollowing
                          ? "bg-muted text-foreground"
                          : "bg-ig-gradient text-white shadow-soft"
                      }`}
                    >
                      {isFollowing ? <><Check className="w-3 h-3" /> Following</> : <><UserPlus className="w-3 h-3" /> Follow</>}
                    </button>
                    <button
                      onClick={() => startChat(p)}
                      disabled={busy === p.user_id}
                      aria-label="Message"
                      className="w-8 h-8 rounded-full bg-muted hover:bg-accent flex items-center justify-center active:scale-90 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
