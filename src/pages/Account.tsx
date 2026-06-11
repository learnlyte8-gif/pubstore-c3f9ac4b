import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package, MapPin, CreditCard, Heart, MessageCircle, Store, Settings, HelpCircle, Shield, ShieldCheck, LogOut, ChevronRight,
  Wallet, Plus, ArrowUpRight, Sparkles, Pencil, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useShop } from "@/store/shop";
import { useWallet } from "@/hooks/useWallet";
import { useMyTier } from "@/hooks/useUserTier";
import TierBadge from "@/components/TierBadge";

type Profile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  address: string | null;
  contact: string | null;
};

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("buyer");
  const [isGuest, setIsGuest] = useState(false);
  const { wishlist, cartCount } = useShop();
  const { balance, transactions } = useWallet();
  const { info: tierInfo } = useMyTier();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsGuest(true);
        return;
      }
      setIsGuest(false);
      setEmail(session.user.email ?? "");

      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("display_name, username, avatar_url, address, contact").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (p) setProfile(p);
      if (r) setRole(r.role);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const initials = (profile?.display_name || profile?.username || email || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const lastTx = transactions[0];

  // ============== GUEST VIEW ==============
  if (isGuest) {
    return (
      <div className="px-4 pt-8 pb-12 max-w-md mx-auto">
        <div className="bg-card rounded-2xl border border-border shadow-card p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold mb-1">You're browsing as a guest</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Sign in to save your wishlist across devices, place orders, message suppliers and earn rewards.
          </p>
          <Button
            className="w-full h-11"
            onClick={() => navigate(`/auth?redirect=${encodeURIComponent("/account")}`)}
          >
            Sign in or create account
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-center">
          <Link to="/wishlist" className="bg-card rounded-2xl border border-border shadow-card p-4">
            <p className="text-xl font-black tabular-nums">{wishlist.length}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Wishlist</p>
          </Link>
          <Link to="/cart" className="bg-card rounded-2xl border border-border shadow-card p-4">
            <p className="text-xl font-black tabular-nums">{cartCount}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Cart</p>
          </Link>
        </div>

        <div className="mt-6 space-y-1">
          <Link to="/help" className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-muted/40 transition">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-semibold flex-1">Help center</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/settings" className="flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-muted/40 transition">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-semibold flex-1">Settings</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="pb-8">
      {/* ============== HERO HEADER ============== */}
      <div className="relative overflow-hidden">
        {/* Layered gradient + soft orbs */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-primary/60" />
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary-foreground/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-accent/30 blur-3xl" />

        <div className="relative px-4 pt-6  text-primary-foreground">
          {/* Profile row */}
          <div className="flex items-center gap-3.5">
            <div className="relative">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary-foreground/40 shadow-elevated" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center text-xl font-black tracking-tight ring-2 ring-primary-foreground/40 shadow-elevated">
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-primary shadow-soft" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-black text-lg leading-tight tracking-tight truncate">
                  {profile?.display_name || profile?.username || "Welcome"}
                </p>
                {role === "supplier" && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider">
                    Pro
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-80 truncate">{email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-primary-foreground/15 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
                  {role}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-primary-foreground/15 backdrop-blur text-[10px] font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Member
                </span>
              </div>
            </div>

            <Link to="/onboarding" aria-label="Edit profile"
              className="w-9 h-9 rounded-full bg-primary-foreground/15 backdrop-blur flex items-center justify-center hover:bg-primary-foreground/25 transition shadow-soft">
              <Pencil className="w-4 h-4" />
            </Link>
          </div>

          {/* PUBSTORE Pay banner */}
          <div className="mt-5 rounded-2xl bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 p-3.5 shadow-elevated">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">PUBSTORE Pay</p>
              </div>
              <Link to="/wallet" className="text-[11px] font-bold opacity-90 hover:opacity-100 flex items-center gap-0.5">
                Activity <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] opacity-75 uppercase tracking-wider">Balance</p>
                <p className="text-3xl font-black tracking-tighter leading-none mt-0.5 tabular-nums">{fmt(balance)}</p>
                {lastTx && (
                  <p className="text-[10px] opacity-70 mt-1.5 truncate max-w-[180px]">
                    Last: {lastTx.kind} {fmt(Math.abs(Number(lastTx.amount)))}
                  </p>
                )}
              </div>
              <Link to="/wallet"
                className="h-9 px-3.5 rounded-full bg-primary-foreground text-primary font-bold text-xs flex items-center gap-1.5 shadow-card hover:scale-[1.02] transition">
                <Plus className="w-3.5 h-3.5" strokeWidth={3} /> Top up
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats card overlapping the header */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="bg-card rounded-2xl border border-border shadow-elevated grid grid-cols-3 divide-x divide-border">
          <Stat label="Orders" value={0} to="/orders" />
          <Stat label="Wishlist" value={wishlist.length} to="/wishlist" />
          <Stat label="Cart" value={cartCount} to="/cart" />
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 mt-6 space-y-4">
        <Section title="My Orders">
          <Row icon={Package} label="All orders" hint="Track and manage" to="/orders" />
          <Row icon={Heart} label="Wishlist" hint={`${wishlist.length} saved`} to="/wishlist" />
          <Row icon={MessageCircle} label="Messages" hint="Chat with suppliers" to="/messages" />
        </Section>

        <Section title="Account">
          <Row icon={Wallet} label="PUBSTORE Pay" hint={`${fmt(balance)} available`} to="/wallet" />
          <Row icon={MapPin} label="Addresses" hint={profile?.address || "Add address"} to="/addresses" />
          <Row icon={CreditCard} label="Payment methods" hint="Cards, wallets" to="/payment-methods" />
          <Row icon={ShieldCheck} label="Identity verification" hint="Required for Cash on delivery" to="/verification" />
          <Row icon={Store} label={role === "supplier" ? "My store" : "Become a supplier"} hint="Sell on PUBSTORE" to={role === "supplier" ? "/store" : "/become-supplier"} />
        </Section>

        <Section title="Support">
          <Row icon={HelpCircle} label="Help center" hint="FAQs, contact us" to="/help" />
          <Row icon={Shield} label="Privacy & security" hint="Manage your data" to="/privacy" />
          <Row icon={Settings} label="Settings" hint="Notifications, language" to="/settings" />
        </Section>

        <Button variant="outline" className="w-full h-12 shadow-card" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>

        <p className="text-center text-[11px] text-muted-foreground pt-2">PUBSTORE · v1.0</p>
      </div>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="py-4 text-center hover:bg-muted/40 transition first:rounded-l-2xl last:rounded-r-2xl">
      <p className="text-xl font-black tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</p>
      <div className="bg-card rounded-2xl border border-border shadow-card divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, hint, to }: { icon: LucideIcon; label: string; hint?: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-soft">
        <Icon className="w-4.5 h-4.5" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}
