import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, Mail, Smartphone, Store, Radio, Package, MessageCircle,
  FileText, TrendingDown, RefreshCcw, Sparkles, Heart, Newspaper, AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getPushState, subscribeToPush, unsubscribeFromPush, isPushSupported } from "@/lib/push";
import CircleSpinner from "@/components/CircleSpinner";

type Prefs = {
  inapp_followed_supplier_new_product: boolean;
  inapp_followed_supplier_live: boolean;
  inapp_orders: boolean;
  inapp_messages: boolean;
  inapp_rfq: boolean;
  inapp_wishlist_price_drop: boolean;
  inapp_wishlist_restock: boolean;
  push_followed_supplier_new_product: boolean;
  push_followed_supplier_live: boolean;
  push_orders: boolean;
  push_messages: boolean;
  push_rfq: boolean;
  push_wishlist_price_drop: boolean;
  push_wishlist_restock: boolean;
  email_welcome: boolean;
  email_onboarding: boolean;
  email_new_product_followed: boolean;
  email_orders: boolean;
  email_rfq: boolean;
  email_weekly_digest: boolean;
};

const ROWS: { key: keyof Prefs; label: string; icon: LucideIcon; channel: "inapp" | "push" | "email" }[] = [
  // In-app
  { key: "inapp_followed_supplier_new_product", label: "New product from a supplier I follow", icon: Store, channel: "inapp" },
  { key: "inapp_followed_supplier_live",       label: "A supplier I follow goes live",        icon: Radio, channel: "inapp" },
  { key: "inapp_orders",                       label: "Order updates",                        icon: Package, channel: "inapp" },
  { key: "inapp_messages",                     label: "New chat messages",                    icon: MessageCircle, channel: "inapp" },
  { key: "inapp_rfq",                          label: "RFQ quotes received",                  icon: FileText, channel: "inapp" },
  { key: "inapp_wishlist_price_drop",          label: "Price drops on my wishlist",           icon: TrendingDown, channel: "inapp" },
  { key: "inapp_wishlist_restock",             label: "Wishlist items back in stock",         icon: RefreshCcw, channel: "inapp" },
  // Push
  { key: "push_followed_supplier_new_product", label: "New product from a supplier I follow", icon: Store, channel: "push" },
  { key: "push_followed_supplier_live",        label: "A supplier I follow goes live",        icon: Radio, channel: "push" },
  { key: "push_orders",                        label: "Order updates",                        icon: Package, channel: "push" },
  { key: "push_messages",                      label: "New chat messages",                    icon: MessageCircle, channel: "push" },
  { key: "push_rfq",                           label: "RFQ quotes received",                  icon: FileText, channel: "push" },
  { key: "push_wishlist_price_drop",           label: "Price drops on my wishlist",           icon: TrendingDown, channel: "push" },
  { key: "push_wishlist_restock",              label: "Wishlist items back in stock",         icon: RefreshCcw, channel: "push" },
  // Email
  { key: "email_welcome",                      label: "Welcome email when I sign up",         icon: Sparkles, channel: "email" },
  { key: "email_onboarding",                   label: "Onboarding tips",                      icon: Heart, channel: "email" },
  { key: "email_new_product_followed",         label: "New product from suppliers I follow",  icon: Store, channel: "email" },
  { key: "email_orders",                       label: "Order & delivery updates",             icon: Package, channel: "email" },
  { key: "email_rfq",                          label: "RFQ quotes & supplier replies",        icon: FileText, channel: "email" },
  { key: "email_weekly_digest",                label: "Weekly recommendations digest",        icon: Newspaper, channel: "email" },
];

export default function NotificationPreferences() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState<{ supported: boolean; permission: string; subscribed: boolean }>({
    supported: false, permission: "default", subscribed: false,
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("notification_preferences").select("*")
        .eq("user_id", user.id).maybeSingle();
      if (data) setPrefs(data as unknown as Prefs);
      else {
        // Backstop in case the trigger missed somehow
        const { data: created } = await supabase
          .from("notification_preferences").insert({ user_id: user.id })
          .select("*").single();
        if (created) setPrefs(created as unknown as Prefs);
      }
      setPushState(await getPushState());
      setLoading(false);
    })();
  }, [navigate]);

  const update = async (key: keyof Prefs, value: boolean) => {
    if (!userId || !prefs) return;
    setPrefs({ ...prefs, [key]: value });
    setSaving(key);
    const patch: Record<string, boolean> = { [key as string]: value };
    const { error } = await supabase
      .from("notification_preferences")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("user_id", userId);
    setSaving(null);
    if (error) toast.error("Couldn't save", { description: error.message });
  };

  const enablePush = async () => {
    const res = await subscribeToPush();
    if (res.ok) {
      toast.success("Notifications enabled on this device");
      setPushState(await getPushState());
    } else {
      toast.error("Couldn't enable push", { description: res.reason });
    }
  };

  const disablePush = async () => {
    await unsubscribeFromPush();
    toast("Notifications disabled on this device");
    setPushState(await getPushState());
  };

  const inappRows = ROWS.filter((r) => r.channel === "inapp");
  const pushRows = ROWS.filter((r) => r.channel === "push");
  const emailRows = ROWS.filter((r) => r.channel === "email");

  return (
    <div className="">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b px-3 py-3 flex items-center gap-2">
        <Link to="/settings" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-bold text-lg flex-1">Notifications</h1>
      </header>

      {loading || !prefs ? (
        <p className="text-center text-sm text-muted-foreground py-16"><CircleSpinner size={28} /></p>
      ) : (
        <div className="px-4 py-4 space-y-5">
          {/* Native push enable card */}
          <div className="rounded-2xl border bg-card shadow-card p-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Notifications on this device</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {pushState.iosNeedsInstall
                    ? "On iPhone, push notifications only work after you install PUBSTORE. Tap the Share icon in Safari, then 'Add to Home Screen', and open the app from its new icon."
                    : !pushState.supported
                      ? "Your browser doesn't support push notifications."
                      : pushState.permission === "denied"
                        ? "You blocked notifications in your browser. Re-enable them in browser settings to receive push."
                        : pushState.subscribed
                          ? "You'll receive push notifications even when PUBSTORE is closed."
                          : "Get a buzz when a supplier you follow drops a new product, when your order ships, and more."}
                </p>
                <div className="mt-3">
                  {pushState.iosNeedsInstall ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><AlertCircle className="w-3.5 h-3.5" /> Install required on iPhone</span>
                  ) : !pushState.supported ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><AlertCircle className="w-3.5 h-3.5" /> Unsupported</span>
                  ) : pushState.subscribed ? (
                    <Button size="sm" variant="outline" onClick={disablePush}>Disable on this device</Button>
                  ) : (
                    <Button size="sm" onClick={enablePush} disabled={pushState.permission === "denied"}>
                      Enable push notifications
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Section title="In-app" subtitle="Show in your bell icon" icon={Bell}>
            {inappRows.map((r) => (
              <Row key={r.key} icon={r.icon} label={r.label}
                checked={prefs[r.key]} saving={saving === r.key}
                onChange={(v) => update(r.key, v)} />
            ))}
          </Section>

          <Section title="Push" subtitle="Sent to your device" icon={Smartphone}>
            {pushRows.map((r) => (
              <Row key={r.key} icon={r.icon} label={r.label}
                checked={prefs[r.key] && pushState.subscribed} saving={saving === r.key}
                disabled={!pushState.subscribed}
                onChange={(v) => update(r.key, v)} />
            ))}
            {!pushState.subscribed && (
              <p className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/30">
                Enable push above to use these toggles.
              </p>
            )}
          </Section>

          <Section title="Email" subtitle="Sent to your inbox" icon={Mail}>
            {emailRows.map((r) => (
              <Row key={r.key} icon={r.icon} label={r.label}
                checked={prefs[r.key]} saving={saving === r.key}
                onChange={(v) => update(r.key, v)} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-1 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className="text-[10px] text-muted-foreground">· {subtitle}</span>
      </div>
      <div className="bg-card rounded-2xl border shadow-card divide-y overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, checked, onChange, saving, disabled }: { icon: LucideIcon; label: string; checked: boolean; onChange: (v: boolean) => void; saving?: boolean; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${disabled ? "opacity-50" : ""}`}>
      <span className="w-9 h-9 rounded-xl bg-muted text-foreground/70 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <p className="text-sm font-semibold flex-1">{label}</p>
      {saving && <span className="text-[10px] text-muted-foreground">saving…</span>}
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
