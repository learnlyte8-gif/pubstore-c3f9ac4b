import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { Home, Search, LayoutGrid, Heart, User, ShoppingCart, Bell, MessageCircle, Navigation, Menu, Store, Briefcase, Wrench, Building2, Car, Landmark, Factory, Newspaper, Hotel, Truck, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

          <div className="flex-1 flex items-center gap-1.5 min-w-0 h-8 rounded-full bg-muted/70 pr-3.5">
            <RailDrawer />
            <Link
              to="/search"
              className="flex-1 flex items-center gap-2 min-w-0 active:opacity-70 transition"
              aria-label="Search products"
            >
              <span className="text-xs shrink-0 text-muted-foreground">Try</span>
              <RotatingHint className="text-xs font-medium text-foreground/80 truncate" />
            </Link>
          </div>

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

      {/* Bottom tab bar — solid, fixed, no blur, 3D icons */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-background border-t border-border/70 safe-bottom shadow-[0_-6px_18px_-8px_hsl(0_0%_0%/0.18)]"
        aria-label="Primary"
      >
        <ul className="max-w-2xl mx-auto h-[60px] px-1 flex items-stretch justify-around">
          <TabItem to="/home" icon={Home} label="Home" />
          <TabItem to="/categories" icon={LayoutGrid} label="Shop" />
          <TabItem to="/rides" icon={Navigation} label="Rides" />
          <TabItem to="/messages" icon={MessageCircle} label="Chat" badge={chatsWithUnread} />
          <TabItem to="/wishlist" icon={Heart} label="Saved" badge={wishlist.length} />
          <TabItem to="/profile" icon={User} label="You" />
        </ul>
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
        className="group flex flex-col items-center justify-center gap-[3px] h-full select-none active:scale-[0.9] transition-transform duration-150 will-change-transform"
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span className="relative flex items-center justify-center h-7 w-7">
              {/* 3D glow halo behind active icon */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-[-6px] rounded-full bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.35)_0%,hsl(var(--primary)/0.12)_45%,transparent_70%)] blur-[2px]"
                />
              )}
              <Icon
                className={`relative w-[24px] h-[24px] transition-all duration-200 ${
                  isActive
                    ? "text-primary -translate-y-[1px] [filter:drop-shadow(0_2px_0_hsl(var(--primary)/0.35))_drop-shadow(0_4px_8px_hsl(var(--primary)/0.45))]"
                    : "text-muted-foreground [filter:drop-shadow(0_1px_0_hsl(0_0%_0%/0.18))]"
                }`}
                strokeWidth={isActive ? 2.6 : 2}
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.18 : 0}
              />
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background shadow-[0_2px_4px_hsl(0_85%_55%/0.5)]">
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
            {/* Active indicator dot */}
            <span
              className={`h-[3px] w-[3px] rounded-full transition-all duration-200 ${
                isActive ? "bg-primary opacity-100 shadow-[0_0_6px_hsl(var(--primary))]" : "opacity-0"
              }`}
            />
          </>
        )}
      </NavLink>
    </li>
  );
}
