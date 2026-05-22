import { Link } from "react-router-dom";
import { Heart, Trash2, ShoppingCart, Send, Sprout, BedDouble, Home as HomeIcon, Wrench, Factory, Car, Truck, Banknote, Newspaper, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/store/shop";
import { discountPct } from "@/data/products";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapProduct, type Product } from "@/data/products";
import ShareToChatSheet from "@/components/chat/ShareToChatSheet";
import type { ChatAttachment } from "@/components/chat/AttachmentCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SaveKind } from "@/hooks/useSaves";

const fmt = (n: number) => `$${n.toFixed(2)}`;

type SavedRow = {
  id: string;
  item_kind: SaveKind;
  item_id: string;
  title: string | null;
  image: string | null;
  href: string | null;
};

const KIND_META: Record<SaveKind, { label: string; Icon: any; href: (id: string) => string }> = {
  agro:         { label: "Agro",        Icon: Sprout,    href: (id) => `/agro/${id}` },
  stay:         { label: "Stays",       Icon: BedDouble, href: (id) => `/stays/${id}` },
  property:     { label: "Properties",  Icon: HomeIcon,  href: () => "/properties" },
  service:      { label: "Services",    Icon: Wrench,    href: () => "/services" },
  industrial:   { label: "Industrial",  Icon: Factory,   href: (id) => `/industrial/${id}` },
  "car-rental": { label: "Car rentals", Icon: Car,       href: (id) => `/car-rentals/${id}` },
  freelance:    { label: "Freelance",   Icon: Sparkles,  href: () => "/services" },
  logistics:    { label: "Logistics",   Icon: Truck,     href: () => "/logistics" },
  finance:      { label: "Finance",     Icon: Banknote,  href: () => "/finance" },
  news:         { label: "News",        Icon: Newspaper, href: () => "/news" },
};

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart } = useShop();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (wishlist.length === 0) { setItems([]); setLoading(false); return; }
      const { data } = await supabase.from("products").select("*").in("id", wishlist);
      if (!alive) return;
      setItems((data ?? []).map((p) => mapProduct(p as Parameters<typeof mapProduct>[0])));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [wishlist]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { setSaved([]); setSavedLoading(false); return; }
      const { data } = await supabase
        .from("saved_items")
        .select("id,item_kind,item_id,title,image,href")
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });
      if (!alive) return;
      setSaved((data ?? []) as unknown as SavedRow[]);
      setSavedLoading(false);
    })();
  }, []);

  const removeSaved = async (row: SavedRow) => {
    setSaved((prev) => prev.filter((r) => r.id !== row.id));
    await supabase.from("saved_items").delete().eq("id", row.id);
  };

  const grouped = saved.reduce<Record<string, SavedRow[]>>((acc, r) => {
    (acc[r.item_kind] ||= []).push(r);
    return acc;
  }, {});
  const savedCount = saved.length;
  const totalCount = items.length + savedCount;

  return (
    <div className="px-4 py-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Wishlist</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{totalCount} item{totalCount === 1 ? "" : "s"}</span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="h-8 px-3 rounded-full bg-ig-gradient text-white text-xs font-bold inline-flex items-center gap-1 shadow-pop active:scale-95 transition"
              aria-label="Share wishlist"
            >
              <Send className="w-3.5 h-3.5" /> Share
            </button>
          )}
        </div>
      </div>

      <ShareToChatSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        attachment={{
          kind: "wishlist",
          count: items.length,
          items: items.slice(0, 4).map((p) => ({ id: p.id, title: p.title, image: p.image, price: p.price })),
        } as ChatAttachment}
      />

      <Tabs defaultValue="products">
        <TabsList className="w-full">
          <TabsTrigger value="products" className="flex-1">Products ({items.length})</TabsTrigger>
          <TabsTrigger value="services" className="flex-1">Services & more ({savedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></div>
          ) : items.length === 0 ? (
            <EmptyBlock
              title="No saved products yet"
              hint="Tap the heart on any product to save it here."
            />
          ) : (
            <ul className="space-y-3">
              {items.map((p) => {
                const off = discountPct(p);
                return (
                  <li key={p.id} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden flex">
                    <Link to={`/product/${p.id}`} className="w-28 h-28 shrink-0 bg-muted">
                      <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                    </Link>
                    <div className="flex-1 p-3 flex flex-col">
                      <Link to={`/product/${p.id}`} className="text-sm leading-snug line-clamp-2">{p.title}</Link>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-base font-bold text-destructive">{fmt(p.price)}</span>
                        {p.originalPrice && (
                          <>
                            <span className="text-[11px] text-muted-foreground line-through">{fmt(p.originalPrice)}</span>
                            <span className="text-[10px] font-bold text-destructive">-{off}%</span>
                          </>
                        )}
                      </div>
                      <div className="mt-auto flex items-center gap-2">
                        <Button size="sm" className="h-8 text-xs flex-1 shadow-soft"
                          onClick={async () => { await addToCart(p.id, p.moq); toast.success("Added to cart", { description: p.title }); }}>
                          <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add
                        </Button>
                        <button onClick={() => toggleWishlist(p.id)} aria-label="Remove"
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shadow-soft hover:bg-destructive/10 hover:text-destructive transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          {savedLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></div>
          ) : savedCount === 0 ? (
            <EmptyBlock
              title="No saved services yet"
              hint="Tap the heart on any stay, property, agro listing, vehicle, freelance gig or service to save it."
            />
          ) : (
            <div className="space-y-5">
              {(Object.keys(grouped) as SaveKind[]).map((k) => {
                const meta = KIND_META[k] ?? { label: k, Icon: Heart, href: () => "#" };
                const list = grouped[k];
                return (
                  <section key={k}>
                    <div className="flex items-center gap-2 mb-2">
                      <meta.Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{meta.label}</p>
                      <span className="text-[11px] text-muted-foreground">· {list.length}</span>
                    </div>
                    <ul className="grid grid-cols-2 gap-3">
                      {list.map((r) => (
                        <li key={r.id} className="bg-card rounded-2xl border shadow-card overflow-hidden relative group">
                          <Link to={r.href || meta.href(r.item_id)} className="block">
                            <div className="aspect-[4/3] bg-muted">
                              {r.image && <img src={r.image} alt={r.title ?? ""} loading="lazy" className="w-full h-full object-cover" />}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-bold leading-snug line-clamp-2">{r.title ?? "Saved item"}</p>
                            </div>
                          </Link>
                          <button onClick={() => removeSaved(r)} aria-label="Remove"
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center shadow-soft hover:bg-destructive/10 hover:text-destructive transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyBlock({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 animate-fade-up">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3 shadow-card">
        <Heart className="w-8 h-8 text-muted-foreground" strokeWidth={1.4} />
      </div>
      <h2 className="text-base font-bold mb-1">{title}</h2>
      <p className="text-muted-foreground text-xs max-w-xs mb-5">{hint}</p>
      <Link to="/home"><Button size="sm">Discover</Button></Link>
    </div>
  );
}
