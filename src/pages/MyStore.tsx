import { useEffect, useState } from "react";
import CircleSpinner from "@/components/CircleSpinner";
import { Link, useNavigate } from "react-router-dom";
import { Store, Package, BarChart3, Megaphone, Truck, Star, Plus, ShoppingBag, Video, MessageCircle, Settings, ChevronRight, ImagePlus, Radio, StopCircle, Download, BedDouble, Car, Factory, Newspaper, Sparkles, Navigation, Wrench, Home as HomeIcon, Banknote, Lock, Sprout, Inbox, UtensilsCrossed, Crown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMySupplier, fetchProducts } from "@/data/products";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import SupplierOnboarding, { buildOnboardingSteps, isOnboardingComplete, OnboardingBlockedBanner } from "@/components/SupplierOnboarding";
import { useVerification } from "@/hooks/useVerification";
import BackButton from "@/components/BackButton";
import { usePlanFeature } from "@/components/store/PlanGate";

type NavItem = { icon: any; label: string; hint?: string; to: string; manageTo?: string };

export default function MyStore() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined); // undefined = unknown
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setUserEmail((session?.user?.email || "").toLowerCase() || null);
      if (!session) navigate("/auth?redirect=/store");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail((session?.user?.email || "").toLowerCase() || null);
      qc.invalidateQueries({ queryKey: ["my-supplier"] });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate, qc]);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["my-supplier", userId],
    queryFn: fetchMySupplier,
    enabled: !!userId,
  });
  const { status: verificationStatus, loading: verificationLoading } = useVerification();
  const onboardingSteps = buildOnboardingSteps(supplier ?? null, verificationStatus);
  const onboardingReady = !isLoading && !verificationLoading && !!supplier;
  const canPublish = isOnboardingComplete(onboardingSteps);
  const { data: myProducts = [] } = useQuery({
    queryKey: ["my-products", supplier?.id],
    queryFn: () => (supplier ? fetchProducts({ supplierId: supplier.id, limit: 12 }) : Promise.resolve([])),
    enabled: !!supplier,
  });

  const { data: stats } = useQuery({
    queryKey: ["my-store-stats", supplier?.id],
    queryFn: async () => {
      if (!supplier) return { orderCount: 0, revenue: 0, pendingOrders: 0 };
      const { data: orders } = await supabase
        .from("orders")
        .select("total,status")
        .eq("supplier_id", supplier.id);
      const list = orders ?? [];
      return {
        orderCount: list.length,
        revenue: list.reduce((s, o) => s + Number(o.total || 0), 0),
        pendingOrders: list.filter((o) => o.status === "placed" || o.status === "processing").length,
      };
    },
    enabled: !!supplier,
  });

  const { data: liveStream } = useQuery({
    queryKey: ["my-live-stream", supplier?.id],
    queryFn: async () => {
      if (!supplier) return null;
      const { data } = await supabase
        .from("live_streams")
        .select("*")
        .eq("supplier_id", supplier.id)
        .eq("status", "live")
        .maybeSingle();
      return data;
    },
    enabled: !!supplier,
  });

  const [showGoLive, setShowGoLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [starting, setStarting] = useState(false);

  const canImport = userEmail === "kukistacks8@gmail.com";
  const { allowed: canLive } = usePlanFeature("live_selling");

  const startStream = async () => {
    if (!supplier) return;
    if (!canLive) { toast.error("Live selling requires the Pro or Elite plan"); navigate("/store/plans"); return; }
    if (!streamTitle.trim()) { toast.error("Add a stream title"); return; }
    setStarting(true);
    const cover = myProducts[0]?.image || supplier.banner || null;
    const { data, error } = await supabase
      .from("live_streams")
      .insert({
        supplier_id: supplier.id,
        title: streamTitle.trim(),
        cover,
        status: "live",
        viewer_count: 0,
      })
      .select()
      .single();
    setStarting(false);
    if (error) { toast.error(error.message); return; }
    setShowGoLive(false);
    setStreamTitle("");
    qc.invalidateQueries({ queryKey: ["my-live-stream"] });
    navigate(`/live/${data.id}`);
  };

  const endStream = async () => {
    if (!liveStream) return;
    const { error } = await supabase
      .from("live_streams")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", liveStream.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stream ended");
    qc.invalidateQueries({ queryKey: ["my-live-stream"] });
  };

  if (userId === undefined || (userId && isLoading)) return <div className="p-8 text-center text-muted-foreground text-sm"><CircleSpinner size={28} /></div>;

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

  // ---- Navigation model (shared between mobile list and desktop dashboard) ----
  const manageItems: NavItem[] = [
    { icon: Package, label: "Products", hint: `${myProducts.length} listed`, to: "/store/products" },
    ...(canImport ? [{ icon: Download, label: "Import from the web", hint: "Alibaba, Amazon, Shopify · beta", to: "/store/import" }] : []),
    { icon: ShoppingBag, label: "Orders", hint: stats?.pendingOrders ? `${stats.pendingOrders} pending` : "View store orders", to: "/store/orders" },
    { icon: Inbox, label: "Actions inbox", hint: "Bookings, RFQs, applications across all services", to: "/store/actions" },
    { icon: Truck, label: "Shipping & logistics", hint: "Templates, carriers", to: "/store/shipping" },
    { icon: MessageCircle, label: "Customer messages", hint: "Buyer chats", to: "/messages" },
  ];

  const growItems: NavItem[] = [
    { icon: Megaphone, label: "PUBSTORE Ads", hint: "Banner, feed, full-screen & rewarded reels", to: "/store/ads" },
    { icon: Megaphone, label: "Promotions & coupons", hint: "Boost sales", to: "/store/promote" },
    { icon: BarChart3, label: "Analytics & insights", hint: "Traffic, conversion", to: "/store/analytics" },
    { icon: Star, label: "Reviews", hint: "Buyer feedback", to: "/store/reviews" },
  ];

  const storefrontItems: NavItem[] = [
    { icon: Crown, label: "Selling plan & commission", hint: "Plan tiers, commission rate, listing limits", to: "/store/plans" },
    { icon: Store, label: "Store profile", hint: "Banner, logo, about", to: "/store/profile" },
    { icon: Settings, label: "Store settings", hint: "Payouts, taxes", to: "/store/settings" },
  ];

  const offers = (supplier as any)?.verticals as string[] | undefined;
  const wants = (slug: string) => !offers || offers.length === 0 || offers.includes(slug);
  const verticalRows: { slug: string; item: NavItem }[] = [
    { slug: "restaurants", item: { icon: UtensilsCrossed, label: "Restaurants & food", hint: "Menus, delivery, table reservations", to: "/restaurants", manageTo: "/restaurants" } },
    { slug: "agro", item: { icon: Sprout, label: "Agro listings", hint: "Produce, machinery, inputs, livestock, projects", to: "/store/services/agro", manageTo: "/store/services/agro?tab=actions" } },
    { slug: "stays", item: { icon: BedDouble, label: "Stays & B&B", hint: "List rooms, hotels, factory tours", to: "/store/services/stays", manageTo: "/store/services/stays?tab=actions" } },
    { slug: "vehicles", item: { icon: Car, label: "Vehicles", hint: "Cars, EVs, trucks, bikes, parts", to: "/store/services/vehicles", manageTo: "/store/services/vehicles?tab=actions" } },
    { slug: "industrial", item: { icon: Factory, label: "Industrial listings", hint: "Machinery, materials, capacity", to: "/store/services/industrial", manageTo: "/store/services/industrial?tab=actions" } },
    { slug: "rides", item: { icon: Navigation, label: "Ride driver", hint: "Register your car · earn driving passengers", to: "/store/services/driver", manageTo: "/store/services/driver?tab=actions" } },
    { slug: "services", item: { icon: Wrench, label: "Local services", hint: "Plumbing, electrical, tutoring, freelance", to: "/store/services/pros", manageTo: "/store/services/pros?tab=actions" } },
    { slug: "properties", item: { icon: HomeIcon, label: "Real estate", hint: "Rent or sell apartments, houses, land", to: "/store/services/properties", manageTo: "/store/services/properties?tab=actions" } },
    { slug: "shop", item: { icon: Truck, label: "Courier / logistics", hint: "Deliveries, freight, partner with suppliers", to: "/store/services/logistics", manageTo: "/store/services/logistics?tab=actions" } },
    { slug: "finance", item: { icon: Banknote, label: "Finance products", hint: "Loans, vehicle financing, insurance", to: "/store/services/finance", manageTo: "/store/services/finance?tab=actions" } },
    { slug: "car_rentals", item: { icon: Car, label: "Car rentals", hint: "Self-drive listings, mileage, rules & penalties", to: "/store/services/car-rentals", manageTo: "/store/services/car-rentals?tab=actions" } },
  ];
  const verticalItems: NavItem[] = [
    ...verticalRows.filter((r) => wants(r.slug)).map((r) => r.item),
    ...(canImport ? [{ icon: Newspaper, label: "News & editorial", hint: "Publish articles · admin", to: "/store/services/news", manageTo: "/store/services/news?tab=actions" } as NavItem] : []),
  ];

  const quickActions = (
    <>
      {canPublish ? (
        <Link to="/store/products/new" className="bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card hover:shadow-elevated transition">
          <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-4 h-4" /></span>
          <span className="text-[10px] font-semibold text-center leading-tight">Add product</span>
        </Link>
      ) : (
        <button
          onClick={() => toast.error("Finish supplier onboarding to publish products")}
          className="bg-muted/50 border border-dashed rounded-2xl p-3 flex flex-col items-center gap-1.5 opacity-70"
        >
          <span className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center"><Lock className="w-4 h-4" /></span>
          <span className="text-[10px] font-semibold text-center leading-tight">Add product</span>
        </button>
      )}
      {liveStream ? (
        <Link to={`/live/${liveStream.id}`} className="bg-destructive text-destructive-foreground rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card">
          <span className="w-9 h-9 rounded-xl bg-background/20 flex items-center justify-center"><Radio className="w-4 h-4 animate-pulse" /></span>
          <span className="text-[10px] font-semibold text-center leading-tight">Live now</span>
        </Link>
      ) : (
        <button
          onClick={() => (canLive ? setShowGoLive(true) : navigate("/store/plans"))}
          className={`rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card transition ${canLive ? "bg-card border hover:shadow-elevated" : "bg-muted/50 border border-dashed opacity-80"}`}
        >
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${canLive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {canLive ? <Video className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </span>
          <span className="text-[10px] font-semibold text-center leading-tight">{canLive ? "Go live" : "Go live · Pro"}</span>
        </button>
      )}
      <Link to="/store/promote" className="bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card hover:shadow-elevated transition">
        <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><Megaphone className="w-4 h-4" /></span>
        <span className="text-[10px] font-semibold text-center leading-tight">Promote</span>
      </Link>
      <Link to="/store/analytics" className="bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-card hover:shadow-elevated transition">
        <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><BarChart3 className="w-4 h-4" /></span>
        <span className="text-[10px] font-semibold text-center leading-tight">Analytics</span>
      </Link>
    </>
  );

  const goLiveModal = showGoLive && (
    <div className="fixed inset-0 z-50 bg-foreground/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowGoLive(false)}>
      <div className="w-full max-w-md bg-card rounded-3xl p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-9 h-9 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </span>
          <div>
            <p className="font-bold">Go live</p>
            <p className="text-[11px] text-muted-foreground">Start a live stream for your store</p>
          </div>
        </div>
        <input
          autoFocus
          value={streamTitle}
          onChange={(e) => setStreamTitle(e.target.value)}
          placeholder="Stream title (e.g. Factory tour, Q&A)"
          className="w-full h-12 rounded-xl border bg-background px-4 text-sm"
          onKeyDown={(e) => e.key === "Enter" && startStream()}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 h-11" onClick={() => setShowGoLive(false)}>Cancel</Button>
          <Button className="flex-1 h-11 bg-destructive hover:bg-destructive/90" onClick={startStream} disabled={starting}>
            {starting ? <><CircleSpinner size={16} className="mr-2" /> Starting…</> : <><Radio className="w-4 h-4 mr-2" /> Go live</>}
          </Button>
        </div>
      </div>
    </div>
  );

  const liveBanner = liveStream ? (
    <div className="rounded-2xl bg-destructive text-destructive-foreground p-3 flex items-center gap-3 shadow-elevated">
      <span className="w-9 h-9 rounded-full bg-background/20 flex items-center justify-center">
        <Radio className="w-4 h-4 animate-pulse" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider">You're live</p>
        <p className="text-sm font-bold truncate">{liveStream.title}</p>
      </div>
      <Link to={`/live/${liveStream.id}`} className="px-3 h-8 rounded-full bg-background/20 backdrop-blur text-xs font-bold flex items-center">Join</Link>
      <button onClick={endStream} className="px-3 h-8 rounded-full bg-background text-destructive text-xs font-bold flex items-center gap-1">
        <StopCircle className="w-3 h-3" /> End
      </button>
    </div>
  ) : null;

  return (
    <>
      {/* ================= MOBILE / TABLET ================= */}
      <div className="pb-8 lg:hidden">
        <div className="relative h-44 bg-muted">
          {supplier.banner && supplier.banner !== "/placeholder.svg" && (
            <img src={supplier.banner} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
          <BackButton iconOnly className="absolute top-3 left-3 z-10 bg-background/85 backdrop-blur shadow-card" />
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

        {liveBanner && <div className="mx-4 -mt-3 relative z-10">{liveBanner}</div>}

        {onboardingReady && <SupplierOnboarding steps={onboardingSteps} />}
        {onboardingReady && !canPublish && <OnboardingBlockedBanner steps={onboardingSteps} />}

        <div className="px-4 mt-5 grid grid-cols-3 gap-2">
          <Stat label="Products" value={String(myProducts.length)} icon={Package} />
          <Stat label="Orders" value={String(stats?.orderCount ?? 0)} icon={ShoppingBag} />
          <Stat label="Revenue" value={`$${(stats?.revenue ?? 0).toFixed(0)}`} icon={BarChart3} />
        </div>

        <div className="px-4 mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Quick actions</p>
          <div className="grid grid-cols-4 gap-2">{quickActions}</div>
        </div>

        <div className="px-4 mt-6 space-y-4">
          <Section title="Manage">{manageItems.map((i) => <Row key={i.label} {...i} />)}</Section>
          <Section title="Grow">{growItems.map((i) => <Row key={i.label} {...i} />)}</Section>
          <Section title="Services & verticals">
            {verticalItems.map((i) => <Row key={i.label} {...i} />)}
            <Link to="/store/profile?step=verticals" className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-primary hover:bg-muted/40 transition">
              <Sparkles className="w-4 h-4" /> Change what you provide
            </Link>
          </Section>
          <Section title="Storefront">{storefrontItems.map((i) => <Row key={i.label} {...i} />)}</Section>

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

          {canPublish ? (
            <Button asChild className="w-full h-12 shadow-elevated">
              <Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add new product</Link>
            </Button>
          ) : (
            <Button asChild className="w-full h-12 shadow-elevated" variant="outline">
              <Link to={onboardingSteps.find((s) => !s.done)?.to ?? "/store/profile"}>
                <Lock className="w-4 h-4 mr-2" /> Finish onboarding to publish
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ================= DESKTOP CONSOLE (inside ConsoleShell) ================= */}
      <div className="hidden lg:block">
        <div className="px-6 py-5 max-w-[1500px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-normal tracking-tight">Store dashboard</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Overview of your listings, orders and revenue.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-md" asChild>
                <Link to="/store/analytics"><BarChart3 className="w-4 h-4 mr-2" /> Analytics</Link>
              </Button>
              {canPublish ? (
                <Button size="sm" className="rounded-md" asChild><Link to="/store/products/new"><Plus className="w-4 h-4 mr-2" /> Add product</Link></Button>
              ) : (
                <Button size="sm" variant="outline" className="rounded-md" asChild>
                  <Link to={onboardingSteps.find((s) => !s.done)?.to ?? "/store/profile"}>
                    <Lock className="w-4 h-4 mr-2" /> Finish onboarding
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {liveBanner}

            <SupplierOnboarding steps={onboardingSteps} />
            {!canPublish && <OnboardingBlockedBanner steps={onboardingSteps} />}

            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="Products" value={String(myProducts.length)} icon={Package} hint="Live listings" />
              <KpiCard label="Orders" value={String(stats?.orderCount ?? 0)} icon={ShoppingBag} hint="All time" />
              <KpiCard label="Pending" value={String(stats?.pendingOrders ?? 0)} icon={Inbox} hint="Needs action" />
              <KpiCard label="Revenue" value={`$${(stats?.revenue ?? 0).toFixed(0)}`} icon={TrendingUp} hint="Gross sales" />
            </div>

            <section className="rounded-lg border bg-card">
              <div className="px-5 h-11 flex items-center border-b">
                <p className="text-[13px] font-medium">Quick actions</p>
              </div>
              <div className="p-5 grid grid-cols-6 gap-3">{quickActions}</div>
            </section>

            <section className="rounded-lg border bg-card">
              <div className="px-5 h-11 flex items-center justify-between border-b">
                <p className="text-[13px] font-medium">My products</p>
                <Link to="/store/products" className="text-[13px] text-primary hover:underline">View all</Link>
              </div>
              <div className="p-5">
                {myProducts.length === 0 ? (
                  <EmptyState
                    title="No products yet"
                    action={<Button asChild size="sm"><Link to="/store/products/new"><Plus className="w-4 h-4 mr-1.5" /> Add product</Link></Button>}
                  />
                ) : (
                  <div className="grid grid-cols-6 gap-3">
                    {myProducts.slice(0, 12).map((p) => (
                      <Link key={p.id} to={`/product/${p.id}`} className="group rounded-lg overflow-hidden border bg-background hover:shadow-card transition">
                        <div className="aspect-square bg-muted overflow-hidden">
                          <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        </div>
                        <div className="p-2">
                          <p className="text-[12px] truncate">{p.title}</p>
                          <p className="text-[12px] font-medium text-primary">${p.price}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>


      {goLiveModal}
    </>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-card rounded-2xl border shadow-elevated p-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-3.5 h-3.5" /></span>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      </div>
      <p className="text-lg font-bold mt-1.5 truncate">{value}</p>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, hint }: { label: string; value: string; icon: any; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card shadow-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
        <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
      </div>
      <p className="text-2xl font-bold mt-2 truncate">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
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

function Row({ icon: Icon, label, hint, to, manageTo }: NavItem) {
  return (
    <div className="flex items-center gap-2 pr-2 hover:bg-muted/40 transition">
      <Link to={to} className="flex items-center gap-3 px-4 py-3.5 flex-1 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
        </div>
      </Link>
      {manageTo && (
        <Link
          to={manageTo}
          className="shrink-0 px-2.5 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1"
        >
          <BarChart3 className="w-3 h-3" /> Actions
        </Link>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </div>
  );
}
