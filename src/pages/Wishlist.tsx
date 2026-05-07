import { Link } from "react-router-dom";
import { Heart, Trash2, ShoppingCart, Send } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/store/shop";
import { discountPct } from "@/data/products";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapProduct, type Product } from "@/data/products";
import ShareToChatSheet from "@/components/chat/ShareToChatSheet";
import type { ChatAttachment } from "@/components/chat/AttachmentCard";

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart } = useShop();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (wishlist.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("products").select("*").in("id", wishlist);
      if (!alive) return;
      setItems((data ?? []).map((p) => mapProduct(p as Parameters<typeof mapProduct>[0])));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [wishlist]);

  if (loading) {
    return <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-24 animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 shadow-card">
          <Heart className="w-10 h-10 text-muted-foreground" strokeWidth={1.4} />
        </div>
        <h2 className="text-xl font-bold mb-1">Your wishlist is empty</h2>
        <p className="text-muted-foreground text-sm max-w-xs mb-6">
          Save products you love to come back to them anytime.
        </p>
        <Link to="/home">
          <Button>Discover products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Wishlist</h1>
        <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>

      <ul className="space-y-3">
        {items.map((p) => {
          const off = discountPct(p);
          return (
            <li key={p.id} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden flex">
              <Link to={`/product/${p.id}`} className="w-28 h-28 shrink-0 bg-muted">
                <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 p-3 flex flex-col">
                <Link to={`/product/${p.id}`} className="text-sm leading-snug line-clamp-2">
                  {p.title}
                </Link>
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
                  <Button
                    size="sm"
                    className="h-8 text-xs flex-1 shadow-soft"
                    onClick={async () => {
                      await addToCart(p.id, p.moq);
                      toast.success("Added to cart", { description: p.title });
                    }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                  <button
                    onClick={() => toggleWishlist(p.id)}
                    aria-label="Remove"
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shadow-soft hover:bg-destructive/10 hover:text-destructive transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
