import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMySupplier } from "@/data/products";
import { consoleNavGroups, labelForPath, type ConsoleNavItem } from "@/components/store/consoleNav";
import { ChevronRight, ChevronDown, X, Search, Store, PanelLeftClose, PanelLeft, Plus, Bell, HelpCircle } from "lucide-react";

type Tab = { key: string; path: string; label: string };

const TAB_STORAGE_KEY = "pubstore.console.tabs";

/**
 * Google Cloud-console style shell for all /store screens (desktop only).
 * Mobile keeps the existing native app layout — the shell is transparent there.
 */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true));
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    setDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

export default function ConsoleShell() {
  const isDesktop = useIsDesktop();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setEmail((session?.user?.email || "").toLowerCase() || null));
  }, []);

  const { data: supplier } = useQuery({ queryKey: ["my-supplier-console"], queryFn: fetchMySupplier });

  const isAdmin = email === "kukistacks8@gmail.com";
  const offers = (supplier as any)?.verticals as string[] | undefined;
  const groups = useMemo(
    () =>
      consoleNavGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => {
            if (i.adminOnly && !isAdmin) return false;
            if (i.slug && offers && offers.length > 0 && !offers.includes(i.slug)) return false;
            return true;
          }),
        }))
        .filter((g) => g.items.length > 0),
    [isAdmin, offers]
  );

  // ---------- tab strip ----------
  const currentKey = `${location.pathname}${location.search}`;
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Tab[];
    } catch { /* ignore */ }
    return [];
  });
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTabs((prev) => {
      if (prev.some((t) => t.key === currentKey)) return prev;
      const next = [...prev, { key: currentKey, path: currentKey, label: labelForPath(location.pathname, location.search) }];
      return next.slice(-10);
    });
  }, [currentKey, location.pathname, location.search]);

  useEffect(() => {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs)); } catch { /* ignore */ }
  }, [tabs]);

  const closeTab = (key: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      const next = prev.filter((t) => t.key !== key);
      if (key === currentKey) {
        const fallback = next[Math.max(0, idx - 1)];
        navigate(fallback ? fallback.path : "/store");
      }
      return next;
    });
  };

  const activeLabel = labelForPath(location.pathname, location.search);
  const activeGroup = groups.find((g) => g.items.some((i) => isItemActive(i, location.pathname, location.search)));

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const all = groups.flatMap((g) => g.items);
    const hit = all.find((i) => i.label.toLowerCase().includes(q));
    if (hit) { navigate(hit.to); setQuery(""); }
  };

  if (!isDesktop) return <Outlet />;

  return createPortal(
    (
      <div className="fixed inset-0 z-[60] flex flex-col bg-muted/40">
        {/* Top app bar */}
        <header className="h-14 shrink-0 bg-card border-b flex items-center gap-3 px-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
          </button>
          <Link to="/store" className="flex items-center gap-2 pr-2">
            <span className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center"><Store className="w-4 h-4" /></span>
            <span className="text-[17px] tracking-tight"><span className="font-semibold">PUBSTORE</span> <span className="text-muted-foreground">Console</span></span>
          </Link>

          {/* store selector */}
          <Link
            to="/store/profile"
            className="h-8 max-w-[240px] px-3 rounded-md border bg-background hover:bg-muted flex items-center gap-2 text-[13px] font-medium"
          >
            <span className="truncate">{supplier?.name ?? "My store"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </Link>

          <form onSubmit={onSearch} className="flex-1 max-w-[560px] relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search console (products, orders, analytics…)"
              className="w-full h-9 rounded-md bg-muted/70 border border-transparent focus:bg-background focus:border-input outline-none pl-9 pr-3 text-[13px]"
            />
          </form>

          <div className="ml-auto flex items-center gap-1">
            <Link to="/help" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"><HelpCircle className="w-[18px] h-[18px]" /></Link>
            <Link to="/notifications" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"><Bell className="w-[18px] h-[18px]" /></Link>
            <Link to="/account" className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold uppercase">
              {(supplier?.name || email || "P").slice(0, 1)}
            </Link>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Left rail */}
          <aside className={`${collapsed ? "w-[68px]" : "w-[256px]"} shrink-0 bg-card border-r overflow-y-auto transition-[width] duration-150`}>
            <nav className="py-2">
              {groups.map((g) => (
                <div key={g.title} className="pb-1">
                  {!collapsed && (
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-5 pt-3 pb-1">{g.title}</p>
                  )}
                  {collapsed && <div className="h-px bg-border mx-3 my-2" />}
                  {g.items.map((i) => {
                    const active = isItemActive(i, location.pathname, location.search);
                    return (
                      <div key={i.label} className="group/row relative flex items-center">
                        <Link
                          to={i.to}
                          title={i.label}
                          className={`flex items-center gap-3 flex-1 min-w-0 h-9 pl-4 pr-2 rounded-r-full transition ${
                            active ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted"
                          }`}
                        >
                          <i.icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          {!collapsed && <span className="text-[13px] truncate">{i.label}</span>}
                        </Link>
                        {!collapsed && i.manageTo && (
                          <Link
                            to={i.manageTo}
                            className="mr-2 shrink-0 px-2 h-6 rounded-full text-[10px] font-semibold text-muted-foreground hover:bg-muted opacity-0 group-hover/row:opacity-100 transition flex items-center"
                          >
                            Actions
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {!collapsed && (
                <Link to="/store/profile?step=verticals" className="flex items-center gap-2 h-9 pl-4 mt-2 text-[13px] text-primary hover:bg-muted rounded-r-full">
                  <Plus className="w-[18px] h-[18px]" /> Change what you provide
                </Link>
              )}
            </nav>
          </aside>

          {/* Content column */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Breadcrumb */}
            <div className="h-11 shrink-0 bg-card border-b flex items-center px-5 gap-1.5 text-[13px] text-muted-foreground">
              <Link to="/store" className="hover:text-foreground">Console</Link>
              {activeGroup && <><ChevronRight className="w-3.5 h-3.5" /><span>{activeGroup.title}</span></>}
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{activeLabel}</span>
            </div>

            {/* Tab strip */}
            <div ref={stripRef} className="h-10 shrink-0 bg-card border-b flex items-stretch px-2 overflow-x-auto no-scrollbar">
              {tabs.map((t) => {
                const active = t.key === currentKey;
                return (
                  <div
                    key={t.key}
                    className={`group/tab relative flex items-center gap-2 pl-3 pr-2 max-w-[220px] border-b-2 ${
                      active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <button onClick={() => navigate(t.path)} className="text-[13px] font-medium truncate py-2">{t.label}</button>
                    <button
                      onClick={() => closeTab(t.key)}
                      aria-label={`Close ${t.label}`}
                      className="w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <main className="flex-1 min-h-0 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    ),
    document.body
  );
}

function isItemActive(i: ConsoleNavItem, pathname: string, search: string) {
  if (i.manageTo && `${pathname}${search}` === i.manageTo) return true;
  if (i.to === "/store") return pathname === "/store";
  return pathname === i.to || pathname.startsWith(`${i.to}/`);
}
