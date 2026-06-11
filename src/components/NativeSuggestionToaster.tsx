import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, BedDouble, Wrench, Car, Briefcase, Sparkles, ChevronRight } from "lucide-react";
import logo from "@/assets/pubstore-logo.png";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const isNative = Capacitor.isNativePlatform?.() ?? false;

let nativePermissionReady: Promise<boolean> | null = null;
async function ensureNativePermission(): Promise<boolean> {
  if (!isNative) return false;
  if (!nativePermissionReady) {
    nativePermissionReady = (async () => {
      try {
        const cur = await LocalNotifications.checkPermissions();
        if (cur.display === "granted") return true;
        const req = await LocalNotifications.requestPermissions();
        return req.display === "granted";
      } catch {
        return false;
      }
    })();
  }
  return nativePermissionReady;
}

async function showNativeNotification(s: Suggestion) {
  try {
    const ok = await ensureNativePermission();
    if (!ok) return false;
    const meta = KIND_META[s.kind];
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title: `PUBSTORE · ${meta.label}`,
          body: s.subtitle ? `${s.title} — ${s.subtitle}` : s.title,
          schedule: { at: new Date(Date.now() + 500) },
          smallIcon: "ic_stat_icon_config_sample",
          largeIcon: s.image || undefined,
          extra: { url: s.link },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

type Suggestion = {
  kind: "product" | "stay" | "service" | "rental" | "job";
  title: string;
  subtitle?: string;
  image?: string | null;
  link: string;
  badge?: string;
};

const KIND_META: Record<Suggestion["kind"], { label: string; Icon: typeof ShoppingBag; tint: string }> = {
  product: { label: "Marketplace", Icon: ShoppingBag, tint: "from-blue-500 to-indigo-600" },
  stay:    { label: "Stays",       Icon: BedDouble,   tint: "from-pink-500 to-rose-600" },
  service: { label: "Services",    Icon: Wrench,      tint: "from-purple-500 to-fuchsia-600" },
  rental:  { label: "Car rental",  Icon: Car,         tint: "from-cyan-500 to-blue-600" },
  job:     { label: "Jobs",        Icon: Briefcase,   tint: "from-emerald-500 to-teal-600" },
};

async function pickSuggestion(): Promise<Suggestion | null> {
  // Weighted random over kinds
  const pool: Suggestion["kind"][] = ["product", "product", "product", "stay", "service", "rental", "job"];
  const kind = pool[Math.floor(Math.random() * pool.length)];

  try {
    if (kind === "product") {
      const { data } = await supabase
        .from("products").select("id,title,price,image,gallery")
        .eq("active", true).limit(40);
      if (!data?.length) return null;
      const p: any = data[Math.floor(Math.random() * data.length)];
      const img = p.image || (Array.isArray(p.gallery) ? p.gallery[0] : null);
      return { kind, title: p.title, subtitle: `$${Number(p.price).toFixed(2)}`, image: img, link: `/product/${p.id}`, badge: "Trending" };
    }
    if (kind === "stay") {
      const { data } = await supabase
        .from("properties").select("id,title,price,currency,cover,city,country").eq("active", true).limit(40);
      if (!data?.length) return null;
      const p: any = data[Math.floor(Math.random() * data.length)];
      return { kind, title: p.title, subtitle: [p.city, p.country].filter(Boolean).join(", ") || `${p.currency} ${p.price}`, image: p.cover, link: `/properties`, badge: "Stay tonight" };
    }
    if (kind === "service") {
      const { data } = await supabase
        .from("service_providers").select("id,display_name,category,city,cover").eq("active", true).limit(40);
      if (!data?.length) return null;
      const s: any = data[Math.floor(Math.random() * data.length)];
      return { kind, title: s.display_name, subtitle: [s.category, s.city].filter(Boolean).join(" · "), image: s.cover, link: `/services`, badge: "Pro near you" };
    }
    if (kind === "rental") {
      const { data } = await supabase
        .from("car_rentals").select("id,title,price_per_day,currency,cover,city").eq("active", true).limit(40);
      if (!data?.length) return null;
      const r: any = data[Math.floor(Math.random() * data.length)];
      return { kind, title: r.title, subtitle: `${r.currency || "$"}${r.price_per_day}/day${r.city ? " · " + r.city : ""}`, image: r.cover, link: `/car-rentals`, badge: "Drive away" };
    }
    if (kind === "job") {
      const { data } = await supabase
        .from("job_postings").select("id,title,location,salary_min,salary_max,currency").limit(40);
      if (!data?.length) return null;
      const j: any = data[Math.floor(Math.random() * data.length)];
      const sal = j.salary_min ? `${j.currency || "$"}${j.salary_min}+` : "Apply now";
      return { kind, title: j.title, subtitle: `${j.location || ""} · ${sal}`, image: null, link: `/jobs/${j.id}`, badge: "Hiring" };
    }
  } catch {
    return null;
  }
  return null;
}

function showSuggestion(s: Suggestion, navigate: (to: string) => void) {
  const meta = KIND_META[s.kind];
  const Icon = meta.Icon;
  toast.custom(
    (id) => (
      <button
        onClick={() => { toast.dismiss(id); navigate(s.link); }}
        className="w-full flex items-stretch gap-3 p-2.5 rounded-2xl bg-background/95 backdrop-blur-xl border border-border/60 shadow-[0_12px_32px_-10px_hsl(0_0%_0%/0.35)] active:scale-[0.98] transition text-left"
      >
        <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${meta.tint} overflow-hidden shrink-0 flex items-center justify-center`}>
          {s.image ? (
            <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Icon className="w-6 h-6 text-white" strokeWidth={2.2} />
          )}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-background flex items-center justify-center shadow-card">
            <img src={logo} alt="" className="w-4 h-4" />
          </span>
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PUBSTORE · {meta.label}</span>
            {s.badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/12 text-primary">{s.badge}</span>
            )}
          </div>
          <p className="text-[14px] font-semibold leading-tight line-clamp-1 mt-0.5">{s.title}</p>
          {s.subtitle && <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5">{s.subtitle}</p>}
        </div>
        <span className="self-center w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>
    ),
    { duration: 6500, position: "top-center", unstyled: true, className: "!w-[calc(100vw-24px)] !max-w-sm !left-1/2 !-translate-x-1/2" }
  );
}

export default function NativeSuggestionToaster() {
  const navRef = useRef<(to: string) => void>((to) => { window.location.href = to; });

  useEffect(() => {
    let mounted = true;

    // Pre-warm native permission so OS-level notifications can show on lock screen.
    ensureNativePermission();

    // Handle taps on the OS notification → navigate inside the app.
    let clickHandle: { remove: () => Promise<void> } | null = null;
    if (isNative) {
      LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
        const url = (e.notification?.extra as { url?: string } | undefined)?.url;
        if (url) navRef.current(url);
      }).then((h) => { clickHandle = h; }).catch(() => {});
    }

    const fire = async () => {
      const s = await pickSuggestion();
      if (!s) return;
      // On native, prefer OS-level notification (lock screen + notification center).
      // Fallback to in-app toast if the app is foregrounded and permission denied.
      const native = await showNativeNotification(s);
      if (!native) showSuggestion(s, navRef.current);
    };

    // Welcome ping shortly after mount
    const welcomeTimer = window.setTimeout(async () => {
      if (!mounted) return;
      const s = await pickSuggestion();
      if (s) {
        const native = await showNativeNotification(s);
        if (!native) showSuggestion(s, navRef.current);
      } else {
        toast("Welcome back to PUBSTORE", {
          description: "Fresh deals waiting for you",
          icon: <Sparkles className="w-4 h-4 text-primary" />,
        });
      }
    }, 8000);

    // Periodic suggestions — fire even if tab/app is backgrounded on native
    const interval = window.setInterval(() => {
      if (!mounted) return;
      if (!isNative && document.hidden) return;
      fire();
    }, 110_000);

    return () => {
      mounted = false;
      clearTimeout(welcomeTimer);
      clearInterval(interval);
      clickHandle?.remove().catch(() => {});
    };
  }, []);

  return null;
}
