import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package, MapPin, CreditCard, Heart, MessageCircle, Store, Settings, HelpCircle, Shield, LogOut, ChevronRight, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useShop } from "@/store/shop";

type Profile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  address: string | null;
  contact: string | null;
};

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("buyer");
  const { wishlist, cartCount } = useShop();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
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

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/70 px-4 pt-6 pb-12 text-primary-foreground relative shadow-elevated">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-primary-foreground/30 shadow-card" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-foreground/20 backdrop-blur flex items-center justify-center text-xl font-bold ring-4 ring-primary-foreground/30 shadow-card">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{profile?.display_name || profile?.username || "Welcome"}</p>
            <p className="text-xs opacity-85 truncate">{email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary-foreground/20 text-[10px] font-semibold uppercase tracking-wider">
              {role}
            </span>
          </div>
          <Link to="/onboarding" className="px-3 py-1.5 rounded-full bg-primary-foreground/20 text-xs font-semibold backdrop-blur hover:bg-primary-foreground/30 transition shadow-soft">
            Edit
          </Link>
        </div>
      </div>

      {/* Stats card overlapping the header */}
      <div className="px-4 -mt-8">
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
          <Row icon={MapPin} label="Addresses" hint={profile?.address || "Add address"} to="/profile" />
          <Row icon={CreditCard} label="Payment methods" hint="Cards, wallets" to="/profile" />
          <Row icon={Store} label={role === "supplier" ? "My store" : "Become a supplier"} hint="Sell on PUBSTORE" to="/profile" />
        </Section>

        <Section title="Support">
          <Row icon={HelpCircle} label="Help center" hint="FAQs, contact us" to="/profile" />
          <Row icon={Shield} label="Privacy & security" hint="Manage your data" to="/profile" />
          <Row icon={Settings} label="Settings" hint="Notifications, language" to="/profile" />
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
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
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
