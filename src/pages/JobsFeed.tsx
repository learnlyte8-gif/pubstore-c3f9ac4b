import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, MessageCircle, Send, Image as ImageIcon, Link2, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fetchFeed, type JobPost } from "@/data/jobs";
import EmptyState from "@/components/EmptyState";

export default function JobsFeed() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [authedId, setAuthedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [openComments, setOpenComments] = useState<JobPost | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAuthedId(data.user?.id ?? null)); }, []);

  const { data: posts = [], isLoading } = useQuery({ queryKey: ["job-feed"], queryFn: () => fetchFeed(50) });

  const { data: myLikes = new Set<string>() } = useQuery({
    queryKey: ["job-feed-my-likes", authedId],
    queryFn: async () => {
      if (!authedId) return new Set<string>();
      const { data } = await supabase.from("job_post_likes").select("post_id").eq("user_id", authedId);
      return new Set((data ?? []).map((r) => r.post_id as string));
    },
    enabled: !!authedId,
  });

  async function publish() {
    if (!authedId) { nav("/auth"); return; }
    if (!body.trim()) { toast.error("Write something to share"); return; }
    const { error } = await supabase.from("job_posts").insert({
      author_id: authedId, body: body.trim(), link_url: linkUrl || null,
    });
    if (error) { toast.error(error.message); return; }
    setBody(""); setLinkUrl(""); setShowLink(false);
    qc.invalidateQueries({ queryKey: ["job-feed"] });
    toast.success("Posted");
  }

  async function toggleLike(p: JobPost) {
    if (!authedId) { nav("/auth"); return; }
    const liked = myLikes.has(p.id);
    if (liked) {
      await supabase.from("job_post_likes").delete().eq("user_id", authedId).eq("post_id", p.id);
      await supabase.from("job_posts").update({ likes_count: Math.max(0, p.likes_count - 1) }).eq("id", p.id);
    } else {
      await supabase.from("job_post_likes").insert({ user_id: authedId, post_id: p.id });
      await supabase.from("job_posts").update({ likes_count: p.likes_count + 1 }).eq("id", p.id);
    }
    qc.invalidateQueries({ queryKey: ["job-feed-my-likes"] });
    qc.invalidateQueries({ queryKey: ["job-feed"] });
  }

  async function deletePost(id: string) {
    await supabase.from("job_posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["job-feed"] });
    toast.success("Post deleted");
  }

  return (
    <div className="">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-blue-700 via-indigo-700 to-sky-600 text-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tight">Feed</h1>
            <p className="text-[11px] opacity-90">Share updates with your network</p>
          </div>
          <Link to="/jobs/network" className="text-xs font-bold underline opacity-90">Network</Link>
        </div>
      </header>

      {/* Composer */}
      <section className="px-4 pt-4">
        <div className="rounded-2xl bg-card border shadow-card p-3">
          <Textarea
            rows={3}
            placeholder={authedId ? "Share an update, idea or opportunity…" : "Sign in to share with the community"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!authedId}
            className="resize-none border-0 bg-transparent focus-visible:ring-0 px-0 shadow-none"
          />
          {showLink && (
            <Input
              autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://" className="mb-2"
            />
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex gap-1">
              <button onClick={() => setShowLink((v) => !v)} className="px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 hover:bg-muted">
                <Link2 className="w-3.5 h-3.5" /> Link
              </button>
            </div>
            <Button size="sm" onClick={publish} disabled={!authedId || !body.trim()}>
              <Send className="w-3.5 h-3.5 mr-1" /> Post
            </Button>
          </div>
        </div>
      </section>

      {/* Feed */}
      <section className="px-4 mt-4 space-y-3">
        {isLoading && <p className="text-center text-xs text-muted-foreground py-6">Loading feed…</p>}
        {!isLoading && posts.length === 0 && (
          <EmptyState icon={<Sparkles className="w-7 h-7 text-muted-foreground" />} title="No posts yet" description="Be the first to share something." />
        )}
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            isOwn={p.author_id === authedId}
            liked={myLikes.has(p.id)}
            onLike={() => toggleLike(p)}
            onComment={() => setOpenComments(p)}
            onDelete={() => deletePost(p.id)}
          />
        ))}
      </section>

      <CommentsDialog
        open={!!openComments}
        post={openComments}
        authedId={authedId}
        onClose={() => setOpenComments(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ["job-feed"] })}
      />
    </div>
  );
}

function PostCard({ post, isOwn, liked, onLike, onComment, onDelete }: {
  post: JobPost; isOwn: boolean; liked: boolean; onLike: () => void; onComment: () => void; onDelete: () => void;
}) {
  const { data: author } = useQuery({
    queryKey: ["post-author", post.author_id],
    queryFn: async () => {
      const { data } = await supabase.from("job_seeker_profiles")
        .select("user_id,headline,current_title,current_company,avatar_url")
        .eq("user_id", post.author_id).maybeSingle();
      return data;
    },
  });

  return (
    <article className="rounded-2xl bg-card border shadow-card p-4">
      <header className="flex items-center gap-2.5">
        <Link to={`/jobs/people/${post.author_id}`} className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
          {author?.avatar_url
            ? <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary font-bold">{(author?.current_title || author?.headline || "U")[0]?.toUpperCase()}</div>}
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/jobs/people/${post.author_id}`} className="text-sm font-bold truncate hover:underline block">
            {author?.current_title || author?.headline || "Member"}
          </Link>
          <p className="text-[11px] text-muted-foreground truncate">
            {author?.current_company ?? ""} · {timeAgo(post.created_at)}
          </p>
        </div>
        {isOwn && (
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      <p className="text-sm whitespace-pre-line mt-3 text-foreground/90">{post.body}</p>
      {post.link_url && (
        <a href={post.link_url} target="_blank" rel="noreferrer" className="block mt-3 rounded-xl border p-3 text-xs hover:bg-muted/40 truncate text-primary">
          🔗 {post.link_url}
        </a>
      )}
      {post.media?.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {post.media.slice(0, 4).map((m, i) => <img key={i} src={m} alt="" className="rounded-lg aspect-square object-cover" />)}
        </div>
      )}

      <footer className="mt-3 pt-3 border-t flex items-center justify-around text-xs">
        <button onClick={onLike} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold ${liked ? "text-rose-500" : "text-muted-foreground hover:text-foreground"}`}>
          <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {post.likes_count || ""} {liked ? "Liked" : "Like"}
        </button>
        <button onClick={onComment} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-muted-foreground hover:text-foreground">
          <MessageCircle className="w-4 h-4" /> {post.comments_count || ""} Comment
        </button>
      </footer>
    </article>
  );
}

function CommentsDialog({ open, post, authedId, onClose, onChanged }: {
  open: boolean; post: JobPost | null; authedId: string | null; onClose: () => void; onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", post?.id],
    queryFn: async () => {
      if (!post) return [];
      const { data } = await supabase.from("job_post_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!post,
  });

  async function send() {
    if (!authedId || !post || !body.trim()) return;
    const { error } = await supabase.from("job_post_comments").insert({ post_id: post.id, user_id: authedId, body: body.trim() });
    if (error) { toast.error(error.message); return; }
    await supabase.from("job_posts").update({ comments_count: post.comments_count + 1 }).eq("id", post.id);
    setBody("");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2">
          {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Be the first to comment.</p>}
          {comments.map((c: any) => <CommentRow key={c.id} c={c} />)}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" onKeyDown={(e) => e.key === "Enter" && send()} />
          <Button onClick={send} disabled={!authedId || !body.trim()}><Send className="w-4 h-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentRow({ c }: { c: any }) {
  const { data: author } = useQuery({
    queryKey: ["seeker-lite", c.user_id],
    queryFn: async () => {
      const { data } = await supabase.from("job_seeker_profiles")
        .select("user_id,headline,current_title,avatar_url").eq("user_id", c.user_id).maybeSingle();
      return data;
    },
  });
  return (
    <div className="flex gap-2">
      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
        {author?.avatar_url ? <img src={author.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center bg-primary/10 text-primary text-xs font-bold">{(author?.current_title || "U")[0]?.toUpperCase()}</div>}
      </div>
      <div className="flex-1 min-w-0 bg-muted/50 rounded-2xl px-3 py-2">
        <p className="text-xs font-bold leading-tight truncate">{author?.current_title || author?.headline || "Member"}</p>
        <p className="text-sm whitespace-pre-line">{c.body}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(c.created_at)}</p>
      </div>
    </div>
  );
}

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(s).toLocaleDateString();
}
