import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { Home, Search, PlusSquare, Heart, User, Send, ShoppingCart } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import logo from "@/assets/pubstore-logo.png";

export default function AppShell() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const { cartCount } = useShop();

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
      {/* Top bar — IG style */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="max-w-2xl mx-auto h-12 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" width={28} height={28} className="w-7 h-7" />
            <span className="font-brand text-2xl tracking-wide">PUBSTORE</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/cart" aria-label="Cart" className="relative p-1">
              <ShoppingCart className="w-6 h-6" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
            <button aria-label="Activity" className="p-1">
              <Heart className="w-6 h-6" strokeWidth={1.8} />
            </button>
            <button aria-label="Messages" className="p-1">
              <Send className="w-6 h-6" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl w-full mx-auto pb-20 lg:pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border safe-bottom lg:hidden">
        <ul className="max-w-2xl mx-auto h-14 px-2 flex items-center justify-around">
          <TabItem to="/home" icon={Home} label="Home" />
          <TabItem to="/search" icon={Search} label="Search" />
          <TabItem to="/create" icon={PlusSquare} label="Create" />
          <TabItem to="/activity" icon={Heart} label="Activity" />
          <TabItem to="/profile" icon={User} label="Profile" />
        </ul>
      </nav>
    </div>
  );
}

function TabItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Home;
  label: string;
}) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        className={({ isActive }) =>
          `flex items-center justify-center h-12 ${isActive ? "text-foreground" : "text-foreground/80"}`
        }
        aria-label={label}
      >
        {({ isActive }) => <Icon className="w-7 h-7" strokeWidth={isActive ? 2.4 : 1.8} />}
      </NavLink>
    </li>
  );
}
