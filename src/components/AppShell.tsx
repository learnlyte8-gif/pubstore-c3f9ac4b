import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { Home, Search, LayoutGrid, Heart, User, ShoppingCart, Bell, MessageCircle } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import RotatingHint from "@/components/RotatingHint";
import LiveActivityToaster from "@/components/LiveActivityToaster";
import InstallPrompt from "@/components/InstallPrompt";
import BannerAd from "@/components/marketplace/BannerAd";
import logo from "@/assets/pubstore-logo.png";

export default function AppShell() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const { cartCount, wishlist } = useShop();

  useEffect(() => {
    if (!session?.user?.id) return;
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
    const verifyProfile = async (s: Session) => {
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", s.user.id)
        .maybeSingle();
      if (!data?.profile_completed) {
        navigate("/onboarding", { replace: true });
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate("/auth", { replace: true });
      else setTimeout(() => verifyProfile(s), 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecked(true);
      if (!session) navigate("/auth", { replace: true });
      else verifyProfile(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!checked || !session) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border safe-top shadow-soft">
        <div className="max-w-2xl mx-auto h-14 px-4 flex items-center gap-3">
          <Link to="/home" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="" width={28} height={28} className="w-7 h-7" />
            <span className="font-brand text-xl tracking-wide hidden sm:inline">PUBSTORE</span>
          </Link>

          <Link
            to="/search"
            className="flex-1 h-9 rounded-full bg-muted hover:bg-muted/80 transition flex items-center gap-2 px-4 text-sm text-muted-foreground shadow-soft min-w-0"
            aria-label="Search products"
          >
            <Search className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span className="text-xs sm:text-sm shrink-0">Try</span>
            <RotatingHint className="text-xs sm:text-sm font-medium text-foreground/80 truncate" />
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            <Link to="/notifications" aria-label="Notifications" className="relative p-2 rounded-full hover:bg-muted transition">
              <Bell className="w-5 h-5" strokeWidth={1.8} />
              {unreadNotifs > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-soft">
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </span>
              )}
            </Link>
            <Link to="/cart" aria-label="Cart" className="relative p-2 rounded-full hover:bg-muted transition">
              <ShoppingCart className="w-5 h-5" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-soft">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto pb-20 lg:pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border safe-bottom lg:hidden shadow-elevated">
        <ul className="max-w-2xl mx-auto h-16 px-1 flex items-center justify-around">
          <TabItem to="/home" icon={Home} label="Home" />
          <TabItem to="/categories" icon={LayoutGrid} label="Categories" />
          <TabItem to="/messages" icon={MessageCircle} label="Chat" />
          <TabItem to="/wishlist" icon={Heart} label="Wishlist" badge={wishlist.length} />
          <TabItem to="/profile" icon={User} label="Account" />
        </ul>
      </nav>

      <LiveActivityToaster />
      <BannerAd />
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
    <li className="flex-1">
      <NavLink
        to={to}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-0.5 h-14 ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`
        }
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span className="relative">
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-soft">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
              {label}
            </span>
          </>
        )}
      </NavLink>
    </li>
  );
}
