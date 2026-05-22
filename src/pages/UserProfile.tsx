import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserFollowCounts } from "@/hooks/useSocial";
import FollowUserButton from "@/components/social/FollowUserButton";
import { ArrowLeft, MessageCircle, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type LikedProduct = { id: string; title: string; image: string | null; price: number };

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [likedProducts, setLikedProducts] = useState<LikedProduct[]>([]);
  const { data: counts } = useUserFollowCounts(userId);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (!alive) return;
      setProfile(p as Profile | null);

      const { data: likes } = await supabase
        .from("post_likes")
        .select("target_id")
        .eq("user_id", userId)
        .eq("target_type", "product")
        .order("created_at", { ascending: false })
        .limit(48);
      const ids = (likes ?? []).map((r: any) => r.target_id);
      if (ids.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id,title,image,price")
          .in("id", ids);
        const map = new Map((prods ?? []).map((p: any) => [p.id, p]));
        if (alive) setLikedProducts(ids.map((id) => map.get(id)).filter(Boolean) as LikedProduct[]);
      } else if (alive) {
        setLikedProducts([]);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  const startDm = async () => {
    if (!userId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/u/${userId}`)}`);
      return;
    }
    if (user.id === userId) return;
    // Find or create DM conversation
    const a = user.id < userId ? user.id : userId;
    const b = user.id < userId ? userId : user.id;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("kind", "dm")
      .or(`and(buyer_id.eq.${a},peer_user_id.eq.${b}),and(buyer_id.eq.${b},peer_user_id.eq.${a})`)
      .maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: user.id, peer_user_id: userId, kind: "dm" })
        .select("id")
        .single();
      if (error || !created) { toast.error("Couldn't open chat"); return; }
      convId = created.id;
      await supabase.from("conversation_members").insert([
        { conversation_id: convId, user_id: user.id },
      ]);
    }
    navigate(`/messages`);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${userId}`;
    try {
      if (navigator.share) await navigator.share({ title: profile?.display_name ?? "Profile", url });
      else { await navigator.clipboard.writeText(url); toast.success("Profile link copied"); }
    } catch {/* */}
  };

  if (loading) {
    return <div className="px-4 py-10 text-sm text-muted-foreground"><CircleSpinner size={28} /></div>;
  }
  if (!profile) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-semibold">User not found</p>
        <Link to="/home" className="text-primary text-sm mt-2 inline-block">Back home</Link>
      </div>
    );
  }

  const name = profile.display_name || profile.username || "User";

  return (
    <div className="pb-10">
      <header className="px-3 py-2 flex items-center gap-2 sticky top-0 z-10 glass-strong border-b border-border/60">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-bold text-sm flex-1 truncate">{name}</p>
        <button onClick={handleShare} aria-label="Share profile" className="p-2 rounded-full hover:bg-muted">
          <Share2 className="w-5 h-5" />
        </button>
      </header>

      <section className="px-5 pt-6 pb-4 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full ring-2 ring-primary/30 overflow-hidden bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            name[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1 grid grid-cols-3 gap-2 text-center">
          <Stat label="Likes" value={likedProducts.length} />
          <Stat label="Followers" value={counts?.followers ?? 0} />
          <Stat label="Following" value={counts?.following ?? 0} />
        </div>
      </section>

      <section className="px-5">
        <p className="text-base font-extrabold">{name}</p>
        {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
      </section>

      <section className="px-5 mt-4 flex items-center gap-2">
        <FollowUserButton userId={profile.user_id} className="flex-1" />
        <button
          onClick={startDm}
          className="flex-1 h-9 rounded-full bg-muted text-sm font-bold flex items-center justify-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" /> Message
        </button>
      </section>

      <section className="mt-8 px-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
          <Heart className="w-3.5 h-3.5" /> Liked products
        </h2>
        {likedProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No likes yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {likedProducts.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="block aspect-square rounded-lg overflow-hidden bg-muted">
                {p.image && <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-extrabold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    </div>
  );
}
