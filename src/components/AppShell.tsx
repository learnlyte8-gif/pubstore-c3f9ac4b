import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useCategories } from "@/hooks/useCatalog";
import { Search, Bell, Navigation, Menu, Store, Briefcase, Wrench, Building2, Car, Landmark, Factory, Newspaper, Hotel, Truck, X, Home, Sparkles, Camera, ShoppingCart } from "lucide-react";
import { IoHome, IoHomeOutline, IoBagHandle, IoBagHandleOutline, IoChatbubble, IoChatbubbleOutline, IoHeart, IoHeartOutline, IoPerson, IoPersonOutline } from "react-icons/io5";
import type { IconType } from "react-icons";
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
import { useMyTier, type Tier } from "@/hooks/useUserTier";

const TIER_HSL: Record<Tier, string> = {
  bronze: "30 65% 45%",
  silver: "215 16% 65%",
  gold: "43 96% 56%",
};

let shellNotifChannelNonce = 0;

const makeShellNotifChannelName = (uid: string) => `shell-notif:${uid}:${++shellNotifChannelNonce}`;

export default function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const { cartCount, wishlist } = useShop();
  const { chatsWithUnread } = useUnreadChats();
  const location = useLocation();
  useStatusBarSync();
  const { info: tierInfo } = useMyTier();
  const tier: Tier = tierInfo?.buyer_tier ?? "bronze";
  const tierHsl = TIER_HSL[tier];
  const headerGradient = `linear-gradient(135deg, hsl(var(--primary) / 0.14) 0%, hsl(var(--background)) 45%, hsl(${tierHsl} / 0.22) 100%)`;
  
  

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
      <header className="sticky top-0 z-40 bg-background safe-top shadow-[0_8px_32px_-8px_hsl(0_0%_0%_/_0.18),0_2px_8px_-2px_hsl(0_0%_0%_/_0.10)]" style={{ background: headerGradient }}>
        <div className="max-w-2xl mx-auto px-3 pt-1.5 pb-2 flex flex-col gap-2" data-tier={tier}>
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
        style={{ paddingBottom: "64px" }}
      >
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — flush to bottom edge, iOS-style icons */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border"
        aria-label="Primary"
      >
        <ul className="relative flex flex-row items-stretch gap-0.5 max-w-2xl mx-auto px-1 h-[56px]">
          <TabItem to="/home" iconOutline={IoHomeOutline} iconFilled={IoHome} label="Home" />
          <TabItem to="/categories" iconOutline={IoBagHandleOutline} iconFilled={IoBagHandle} label="Shop" />
          <TabItem to="/messages" iconOutline={IoChatbubbleOutline} iconFilled={IoChatbubble} label="Chats" badge={chatsWithUnread} />
          <TabItem to="/wishlist" iconOutline={IoHeartOutline} iconFilled={IoHeart} label="Saved" badge={wishlist.length} />
          <TabItem to="/profile" iconOutline={IoPersonOutline} iconFilled={IoPerson} label="You" />
        </ul>
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
  iconOutline: IconOutline,
  iconFilled: IconFilled,
  label,
  badge,
}: {
  to: string;
  iconOutline: IconType;
  iconFilled: IconType;
  label: string;
  badge?: number;
}) {
  return (
    <li className="flex-1 min-w-0">
      <NavLink
        to={to}
        className="flex flex-col items-center justify-center gap-0.5 h-full select-none"
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span className="relative flex items-center justify-center h-7 w-7">
              {isActive ? (
                <IconFilled className="w-[26px] h-[26px] text-[hsl(24_100%_56%)]" />
              ) : (
                <IconOutline className="w-[26px] h-[26px] text-foreground/55" />
              )}
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] leading-none tracking-tight ${
                isActive ? "text-[hsl(24_100%_56%)] font-semibold" : "text-foreground/55 font-medium"
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
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const activeFeed = (params.get("feed") as "home" | "fyp" | "following") || "home";
  const activeCat = params.get("cat");
  const active = activeCat ? `cat:${activeCat}` : activeFeed;

  const BASE_TABS = [
    { id: "home", label: "Home" },
    { id: "fyp", label: "For you" },
    { id: "following", label: "Following" },
  ] as const;

  const TABS = [
    ...BASE_TABS.map((t) => ({ id: t.id as string, label: t.label, kind: "feed" as const })),
    ...categories.map((c) => ({ id: `cat:${c.id}`, label: c.name, kind: "cat" as const, slug: c.id })),
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = btnRefs.current[active];
    const parent = containerRef.current;
    if (!el || !parent) return;
    const update = () => {
      const elRect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      setIndicator({
        left: elRect.left - parentRect.left + parent.scrollLeft,
        width: elRect.width,
      });
    };
    update();
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(parent);
    window.addEventListener("resize", update);
    parent.addEventListener("scroll", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      parent.removeEventListener("scroll", update);
    };
  }, [active, categories.length]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className="relative flex items-center gap-4 mr-auto min-w-0 overflow-x-auto scrollbar-none"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => { btnRefs.current[t.id] = el; }}
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (t.kind === "cat") {
                navigate(`/categories?cat=${encodeURIComponent(t.slug)}`);
                return;
              }
              const next = new URLSearchParams(params);
              next.delete("cat");
              if (t.id === "home") next.delete("feed");
              else next.set("feed", t.id);
              setParams(next, { replace: true });
            }}
            className={`relative shrink-0 text-[13px] font-bold leading-none py-1.5 whitespace-nowrap transition-colors ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-[3px] rounded-full bg-[hsl(24_100%_56%)] transition-[transform,width] duration-300 ease-out"
        style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
      />
    </div>
  );
}



