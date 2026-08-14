import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { adminNavGroups, adminLabelForSection } from "@/components/admin/adminNav";
import { ChevronRight, X, Search, ShieldCheck, PanelLeftClose, PanelLeft, Bell, HelpCircle, ArrowLeft } from "lucide-react";

type Tab = { key: string; path: string; label: string };

const TAB_STORAGE_KEY = "pubstore.admin.tabs";

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

function sectionOf(pathname: string) {
  return pathname.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
}

/** Google Cloud console-style shell for /admin (desktop only). */
export default function AdminConsoleShell() {
  const isDesktop = useIsDesktop();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setEmail(session?.user?.email ?? null));
  }, []);

  const section = sectionOf(location.pathname);
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
      return [...prev, { key: currentKey, path: currentKey, label: adminLabelForSection(sectionOf(location.pathname)) }].slice(-10);
    });
  }, [currentKey, location.pathname]);

  useEffect(() => {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tabs)); } catch { /* ignore */ }
  }, [tabs]);

  const closeTab = (key: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      const next = prev.filter((t) => t.key !== key);
      if (key === currentKey) {
        const fallback = next[Math.max(0, idx - 1)];
        navigate(fallback ? fallback.path : "/admin");
      }
      return next;
    });
  };

  const activeGroup = useMemo(
    () => adminNavGroups.find((g) => g.items.some((i) => i.section === section)),
    [section]
  );
  const activeLabel = adminLabelForSection(section);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = adminNavGroups.flatMap((g) => g.items).find((i) => i.label.toLowerCase().includes(q));
    if (hit) { navigate(hit.section ? `/admin/${hit.section}` : "/admin"); setQuery(""); }
  };

  if (!isDesktop) return <Outlet />;

  return createPortal(
    (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        <header className="h-14 shrink-0 bg-card border-b flex items-center gap-3 px-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
          </button>
          <Link to="/admin" className="flex items-center gap-2 pr-2">
            <span className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>
            <span className="text-[17px] tracking-tight"><span className="font-semibold">PUBSTORE</span> <span className="text-muted-foreground">Admin</span></span>
          </Link>

          <form onSubmit={onSearch} className="flex-1 max-w-[560px] relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search admin (verification, withdrawals, reports…)"
              className="w-full h-9 rounded-md bg-muted/70 border border-transparent focus:bg-background focus:border-input outline-none pl-9 pr-3 text-[13px]"
            />
          </form>

          <div className="ml-auto flex items-center gap-1">
            <Link to="/store" className="h-8 px-3 rounded-md border bg-background hover:bg-muted flex items-center gap-1.5 text-[13px] font-medium">
              <ArrowLeft className="w-3.5 h-3.5" /> Store console
            </Link>
            <Link to="/help" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"><HelpCircle className="w-[18px] h-[18px]" /></Link>
            <Link to="/notifications" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"><Bell className="w-[18px] h-[18px]" /></Link>
            <Link to="/account" className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold uppercase">
              {(email || "A").slice(0, 1)}
            </Link>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <aside className={`${collapsed ? "w-[68px]" : "w-[256px]"} shrink-0 bg-card border-r overflow-y-auto transition-[width] duration-150`}>
            <nav className="py-2">
              {adminNavGroups.map((g) => (
                <div key={g.title} className="pb-1">
                  {!collapsed
                    ? <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-5 pt-3 pb-1">{g.title}</p>
                    : <div className="h-px bg-border mx-3 my-2" />}
                  {g.items.map((i) => {
                    const active = i.section === section;
                    return (
                      <Link
                        key={i.label}
                        to={i.section ? `/admin/${i.section}` : "/admin"}
                        title={i.label}
                        className={`flex items-center gap-3 h-9 pl-4 pr-2 rounded-r-full transition ${
                          active ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted"
                        }`}
                      >
                        <i.icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        {!collapsed && <span className="text-[13px] truncate">{i.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="h-11 shrink-0 bg-card border-b flex items-center px-5 gap-1.5 text-[13px] text-muted-foreground">
              <Link to="/admin" className="hover:text-foreground">Admin</Link>
              {activeGroup && <><ChevronRight className="w-3.5 h-3.5" /><span>{activeGroup.title}</span></>}
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{activeLabel}</span>
            </div>

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

            <main className="flex-1 min-h-0 overflow-y-auto bg-muted/40">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    ),
    document.body
  );
}
