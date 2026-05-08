import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { House, Search, LayoutGrid, Heart, CircleUser, ShoppingBag, ShoppingCart, Bell, MessageCircle, Navigation, Menu, Store, Briefcase, Wrench, Building2, Car, Landmark, Factory, Newspaper, Hotel, Truck, X, Home } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import RotatingHint from "@/components/RotatingHint";
import LiveActivityToaster from "@/components/LiveActivityToaster";
import NativeSuggestionToaster from "@/components/NativeSuggestionToaster";
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

      {/* Bottom tab bar — iOS liquid glass */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden pointer-events-none pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="pointer-events-auto mx-auto mb-0.5 max-w-[calc(100%-1rem)] sm:max-w-md ios-liquid-bar">
          <span aria-hidden className="ios-liquid-shimmer" />
          <ul className="relative h-[58px] px-1.5 flex items-stretch justify-around">
            <TabItem to="/home" icon={House} label="Home" />
            <TabItem to="/categories" icon={ShoppingBag} label="Shop" />
            <TabItem to="/messages" icon={MessageCircle} label="Chats" badge={chatsWithUnread} />
            <TabItem to="/wishlist" icon={Heart} label="Saved" badge={wishlist.length} />
            <TabItem to="/profile" icon={CircleUser} label="You" />
          </ul>
        </div>
      </nav>

      <LiveActivityToaster />
      <NativeSuggestionToaster />
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
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-[-10px] rounded-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.45)_0%,hsl(var(--primary)/0.18)_45%,transparent_75%)] animate-tab-glow"
                />
              )}
              <Icon
                className={`relative w-[26px] h-[26px] transition-all duration-200 ${
                  isActive
                    ? "text-primary scale-[1.06]"
                    : "text-foreground/60"
                }`}
                strokeWidth={isActive ? 2.2 : 1.9}
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.16 : 0}
              />
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background shadow-[0_2px_4px_hsl(0_85%_55%/0.5)]">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-none tracking-tight transition-colors ${
                isActive ? "text-primary font-semibold" : "text-foreground/60 font-medium"
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

const RAIL_ITEMS: { to: string; label: string; icon: typeof Home; tone: string }[] = [
  { to: "/categories", label: "Marketplace", icon: Store, tone: "from-blue-500 to-indigo-600" },
  { to: "/jobs", label: "Jobs", icon: Briefcase, tone: "from-emerald-500 to-teal-600" },
  { to: "/rides", label: "Rides", icon: Navigation, tone: "from-orange-500 to-red-600" },
  { to: "/services", label: "Services", icon: Wrench, tone: "from-purple-500 to-fuchsia-600" },
  { to: "/properties", label: "Properties", icon: Building2, tone: "from-rose-500 to-pink-600" },
  { to: "/auto", label: "Auto", icon: Car, tone: "from-slate-600 to-slate-800" },
  { to: "/car-rentals", label: "Car rentals", icon: Car, tone: "from-cyan-500 to-blue-600" },
  { to: "/finance", label: "Finance", icon: Landmark, tone: "from-amber-500 to-yellow-600" },
  { to: "/industrial", label: "Industrial", icon: Factory, tone: "from-zinc-600 to-zinc-800" },
  { to: "/logistics", label: "Logistics", icon: Truck, tone: "from-lime-500 to-green-600" },
  { to: "/stays", label: "Stays", icon: Hotel, tone: "from-pink-500 to-rose-600" },
  { to: "/news", label: "News", icon: Newspaper, tone: "from-neutral-600 to-neutral-800" },
];

function RailDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition"
        >
          <Menu className="w-[18px] h-[18px]" strokeWidth={2.4} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[86vw] max-w-sm p-0 border-r border-border/60 bg-background flex flex-col"
      >
        {/* Brand header */}
        <div className="relative px-5 pt-6 pb-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border/50">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-background shadow-pop flex items-center justify-center">
              <img src={logo} alt="PUBSTORE" className="w-9 h-9" />
            </div>
            <div>
              <p className="font-brand text-2xl tracking-wide leading-none">PUBSTORE</p>
              <p className="text-[11px] text-muted-foreground mt-1">Everything. One app.</p>
            </div>
          </div>
        </div>

        {/* Rails grid */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            Explore
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {RAIL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="group flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-muted/50 hover:bg-muted active:scale-95 transition border border-border/40"
                >
                  <span
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.tone} flex items-center justify-center shadow-pop`}
                  >
                    <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </span>
                  <span className="text-[11px] font-semibold text-center leading-tight">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Signature footer */}
        <div className="border-t border-border/50 px-5 py-4 bg-muted/30">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground text-center">
            A signature creation by
          </p>
          <p className="font-brand text-base tracking-wide text-center mt-1 bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
            KUKISTACKSGROUP
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
