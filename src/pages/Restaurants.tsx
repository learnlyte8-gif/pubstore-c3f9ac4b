import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { UtensilsCrossed, Star, MapPin, Phone, Clock, Plus, Minus, X, ShoppingBag, CalendarDays, Filter, ChevronRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/components/EmptyState";
import MediaUpload from "@/components/MediaUpload";
import { fetchRestaurants, fetchRestaurant, fetchMenu, fetchMyRestaurants, CUISINES, type Restaurant, type MenuItem, type FoodOrderItem } from "@/data/restaurants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Restaurants() {
  const { id } = useParams();
  if (id) return <RestaurantDetail id={id} />;
  return <RestaurantsList />;
}

function priceLevel(n: number) {
  return "$".repeat(Math.max(1, Math.min(4, n)));
}

function RestaurantsList() {
  const [cuisine, setCuisine] = useState("");
  const [showOwner, setShowOwner] = useState(false);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["restaurants", cuisine],
    queryFn: () => fetchRestaurants({ cuisine: cuisine || undefined, limit: 60 }),
  });

  const { data: mine = [] } = useQuery({
    queryKey: ["my-restaurants"],
    queryFn: fetchMyRestaurants,
  });

  return (
    <div className="pb-8">
      <header className="px-4 pt-4 pb-3 bg-gradient-to-br from-rose-600 via-orange-500 to-amber-400 text-white">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-tight">Restaurants</h1>
            <p className="text-[11px] opacity-90">Order food, reserve a table, and discover local kitchens.</p>
          </div>
          <button
            onClick={() => setShowOwner(true)}
            className="px-3 h-9 rounded-full bg-white text-foreground text-[11px] font-bold flex items-center gap-1 shadow-card"
          >
            <Plus className="w-3.5 h-3.5" /> List yours
          </button>
        </div>
      </header>

      <div className="px-4 mt-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
          <button
            onClick={() => setCuisine("")}
            className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${cuisine === "" ? "bg-foreground text-background" : "bg-card"}`}
          >All</button>
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(c)}
              className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold border ${cuisine === c ? "bg-foreground text-background" : "bg-card"}`}
            >{c}</button>
          ))}
        </div>

        {mine.length > 0 && (
          <div className="mt-3 bg-card border rounded-2xl p-3 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Your restaurants</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {mine.map((r) => (
                <Link key={r.id} to={`/restaurants/${r.id}`} className="shrink-0 w-32 group">
                  <div className="aspect-video rounded-xl overflow-hidden bg-muted">
                    {r.cover && <img src={r.cover} alt={r.name} className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-[11px] font-bold mt-1 truncate">{r.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No restaurants yet"
            description="Be the first to list your restaurant and start taking orders."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {list.map((r) => (
              <Link key={r.id} to={`/restaurants/${r.id}`} className="bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition group">
                <div className="aspect-video bg-muted overflow-hidden relative">
                  {r.cover && <img src={r.cover} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
                  {r.delivery_enabled && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-background/90 backdrop-blur text-[9px] font-bold flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" /> Delivery
                    </span>
                  )}
                  {r.reservation_enabled && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-background/90 backdrop-blur text-[9px] font-bold flex items-center gap-1">
                      <CalendarDays className="w-2.5 h-2.5" /> Tables
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm leading-tight truncate">{r.name}</p>
                    <span className="text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {r.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {r.cuisine || "Restaurant"} · <span className="font-bold">{priceLevel(r.price_level)}</span>
                    {r.city ? ` · ${r.city}` : ""}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {r.prep_time_minutes} min</span>
                    {r.delivery_enabled && r.delivery_fee > 0 && (
                      <span>· ${r.delivery_fee.toFixed(2)} delivery</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <OwnerCreateDialog open={showOwner} onClose={() => setShowOwner(false)} />
    </div>
  );
}

function OwnerCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState(CUISINES[0]);
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [priceLvl, setPriceLvl] = useState(2);
  const [delivery, setDelivery] = useState(true);
  const [reservation, setReservation] = useState(true);
  const [media, setMedia] = useState<{ images: string[]; video: string | null }>({ images: [], video: null });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Add a name"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in first"); setBusy(false); return; }
    const { data, error } = await supabase.from("restaurants").insert({
      owner_user_id: user.id,
      name: name.trim(),
      cuisine,
      city: city || null,
      description: description || null,
      phone: phone || null,
      price_level: priceLvl,
      delivery_enabled: delivery,
      reservation_enabled: reservation,
      cover: media.images[0] || null,
      gallery: media.images,
      video_url: media.video,
    }).select("id").maybeSingle();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Restaurant created");
    qc.invalidateQueries({ queryKey: ["restaurants"] });
    qc.invalidateQueries({ queryKey: ["my-restaurants"] });
    onClose();
    if (data?.id) navigate(`/restaurants/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List your restaurant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mama Mia Pizzeria" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cuisine">
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm">
                {CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Price level">
              <select value={priceLvl} onChange={(e) => setPriceLvl(Number(e.target.value))} className="w-full h-11 rounded-xl border bg-background px-3 text-sm">
                <option value={1}>$ Cheap</option>
                <option value={2}>$$ Moderate</option>
                <option value={3}>$$$ Upscale</option>
                <option value={4}>$$$$ Fine dining</option>
              </select>
            </Field>
          </div>
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border bg-card cursor-pointer">
              <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
              <span className="text-xs font-bold">Delivery</span>
            </label>
            <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border bg-card cursor-pointer">
              <input type="checkbox" checked={reservation} onChange={(e) => setReservation(e.target.checked)} />
              <span className="text-xs font-bold">Reservations</span>
            </label>
          </div>
          <MediaUpload
            images={media.images}
            video={media.video}
            onChange={setMedia}
            folder="restaurants"
            hint="First photo becomes the cover · up to 6 photos · 1 video"
          />
          <Button onClick={submit} disabled={busy} className="w-full h-12">
            {busy ? "Creating…" : "Create restaurant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ============== DETAIL ==============

function RestaurantDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"menu" | "info" | "manage">("menu");
  const [cart, setCart] = useState<FoodOrderItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const { data: r } = useQuery({ queryKey: ["restaurant", id], queryFn: () => fetchRestaurant(id) });
  const { data: menu } = useQuery({ queryKey: ["menu", id], queryFn: () => fetchMenu(id) });
  const { data: currentUserId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const grouped = useMemo(() => {
    if (!menu) return [];
    const cats = menu.categories.length > 0 ? menu.categories : [{ id: "_all", restaurant_id: id, name: "Menu", sort_order: 0 }];
    return cats.map((c) => ({
      cat: c,
      items: menu.items.filter((i) => (c.id === "_all" ? true : i.category_id === c.id)),
    })).filter((g) => g.items.length > 0);
  }, [menu, id]);

  const addToCart = (m: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.menu_item_id === m.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }];
    });
    toast.success(`Added ${m.name}`);
  };

  if (!r) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const isOwner = !!r && !!currentUserId && r.owner_user_id === currentUserId;

  return (
    <div className="pb-24">
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {r.cover && <img src={r.cover} alt={r.name} className="w-full h-full object-cover" />}
        <button onClick={() => navigate("/restaurants")} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 -mt-8 relative">
        <div className="bg-card border rounded-2xl p-4 shadow-elevated">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">{r.name}</h1>
              <p className="text-xs text-muted-foreground">
                {r.cuisine || "Restaurant"} · <span className="font-bold">{priceLevel(r.price_level)}</span>
                {r.city ? ` · ${r.city}` : ""}
              </p>
            </div>
            <span className="text-xs font-bold flex items-center gap-0.5 shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {r.rating.toFixed(1)}
              <span className="text-muted-foreground">({r.review_count})</span>
            </span>
          </div>
          {r.description && <p className="text-xs mt-2">{r.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {r.delivery_enabled && <Badge icon={<Truck className="w-2.5 h-2.5" />}>Delivery ${r.delivery_fee.toFixed(2)}</Badge>}
            {r.reservation_enabled && <Badge icon={<CalendarDays className="w-2.5 h-2.5" />}>Reservations</Badge>}
            <Badge icon={<Clock className="w-2.5 h-2.5" />}>{r.prep_time_minutes} min</Badge>
            {r.phone && <a href={`tel:${r.phone}`}><Badge icon={<Phone className="w-2.5 h-2.5" />}>Call</Badge></a>}
            {r.address && <Badge icon={<MapPin className="w-2.5 h-2.5" />}>{r.address.slice(0, 24)}</Badge>}
          </div>
        </div>

        {r.video_url && (
          <div className="mt-3 rounded-2xl overflow-hidden border bg-black aspect-video">
            <video src={r.video_url} controls playsInline preload="metadata" className="w-full h-full object-cover" />
          </div>
        )}

        {r.gallery.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
            {r.gallery.map((g) => (
              <img key={g} src={g} alt="" className="h-24 rounded-xl object-cover shrink-0" />
            ))}
          </div>
        )}

        <div className="mt-4 flex bg-muted rounded-full p-1">
          {(["menu", "info", ...(isOwner ? (["manage"] as const) : [])] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-full text-xs font-bold transition capitalize ${tab === t ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "menu" && (
          <div className="mt-4 space-y-5">
            {grouped.length === 0 ? (
              <EmptyState title="No menu items yet" description="The restaurant hasn't added anything to its menu." />
            ) : grouped.map(({ cat, items }) => (
              <div key={cat.id}>
                <h2 className="text-sm font-bold mb-2">{cat.name}</h2>
                <div className="space-y-2">
                  {items.map((it) => (
                    <div key={it.id} className="flex gap-3 bg-card border rounded-2xl p-3 shadow-card">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm leading-tight">{it.name}</p>
                        {it.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{it.description}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-sm font-bold tabular-nums">${it.price.toFixed(2)}</span>
                          {it.vegetarian && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">VEG</span>}
                          {it.spicy && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700">SPICY</span>}
                        </div>
                      </div>
                      {it.image && (
                        <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                          <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <button
                        onClick={() => addToCart(it)}
                        className="self-center w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card shrink-0"
                        aria-label="Add to cart"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "info" && (
          <div className="mt-4 space-y-3 text-sm">
            {r.address && <Row icon={<MapPin className="w-4 h-4" />}>{r.address}{r.city ? `, ${r.city}` : ""}</Row>}
            {r.phone && <Row icon={<Phone className="w-4 h-4" />}><a href={`tel:${r.phone}`} className="text-primary">{r.phone}</a></Row>}
            <Row icon={<Clock className="w-4 h-4" />}>Avg prep time {r.prep_time_minutes} min</Row>
            {r.min_order > 0 && <Row icon={<ShoppingBag className="w-4 h-4" />}>Min order ${r.min_order.toFixed(2)}</Row>}
          </div>
        )}

        {tab === "manage" && (
          <OwnerManage restaurantId={id} onAddItem={() => setAddItemOpen(true)} />
        )}
      </div>

      {cartCount > 0 && tab === "menu" && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-24 left-4 right-4 z-50 h-12 rounded-full bg-foreground text-background flex items-center justify-between px-4 shadow-elevated"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShoppingBag className="w-4 h-4" /> {cartCount} item{cartCount > 1 ? "s" : ""}
          </span>
          <span className="text-sm font-bold tabular-nums">${cartTotal.toFixed(2)} · Checkout</span>
        </button>
      )}

      {r.reservation_enabled && tab === "info" && (
        <button
          onClick={() => setResOpen(true)}
          className="fixed bottom-24 left-4 right-4 z-50 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 shadow-elevated"
        >
          <CalendarDays className="w-4 h-4" /> Reserve a table
        </button>
      )}

      <CheckoutSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurant={r}
        items={cart}
        setItems={setCart}
      />
      <ReservationDialog open={resOpen} onClose={() => setResOpen(false)} restaurant={r} />
      <AddMenuItemDialog open={addItemOpen} onClose={() => setAddItemOpen(false)} restaurantId={id} />
    </div>
  );
}

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold">{icon}{children}</span>;
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-foreground">{icon}<span>{children}</span></div>;
}

function CheckoutSheet({ open, onClose, restaurant, items, setItems }: {
  open: boolean; onClose: () => void; restaurant: Restaurant;
  items: FoodOrderItem[]; setItems: (x: FoodOrderItem[]) => void;
}) {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const total = subtotal + (restaurant.delivery_enabled ? restaurant.delivery_fee : 0);

  const updateQty = (i: number, delta: number) => {
    const next = [...items];
    const newQty = next[i].qty + delta;
    if (newQty <= 0) next.splice(i, 1);
    else next[i] = { ...next[i], qty: newQty };
    setItems(next);
  };

  const submit = async () => {
    if (items.length === 0) { toast.error("Cart is empty"); return; }
    if (restaurant.min_order > 0 && subtotal < restaurant.min_order) {
      toast.error(`Minimum order is $${restaurant.min_order.toFixed(2)}`); return;
    }
    if (restaurant.delivery_enabled && !address.trim()) { toast.error("Delivery address required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in to order"); setBusy(false); return; }
    const ref = "FO-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const { data, error } = await supabase.from("food_orders").insert({
      buyer_id: user.id,
      restaurant_id: restaurant.id,
      items: items as unknown as never,
      subtotal,
      delivery_fee: restaurant.delivery_enabled ? restaurant.delivery_fee : 0,
      total,
      currency: "USD",
      status: "pending",
      delivery_address: address || null,
      contact_phone: phone || null,
      notes: notes || null,
      ref_code: ref,
    }).select("id").maybeSingle();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Order placed — restaurant will confirm shortly");
    setItems([]);
    onClose();
    navigate(`/orders?ref=${data?.id || ref}`);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Your order · {restaurant.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-3">
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Cart is empty</p>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={it.menu_item_id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground">${it.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(i, -1)} className="w-7 h-7 rounded-full bg-card border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    <span className="w-6 text-center text-sm font-bold">{it.qty}</span>
                    <button onClick={() => updateQty(i, 1)} className="w-7 h-7 rounded-full bg-card border flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  </div>
                  <span className="text-sm font-bold tabular-nums w-16 text-right">${(it.qty * it.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {restaurant.delivery_enabled && (
            <>
              <Field label="Delivery address *">
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, building, apt" className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
              </Field>
            </>
          )}
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span></div>
            {restaurant.delivery_enabled && restaurant.delivery_fee > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span className="tabular-nums">${restaurant.delivery_fee.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span className="tabular-nums">${total.toFixed(2)}</span></div>
          </div>

          <Button onClick={submit} disabled={busy || items.length === 0} className="w-full h-12">
            {busy ? "Placing order…" : "Place order"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReservationDialog({ open, onClose, restaurant }: { open: boolean; onClose: () => void; restaurant: Restaurant }) {
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!date) { toast.error("Pick a date"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in to reserve"); setBusy(false); return; }
    const reservedFor = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("table_reservations").insert({
      guest_id: user.id,
      restaurant_id: restaurant.id,
      party_size: partySize,
      reserved_for: reservedFor,
      contact_name: name || null,
      contact_phone: phone || null,
      notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reservation requested");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reserve at {restaurant.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Party">
              <input type="number" min={1} max={20} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
            </Field>
            <Field label="Time">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
            </Field>
          </div>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Special requests">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>
          <Button onClick={submit} disabled={busy} className="w-full h-12">
            {busy ? "Sending…" : "Request reservation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OwnerManage({ restaurantId, onAddItem }: { restaurantId: string; onAddItem: () => void }) {
  const { data: menu, refetch } = useQuery({ queryKey: ["menu", restaurantId], queryFn: () => fetchMenu(restaurantId) });
  const { data: orders = [] } = useQuery({
    queryKey: ["restaurant-orders", restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from("food_orders").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const updateOrderStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("food_orders").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`);
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-card border rounded-2xl p-3 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">Menu items ({menu?.items.length ?? 0})</p>
          <button onClick={onAddItem} className="px-3 h-8 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {menu?.items.length === 0 && <p className="text-xs text-muted-foreground py-3 text-center">No items yet</p>}
      </div>

      <div className="bg-card border rounded-2xl p-3 shadow-card">
        <p className="text-sm font-bold mb-2">Recent orders ({orders.length})</p>
        {orders.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No orders yet</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/40">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{o.ref_code} · ${Number(o.total).toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{o.status} · {new Date(o.created_at).toLocaleString()}</p>
                </div>
                <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)} className="h-8 text-[11px] rounded-lg border bg-background px-2">
                  {["pending", "accepted", "preparing", "out_for_delivery", "delivered", "cancelled"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddMenuItemDialog({ open, onClose, restaurantId }: { open: boolean; onClose: () => void; restaurantId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [veg, setVeg] = useState(false);
  const [spicy, setSpicy] = useState(false);
  const [media, setMedia] = useState<{ images: string[]; video: string | null }>({ images: [], video: null });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Add a name"); return; }
    if (!price || Number(price) <= 0) { toast.error("Add a price"); return; }
    setBusy(true);
    const { error } = await supabase.from("menu_items").insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      description: description || null,
      price: Number(price),
      image: media.images[0] || null,
      gallery: media.images,
      video_url: media.video,
      vegetarian: veg,
      spicy,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Menu item added");
    qc.invalidateQueries({ queryKey: ["menu", restaurantId] });
    setName(""); setDescription(""); setPrice(""); setMedia({ images: [], video: null });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add menu item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-xl border bg-background p-3 text-sm" />
          </Field>
          <Field label="Price *">
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-11 rounded-xl border bg-background px-3 text-sm" />
          </Field>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border bg-card cursor-pointer">
              <input type="checkbox" checked={veg} onChange={(e) => setVeg(e.target.checked)} />
              <span className="text-xs font-bold">Vegetarian</span>
            </label>
            <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border bg-card cursor-pointer">
              <input type="checkbox" checked={spicy} onChange={(e) => setSpicy(e.target.checked)} />
              <span className="text-xs font-bold">Spicy</span>
            </label>
          </div>
          <MediaUpload images={media.images} video={media.video} onChange={setMedia} folder={`restaurants/${restaurantId}/menu`} hint="Up to 6 photos · 1 video" />
          <Button onClick={submit} disabled={busy} className="w-full h-12">
            {busy ? "Saving…" : "Add to menu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
