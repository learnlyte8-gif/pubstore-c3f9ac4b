import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store, Package, BarChart3, Megaphone, Truck, Star, Plus, ShoppingBag, Video, MessageCircle, Settings, ChevronRight, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchMySupplier, fetchProducts } from "@/data/products";
import EmptyState from "@/components/EmptyState";

export default function MyStore() {
  const navigate = useNavigate();
  const { data: supplier, isLoading } = useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });
  const { data: myProducts = [] } = useQuery({
    queryKey: ["my-products", supplier?.id],
    queryFn: () => (supplier ? fetchProducts({ supplierId: supplier.id, limit: 6 }) : Promise.resolve([])),
    enabled: !!supplier,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>;

  if (!supplier) {
    return (
      <div className="pt-12">
        <EmptyState
          icon={<Store className="w-7 h-7 text-muted-foreground" />}
          title="You don't have a store yet"
          description="Create your supplier store to start listing products and selling on PUBSTORE."
          action={<Button asChild><Link to="/become-supplier"><Plus className="w-4 h-4 mr-1.5" /> Create my store</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="relative h-44 bg-muted">
        {supplier.banner && supplier.banner !== "/placeholder.svg" && (
          <img src={supplier.banner} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3 text-background">
          <div className="w-16 h-16 rounded-2xl bg-card ring-2 ring-background shadow-elevated flex items-center justify-center overflow-hidden">
            {supplier.logo && supplier.logo !== "/placeholder.svg" ? (
              <img src={supplier.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{supplier.name}</p>
            <p className="text-[11px] opacity-90 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-background/20 backdrop-blur">{supplier.verified ? "Verified" : "New seller"}</span>
              {supplier.country && <span>· {supplier.country}</span>}
            </p>
          </div>
          <Link to="/store/profile" className="px-3 py-1.5 rounded-full bg-background/20 backdrop-blur text-xs font-bold">Edit</Link>
        </div>
      </div>

      <div className="px-4 -mt-6 grid grid-cols-2 gap-3">
        <Stat label="Products" value={String(myProducts.length)} icon={Package} />
        <Stat label="Rating" value={supplier.rating ? supplier.rating.toFixed(1) : "—"} icon={Star} />
      </div>

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
              <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><q.icon className="w-4 h-4" /></span>
              <span className="text-[10px] font-semibold text-center leading-tight">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6 space-y-4">
        <Section title="Manage">
          <Row icon={Package} label="Products" hint={`${myProducts.length} listed`} to="/store/products" />
          <Row icon={ShoppingBag} label="Orders" hint="View store orders" to="/store/orders" />
          <Row icon={Truck} label="Shipping & logistics" hint="Templates, carriers" to="/store/shipping" />
          <Row icon={MessageCircle} label="Customer messages" hint="Buyer chats" to="/messages" />
        </Section>

        <Section title="Grow">
          <Row icon={Megaphone} label="Promotions & coupons" hint="Boost sales" to="/store/promote" />
          <Row icon={BarChart3} label="Analytics & insights" hint="Traffic, conversion" to="/store/analytics" />
          <Row icon={Star} label="Reviews" hint="Buyer feedback" to="/store/reviews" />
        </Section>

        <Section title="Storefront">
          <Row icon={Store} label="Store profile" hint="Banner, logo, about" to="/store/profile" />
          <Row icon={Settings} label="Store settings" hint="Payouts, taxes" to="/store/settings" />
        </Section>

        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">My products</p>
            <Link to="/store/products" className="text-xs font-bold text-primary">See all</Link>
          </div>
          {myProducts.length === 0 ? (
            <EmptyState
              title="No products yet"
              action={<Button asChild size="sm"><Link to="/store/products/new"><Plus className="w-4 h-4 mr-1.5" /> Add product</Link></Button>}
            />
          ) : (
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
          )}
        </div>

        <Button asChild className="w-full h-12 shadow-elevated">
          <Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add new product</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-card rounded-2xl border shadow-elevated p-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      </div>
      <p className="text-xl font-bold mt-1.5">{value}</p>
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
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}
