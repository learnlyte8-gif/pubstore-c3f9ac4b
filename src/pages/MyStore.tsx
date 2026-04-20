import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store, Package, BarChart3, Megaphone, Truck, Star, Plus, Eye, ShoppingBag, TrendingUp, Video, MessageCircle, Settings, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SUPPLIERS as suppliers, PRODUCTS as products } from "@/data/products";

export default function MyStore() {
  const navigate = useNavigate();
  const [name, setName] = useState("My Store");
  const supplier = suppliers[0];
  const myProducts = products.slice(0, 6);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: p } = await supabase.from("profiles").select("display_name, username").eq("user_id", session.user.id).maybeSingle();
      if (p) setName(p.display_name || p.username || "My Store");
    })();
  }, [navigate]);

  const stats = [
    { label: "Visitors", value: "2.4k", trend: "+12%", icon: Eye },
    { label: "Orders", value: "184", trend: "+8%", icon: ShoppingBag },
    { label: "Revenue", value: "$12.8k", trend: "+24%", icon: TrendingUp },
    { label: "Rating", value: "4.9", trend: "★ 312", icon: Star },
  ];

  return (
    <div className="pb-8">
      {/* Banner */}
      <div className="relative h-44">
        <img src={supplier.banner} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3 text-background">
          <img src={supplier.logo} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-background shadow-elevated" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{name}</p>
            <p className="text-[11px] opacity-90 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-background/20 backdrop-blur">Verified</span>
              <span>· Active 2h ago</span>
            </p>
          </div>
          <Link to="/profile" className="px-3 py-1.5 rounded-full bg-background/20 backdrop-blur text-xs font-bold">Edit</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border shadow-elevated p-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><s.icon className="w-4 h-4" /></span>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{s.label}</p>
            </div>
            <p className="text-xl font-bold mt-1.5">{s.value}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Quick actions</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Plus, label: "Add product", to: "/store/products/new" },
            { icon: Video, label: "Go live", to: "/live" },
            { icon: Megaphone, label: "Promote", to: "/store/promote" },
            { icon: BarChart3, label: "Analytics", to: "/store/analytics" },
          ].map((q) => (
            <Link key={q.label} to={q.to} className="bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card hover:shadow-elevated transition">
              <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><q.icon className="w-4.5 h-4.5" /></span>
              <span className="text-[10px] font-semibold text-center leading-tight">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Manage */}
      <div className="px-4 mt-6 space-y-4">
        <Section title="Manage">
          <Row icon={Package} label="Products" hint={`${myProducts.length} listed`} to="/store/products" />
          <Row icon={ShoppingBag} label="Orders" hint="6 pending" to="/store/orders" />
          <Row icon={Truck} label="Shipping & logistics" hint="Templates, carriers" to="/store/shipping" />
          <Row icon={MessageCircle} label="Customer messages" hint="3 unread" to="/messages" />
        </Section>

        <Section title="Grow">
          <Row icon={Megaphone} label="Promotions & coupons" hint="Boost sales" to="/store/promote" />
          <Row icon={BarChart3} label="Analytics & insights" hint="Traffic, conversion" to="/store/analytics" />
          <Row icon={Star} label="Reviews" hint="312 total · 4.9★" to="/store/reviews" />
        </Section>

        <Section title="Storefront">
          <Row icon={Store} label="Store profile" hint="Banner, logo, about" to="/store/profile" />
          <Row icon={Settings} label="Store settings" hint="Payouts, taxes" to="/store/settings" />
        </Section>

        {/* Recent products */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">My products</p>
            <Link to="/store/products" className="text-xs font-bold text-primary">See all</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {myProducts.slice(0, 6).map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="aspect-square rounded-xl overflow-hidden bg-muted relative shadow-card">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/80 to-transparent p-1.5">
                  <p className="text-[10px] font-bold text-background truncate">${p.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <Button asChild className="w-full h-12 shadow-elevated">
          <Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add new product</Link>
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</p>
      <div className="bg-card rounded-2xl border shadow-card divide-y overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, hint, to }: { icon: any; label: string; hint?: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}
