import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { Home, Search, LayoutGrid, Heart, User, ShoppingCart, Bell, MessageCircle, Navigation } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import RotatingHint from "@/components/RotatingHint";
import LiveActivityToaster from "@/components/LiveActivityToaster";
import InstallPrompt from "@/components/InstallPrompt";
import BannerAd from "@/components/marketplace/BannerAd";
import ImportProgressBanner from "@/components/ImportProgressBanner";
import { useUnreadChats } from "@/hooks/useUnreadChats";
import logo from "@/assets/pubstore-logo.png";

export default function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const { cartCount, wishlist } = useShop();
  const { chatsWithUnread } = useUnreadChats();

  useEffect(() => {
    if (!session?.user?.id) {
      setUnreadNotifs(0);
      return;
    }
    const uid = session.user.id;
    const load = async () => {
      const { count } = await supabase
        .from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("read", false);
      setUnreadNotifs(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`shell-notif:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.user?.id]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* Top bar — compact, frosted */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/60 safe-top">
        <div className="max-w-2xl mx-auto h-12 px-3 flex items-center gap-2">
          <Link to="/home" className="flex items-center gap-2 shrink-0 active:scale-95 transition-transform">
            <img src={logo} alt="" width={26} height={26} className="w-[26px] h-[26px]" />
            <span className="font-brand text-lg tracking-wide hidden sm:inline">PUBSTORE</span>
          </Link>

          <Link
            to="/search"
            className="flex-1 h-8 rounded-full bg-muted/70 active:bg-muted transition flex items-center gap-2 px-3.5 text-sm text-muted-foreground min-w-0"
            aria-label="Search products"
          >
            <Search className="w-4 h-4 shrink-0" strokeWidth={2.2} />
            <span className="text-xs shrink-0">Try</span>
            <RotatingHint className="text-xs font-medium text-foreground/80 truncate" />
          </Link>

          <div className="flex items-center gap-0.5 shrink-0">
            <Link to="/notifications" aria-label="Notifications" className="relative p-2 rounded-full active:scale-90 active:bg-muted transition">
              <Bell className="w-[22px] h-[22px]" strokeWidth={1.8} />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </span>
              )}
            </Link>
            <Link to="/cart" aria-label="Cart" className="relative p-2 rounded-full active:scale-90 active:bg-muted transition">
              <ShoppingCart className="w-[22px] h-[22px]" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto pb-[calc(env(safe-area-inset-bottom)+76px)] lg:pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar — frosted, fixed, no shake. */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden pointer-events-none"
        aria-label="Primary"
      >
        <div className="pointer-events-auto bg-background/85 backdrop-blur-xl border-t border-border/60 safe-bottom">
          <ul className="max-w-2xl mx-auto h-[58px] px-1.5 flex items-stretch justify-around">
            <TabItem to="/home" icon={Home} label="Home" />
            <TabItem to="/categories" icon={LayoutGrid} label="Shop" />
            <TabItem to="/rides" icon={Navigation} label="Rides" />
            <TabItem to="/messages" icon={MessageCircle} label="Chat" badge={chatsWithUnread} />
            <TabItem to="/wishlist" icon={Heart} label="Saved" badge={wishlist.length} />
            <TabItem to="/profile" icon={User} label="You" />
          </ul>
        </div>
      </nav>

      <LiveActivityToaster />
      <BannerAd />
      <ImportProgressBanner />
      <InstallPrompt />
    </div>
  );
}

function TabItem({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  badge?: number;
}) {
  return (
    <li className="flex-1 min-w-0">
      <NavLink
        to={to}
        className="group flex flex-col items-center justify-center gap-0.5 h-full select-none active:scale-[0.92] transition-transform duration-150 will-change-transform"
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span
              className={`relative flex items-center justify-center h-7 w-12 rounded-full transition-colors duration-200 ${
                isActive ? "bg-primary/12" : "bg-transparent"
              }`}
            >
              <Icon
                className={`w-[22px] h-[22px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-0.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-none tracking-tight transition-colors ${
                isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
              }`}
            >
              {label}
            </span>
          </>
        )}
      </NavLink>
    </li>
  );
}
