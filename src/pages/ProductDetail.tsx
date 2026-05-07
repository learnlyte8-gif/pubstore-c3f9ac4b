import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Heart, Share2, Star, Truck, ShieldCheck, Minus, Plus, MessageCircle, ShoppingCart, Store, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { tierPriceFor, discountPct, type Product } from "@/data/products";
import { useProduct, useSupplier, useTierPrices, useReviews, useProducts } from "@/hooks/useCatalog";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";
import ProductGallery from "@/components/marketplace/ProductGallery";
import SupplierCard from "@/components/marketplace/SupplierCard";
import ProductCard from "@/components/marketplace/ProductCard";
import ShareToChatSheet from "@/components/chat/ShareToChatSheet";

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function ProductDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: baseProduct, isLoading } = useProduct(id);
  const { data: tierPrices = [] } = useTierPrices(id);
  const { data: reviewList = [] } = useReviews(id);
  const { data: supplier } = useSupplier(baseProduct?.supplierId);
  const { data: relatedAll = [] } = useProducts({ category: baseProduct?.category, limit: 8 });
  const { addToCart, toggleWishlist, isWishlisted } = useShop();

  const product: Product | null = useMemo(() => {
    if (!baseProduct) return null;
    return { ...baseProduct, tierPrices, reviewList };
  }, [baseProduct, tierPrices, reviewList]);

  const [qty, setQty] = useState<number>(1);
  const [tab, setTab] = useState<"specs" | "description" | "reviews">("specs");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => { if (product) setQty(product.moq); }, [product?.id, product?.moq]);

  if (isLoading) return <p className="p-12 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!product) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Button onClick={() => navigate("/home")} className="mt-4">Back to home</Button>
      </div>
    );
  }

  const off = discountPct(product);
  const liked = isWishlisted(product.id);
  const unitPrice = tierPriceFor(product, qty);
  const total = unitPrice * qty;
  const related = relatedAll.filter((r) => r.id !== product.id).slice(0, 6);

  const handleAdd = () => {
    addToCart(product.id, qty);
    toast.success(`Added ${qty} ${product.unit}`, { description: product.title });
  };
  const handleBuy = () => { addToCart(product.id, qty); navigate("/cart"); };

  return (
    <div className="pb-32 -mt-px">
      <div className="sticky top-12 z-30 bg-background/90 backdrop-blur border-b px-2 py-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-1">
          <button onClick={() => toggleWishlist(product.id)} aria-label="Wishlist" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
            <Heart className={`w-5 h-5 ${liked ? "fill-destructive text-destructive" : ""}`} />
          </button>
          <button aria-label="Share" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copied"); }} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ProductGallery images={product.gallery ?? [product.image]} alt={product.title} />

      <section className="px-4 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-destructive">{fmt(unitPrice)}</span>
          {product.originalPrice && unitPrice < product.originalPrice && (
            <>
              <span className="text-sm text-muted-foreground line-through">{fmt(product.originalPrice)}</span>
              {off > 0 && <span className="bg-destructive/10 text-destructive text-xs font-bold px-1.5 py-0.5 rounded">-{off}%</span>}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">per {product.unit} · MOQ {product.moq} {product.unit}</p>
        <h1 className="mt-2 text-base font-medium leading-snug">{product.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
            <span>({product.reviews})</span>
          </span>
          <span>·</span><span>{product.sold.toLocaleString()} sold</span>
          {product.freeShipping && (<><span>·</span><span className="text-primary font-medium inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Free shipping</span></>)}
        </div>
      </section>

      {tierPrices.length > 0 && (
        <section className="px-4 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bulk pricing</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {tierPrices.map((t, i) => {
              const next = tierPrices[i + 1];
              const range = next ? `${t.minQty}–${next.minQty - 1}` : `≥ ${t.minQty}`;
              const active = unitPrice === t.price;
              return (
                <div key={i} className={`rounded-lg border p-2 text-center ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <p className="text-base font-bold text-destructive tabular-nums">{fmt(t.price)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{range} {product.unit}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quantity</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Min order {product.moq} {product.unit}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setQty((q) => Math.max(product.moq, q - 1))} aria-label="Decrease" className="w-9 h-9 rounded-md border flex items-center justify-center"><Minus className="w-4 h-4" /></button>
            <input type="number" value={qty} min={product.moq}
              onChange={(e) => setQty(Math.max(product.moq, parseInt(e.target.value || "0", 10) || product.moq))}
              className="w-16 h-9 text-center bg-muted rounded-md text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/40" />
            <button onClick={() => setQty((q) => q + 1)} aria-label="Increase" className="w-9 h-9 rounded-md border flex items-center justify-center"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-muted/60 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Subtotal</span>
          <span className="text-lg font-bold text-destructive tabular-nums">{fmt(total)}</span>
        </div>
      </section>

      <section className="px-4 mt-4 grid grid-cols-3 gap-2">
        <Trust icon={ShieldCheck} title="Trade Assurance" desc="Refund if not delivered" />
        <Trust icon={Truck} title="Lead time" desc={product.leadTime} />
        <Trust icon={Globe} title="Ships from" desc={product.shipFrom} />
      </section>

      {supplier && <SupplierCard supplier={supplier} />}

      <section className="mt-5">
        <div className="border-b px-4 flex gap-5 text-sm">
          {([
            ["specs", "Specs"], ["description", "Description"], ["reviews", `Reviews (${reviewList.length})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`py-2.5 -mb-px border-b-2 ${tab === k ? "border-foreground font-semibold" : "border-transparent text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="px-4 py-4">
          {tab === "specs" && (
            <dl className="divide-y">
              {(product.specs && product.specs.length ? product.specs : [
                { label: "Category", value: product.category },
                { label: "MOQ", value: `${product.moq} ${product.unit}` },
                { label: "Lead time", value: product.leadTime },
                { label: "Ships from", value: product.shipFrom },
              ]).map((s, i) => (
                <div key={i} className="grid grid-cols-3 gap-3 py-2 text-sm">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="col-span-2 text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === "description" && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {product.description || "No description provided."}
            </p>
          )}
          {tab === "reviews" && (
            reviewList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No reviews yet.</p>
            ) : (
              <ul className="space-y-4">
                {reviewList.map((r) => (
                  <li key={r.id} className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{r.user}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < r.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm mt-2">{r.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{r.date}</p>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="px-4 mt-6">
          <p className="text-base font-bold mb-3">You may also like</p>
          <div className="grid grid-cols-2 gap-3">
            {related.map((p) => (<ProductCard key={p.id} product={p} />))}
          </div>
        </section>
      )}

      <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-30 bg-background border-t safe-bottom">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-2">
          {supplier && (
            <Link to={`/supplier/${supplier.id}`} className="flex flex-col items-center justify-center w-12 h-12 text-[10px] text-muted-foreground hover:text-foreground">
              <Store className="w-5 h-5" /><span>Store</span>
            </Link>
          )}
          <Link to="/messages" className="flex flex-col items-center justify-center w-12 h-12 text-[10px] text-muted-foreground hover:text-foreground">
            <MessageCircle className="w-5 h-5" /><span>Chat</span>
          </Link>
          <Button onClick={handleAdd} variant="outline" className="flex-1 h-12 rounded-full font-semibold gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Add
          </Button>
          <Button onClick={handleBuy} className="flex-1 h-12 rounded-full font-semibold">Buy now</Button>
        </div>
      </div>
    </div>
  );
}

function Trust({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <Icon className="w-4 h-4 mx-auto text-primary" />
      <p className="text-[11px] font-semibold mt-1">{title}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
  );
}
