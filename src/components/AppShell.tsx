import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation, useSearchParams } from "react-router-dom";
import { House, Search, LayoutGrid, Heart, CircleUser, ShoppingBag, ShoppingCart, Bell, MessageCircle, Navigation, Menu, Store, Briefcase, Wrench, Building2, Car, Landmark, Factory, Newspaper, Hotel, Truck, X, Home, Sparkles, Camera } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/store/shop";
import RotatingHint from "@/components/RotatingHint";
import LiveActivityToaster from "@/components/LiveActivityToaster";
import ActiveRideMonitor from "@/components/rides/ActiveRideMonitor";
import NativeSuggestionToaster from "@/components/NativeSuggestionToaster";
import InstallPrompt from "@/components/InstallPrompt";
import BannerAd from "@/components/marketplace/BannerAd";
import ImportProgressBanner from "@/components/ImportProgressBanner";
import TapsonAssistant from "@/components/TapsonAssistant";
import { useUnreadChats } from "@/hooks/useUnreadChats";
import logo from "@/assets/pubstore-logo.png";
import { useStatusBarSync } from "@/hooks/useStatusBarSync";

let shellNotifChannelNonce = 0;

const makeShellNotifChannelName = (uid: string) => `shell-notif:${uid}:${++shellNotifChannelNonce}`;

export default function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const { cartCount, wishlist } = useShop();
  const { chatsWithUnread } = useUnreadChats();
  const location = useLocation();
  useStatusBarSync();
  
  

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
      .channel(makeShellNotifChannelName(uid))
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
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col overflow-x-clip">
      {/* Top bar — solid, elevated */}
      <header className="sticky top-0 z-40 bg-background safe-top shadow-[0_8px_32px_-8px_hsl(0_0%_0%_/_0.18),0_2px_8px_-2px_hsl(0_0%_0%_/_0.10)]">
        <div className="max-w-2xl mx-auto px-3 pt-1.5 pb-2 flex flex-col gap-2">
          {/* Row 1: brand + Tapson + action icons */}
          <div className="h-10 flex items-center gap-2">
            <RailDrawer />
            <Link to="/home" className="flex items-center gap-1.5 min-w-0 mr-auto active:opacity-70 transition" aria-label="PUBSTORE home">
              <img src={logo} alt="" className="w-7 h-7 shrink-0" />
              <span className="font-brand text-[18px] tracking-[0.02em] leading-none truncate">PUBSTORE</span>
            </Link>



            <button
              onClick={() => window.dispatchEvent(new Event("tapson:open"))}
              aria-label="Ask Tapson"
              className="shrink-0 flex items-center gap-1 h-8 pl-1.5 pr-2.5 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-pop active:scale-95 transition"
            >
              <span className="w-5 h-5 rounded-full bg-background/25 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-3 h-3" strokeWidth={2.6} />
              </span>
              <span className="text-[11px] font-bold tracking-tight">Tapson</span>
            </button>

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

          {/* Row 2: full-width search */}
          <div className="flex items-center gap-1 min-w-0 h-9 rounded-lg bg-background border-2 border-[hsl(24_100%_56%)] pl-2 pr-1 shadow-[0_1px_0_hsl(24_100%_56%/0.15)]">
            <Link
              to="/search"
              className="flex-1 flex items-center gap-1.5 min-w-0 active:opacity-70 transition"
              aria-label="Search products"
            >
              <Search className="w-4 h-4 shrink-0 text-[hsl(24_100%_56%)]" strokeWidth={2.6} />
              <RotatingHint className="text-[12px] font-semibold text-foreground/70 truncate" />
            </Link>
            <Link
              to="/search?mode=image"
              aria-label="Search by image"
              className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition border-l border-border/60"
            >
              <Camera className="w-[18px] h-[18px]" strokeWidth={2.2} />
            </Link>
            <Link
              to="/search"
              aria-label="Search"
              className="shrink-0 h-7 px-3 rounded-md bg-[hsl(24_100%_56%)] text-white text-[11px] font-bold flex items-center active:scale-95 transition"
            >
              Search
            </Link>
          </div>

          {location.pathname === "/home" && <HomeFeedTabs />}
        </div>

        <ScrollProgress />
      </header>


      <main
        className="flex-1 max-w-2xl w-full mx-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
      >
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>

      {/* Floating glass liquid nav — bottom, horizontal */}
      <nav
        className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 pointer-events-none w-[min(100%-1rem,28rem)]"
        aria-label="Primary"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="pointer-events-auto relative rounded-[28px] p-1.5
                     bg-background/40 backdrop-blur-2xl backdrop-saturate-150
                     border border-white/20 dark:border-white/10
                     shadow-[0_20px_60px_-12px_hsl(0_0%_0%_/_0.35),0_8px_24px_-8px_hsl(0_0%_0%_/_0.25),inset_0_1px_0_hsl(0_0%_100%_/_0.4)]
                     before:content-[''] before:absolute before:inset-0 before:rounded-[28px]
                     before:bg-gradient-to-b before:from-white/30 before:via-transparent before:to-white/10
                     before:pointer-events-none before:opacity-60
                     after:content-[''] after:absolute after:-inset-px after:rounded-[28px]
                     after:bg-gradient-to-br after:from-[hsl(24_100%_56%/0.25)] after:via-transparent after:to-primary/20
                     after:blur-xl after:-z-10 after:pointer-events-none"
        >
          <ul className="relative flex flex-row items-stretch gap-0.5">
            <TabItem to="/home" icon={House} label="Home" />
            <TabItem to="/categories" icon={ShoppingBag} label="Shop" />
            <TabItem to="/messages" icon={MessageCircle} label="Chats" badge={chatsWithUnread} />
            <TabItem to="/wishlist" icon={Heart} label="Saved" badge={wishlist.length} />
            <TabItem to="/profile" icon={CircleUser} label="You" />
          </ul>
        </div>
      </nav>

      <TapsonAssistant />
      <LiveActivityToaster />
      <NativeSuggestionToaster />
      <ActiveRideMonitor />
      {(location.pathname === "/home" || location.pathname === "/categories") && <BannerAd />}
      <ImportProgressBanner />
      <InstallPrompt />
    </div>
  );
}

function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div className="h-[2px] w-full bg-transparent overflow-hidden" aria-hidden>
      <div
        className="h-full bg-gradient-to-r from-[hsl(24_100%_56%)] via-primary to-[hsl(24_100%_56%)] transition-[width] duration-75 ease-out"
        style={{ width: `${pct}%` }}
      />
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
        className="flex flex-col items-center justify-center gap-1 h-full select-none"
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span className="relative flex items-center justify-center h-6 w-6">
              <Icon
                className={`w-[22px] h-[22px] ${isActive ? "text-[hsl(24_100%_56%)]" : "text-foreground/60"}`}
                strokeWidth={isActive ? 2.4 : 2}
              />
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-none tracking-tight ${
                isActive ? "text-[hsl(24_100%_56%)] font-semibold" : "text-foreground/60 font-medium"
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

type RailItem = { to: string; label: string; icon: typeof Home; hint: string };
const RAIL_SECTIONS: { title: string; items: RailItem[] }[] = [
  {
    title: "Commerce",
    items: [
      { to: "/categories", label: "Marketplace", icon: Store, hint: "Shop everything" },
      { to: "/industrial", label: "Industrial", icon: Factory, hint: "B2B & wholesale" },
      { to: "/logistics", label: "Logistics", icon: Truck, hint: "Ship & deliver" },
    ],
  },
  {
    title: "Mobility",
    items: [
      { to: "/rides", label: "Rides", icon: Navigation, hint: "Book a trip" },
      { to: "/auto", label: "Auto", icon: Car, hint: "Buy vehicles" },
      { to: "/car-rentals", label: "Car Rentals", icon: Car, hint: "Rent by the day" },
    ],
  },
  {
    title: "Living",
    items: [
      { to: "/properties", label: "Properties", icon: Building2, hint: "Buy & let" },
      { to: "/stays", label: "Stays", icon: Hotel, hint: "Hotels & rentals" },
      { to: "/services", label: "Services", icon: Wrench, hint: "Hire a pro" },
    ],
  },
  {
    title: "Work & Money",
    items: [
      { to: "/jobs", label: "Jobs", icon: Briefcase, hint: "Find work" },
      { to: "/finance", label: "Finance", icon: Landmark, hint: "Loans & wallet" },
      { to: "/news", label: "News", icon: Newspaper, hint: "Today's stories" },
    ],
  },
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
        className="w-[88vw] max-w-sm p-0 border-r border-border/60 bg-background flex flex-col"
      >
        {/* Editorial brand header */}
        <div className="relative px-6 pt-7 pb-6 border-b border-border/60 bg-[linear-gradient(180deg,hsl(var(--muted)/0.4),transparent)]">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-background ring-1 ring-border/80 shadow-sm flex items-center justify-center">
              <img src={logo} alt="PUBSTORE" className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <p className="font-brand text-[22px] tracking-[0.02em] leading-none">PUBSTORE</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 tracking-wide">
                The everything marketplace
              </p>
            </div>
          </div>
          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
            Directory
          </p>
        </div>

        {/* Sectioned list */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {RAIL_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4 last:mb-2">
              <p className="px-5 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/90">
                {section.title}
              </p>
              <ul className="px-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition active:scale-[0.99] ${
                            isActive
                              ? "bg-primary/10 text-foreground"
                              : "hover:bg-muted/70"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ring-1 transition ${
                                isActive
                                  ? "bg-primary text-primary-foreground ring-primary/40 shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.6)]"
                                  : "bg-muted/60 text-foreground/80 ring-border/60 group-hover:bg-background"
                              }`}
                            >
                              <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[14px] font-semibold tracking-tight leading-tight">
                                {item.label}
                              </span>
                              <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                                {item.hint}
                              </span>
                            </span>
                            <span
                              aria-hidden
                              className={`text-muted-foreground/50 text-lg leading-none transition ${
                                isActive ? "text-primary translate-x-0.5" : "group-hover:translate-x-0.5"
                              }`}
                            >
                              ›
                            </span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Signature footer */}
        <div className="border-t border-border/60 px-6 py-4 bg-muted/20">
          <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground/80 text-center">
            A signature creation by
          </p>
          <p className="font-brand text-[15px] tracking-[0.14em] text-center mt-1.5 bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
            KUKISTACKSGROUP
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HomeFeedTabs() {
  const [params, setParams] = useSearchParams();
  const active = (params.get("feed") as "home" | "fyp" | "following") || "home";
  const TABS: { id: "home" | "fyp" | "following"; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "fyp", label: "For you" },
    { id: "following", label: "Following" },
  ];
  return (
    <div role="tablist" className="flex items-center gap-3 mr-auto min-w-0 overflow-x-auto no-scrollbar">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (t.id === "home") next.delete("feed");
              else next.set("feed", t.id);
              setParams(next, { replace: true });
            }}
            className={`relative shrink-0 text-[13px] font-bold leading-none py-1 transition-colors ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
            <span
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-[hsl(24_100%_56%)] transition-all ${
                isActive ? "w-5 opacity-100" : "w-0 opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

