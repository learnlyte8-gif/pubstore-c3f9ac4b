import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Package, FileText, MessageCircle, TrendingDown, Bell, CheckCheck, Truck, Sparkles, Trash2, ShoppingBag, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const meta = (type: string): { icon: typeof Package; tone: string; label: string } => {
  if (type.startsWith("order")) return { icon: Truck, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400", label: "Orders" };
  if (type === "new_order") return { icon: ShoppingBag, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "New order" };
  if (type === "message") return { icon: MessageCircle, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400", label: "Messages" };
  if (type.startsWith("rfq")) return { icon: FileText, tone: "bg-primary/10 text-primary", label: "RFQ" };
  if (type === "price") return { icon: TrendingDown, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Prices" };
  if (type === "follower") return { icon: UserPlus, tone: "bg-pink-500/15 text-pink-600 dark:text-pink-400", label: "Follower" };
  return { icon: Sparkles, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "System" };
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "order", label: "Orders" },
  { id: "rfq", label: "RFQs" },
  { id: "message", label: "Messages" },
] as const;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
};

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("notifications").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(100);
      if (!alive) return;
      setItems((data ?? []) as Notif[]);
      setLoading(false);

      channel = supabase
        .channel(`notif:${user.id}:${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          setItems((prev) => [payload.new as Notif, ...prev]);
        })
        .subscribe();
    })();
    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const visible = items.filter((n) => filter === "all" || n.type.startsWith(filter));
  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!userId) return;
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  };
  const open = async (n: Notif) => {
    if (!n.read) {
      setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    if (n.link) navigate(n.link);
  };
  const remove = async (id: string) => {
    setItems((arr) => arr.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  return (
    <div className="pb-8">
      <div className="px-3 py-2.5 border-b border-border bg-card shadow-soft sticky top-0 z-10 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Notifications</p>
          <p className="text-[10px] text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-semibold text-primary inline-flex items-center gap-1 px-2 h-8 rounded-full hover:bg-primary/10">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all
          </button>
        )}
      </div>

      <div className="px-3 pt-3 flex gap-2 overflow-x-auto scrollbar-none -mx-1 pl-4 pb-1">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 h-8 rounded-full text-xs font-semibold transition ${filter === f.id ? "bg-foreground text-background shadow-card" : "bg-muted text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-16">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold">Nothing here yet</p>
          <p className="text-xs text-muted-foreground mt-1">New activity will appear in this feed.</p>
        </div>
      ) : (
        <ul className="px-3 mt-3 space-y-2">
          {visible.map((n) => {
            const m = meta(n.type);
            const Icon = m.icon;
            return (
              <li key={n.id}>
                <div className={`relative w-full rounded-2xl border border-border shadow-card hover:shadow-elevated transition flex gap-3 p-3 ${!n.read ? "bg-card" : "bg-muted/30"}`}>
                  <button onClick={() => open(n)} className="flex gap-3 flex-1 text-left">
                    <span className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.tone}`}>
                      <Icon className="w-5 h-5" strokeWidth={2} />
                      {!n.read && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs leading-snug ${!n.read ? "font-bold" : "font-semibold"}`}>{n.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(n.created_at)}</span>
                      </div>
                      {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    </div>
                  </button>
                  <button onClick={() => remove(n.id)} aria-label="Delete" className="shrink-0 self-start text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 mt-6">
        <Link to="/account" className="block text-center text-xs text-muted-foreground hover:text-foreground">
          Manage notification preferences →
        </Link>
      </div>
    </div>
  );
}
