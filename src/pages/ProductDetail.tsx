import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Heart, Share2, Star, Truck, ShieldCheck, Minus, Plus, MessageCircle, ShoppingCart, Store, Globe, Package,
} from "lucide-react";
import { toast } from "sonner";
import { tierPriceFor, discountPct, type Product } from "@/data/products";
import { useProduct, useSupplier, useTierPrices, useReviews, useProducts } from "@/hooks/useCatalog";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";
import AdReel from "@/components/marketplace/AdReel";

import ProductGallery from "@/components/marketplace/ProductGallery";
import SupplierCard from "@/components/marketplace/SupplierCard";
import ProductCard from "@/components/marketplace/ProductCard";
import ShareToChatSheet from "@/components/chat/ShareToChatSheet";
import GroupBuyStartSheet from "@/components/social/GroupBuyStartSheet";
import SocialActions from "@/components/social/SocialActions";
import InquiryGateDialog from "@/components/marketplace/InquiryGateDialog";
import { isApprovalExpired } from "@/lib/inquiryGate";
import { supabase } from "@/integrations/supabase/client";
import CircleSpinner from "@/components/CircleSpinner";

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
  const [groupBuyOpen, setGroupBuyOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [hasInquired, setHasInquired] = useState<boolean | null>(null);

  useEffect(() => { if (product) setQty(product.moq); }, [product?.id, product?.moq]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (cancelled) return;
      setBuyerId(uid);
      if (!uid || !product?.id) { setHasInquired(false); return; }
      const { data: inq } = await supabase
        .from("product_inquiries")
        .select("id,status,decided_at")
        .eq("buyer_id", uid)
        .eq("product_id", product.id)
        .maybeSingle();
      const approved = inq?.status === "approved" && !isApprovalExpired((inq as any)?.decided_at);
      if (!cancelled) setHasInquired(approved);
    })();
    // realtime: unlock as soon as supplier approves
    const ch = supabase
      .channel(`inq:${product?.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "product_inquiries", filter: `product_id=eq.${product?.id}` }, (payload: any) => {
        if (payload.new?.buyer_id === buyerId && payload.new?.status === "approved") setHasInquired(true);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [product?.id, buyerId]);

  if (isLoading) return <p className="p-12 text-center text-sm text-muted-foreground"><CircleSpinner size={28} /></p>;
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

  const gated = hasInquired === false;
  const handleAdd = () => {
    if (gated) { setInquiryOpen(true); return; }
    addToCart(product.id, qty);
    toast.success(`Added ${qty} ${product.unit}`, { description: product.title });
  };
  const handleBuy = () => {
    if (gated) { setInquiryOpen(true); return; }
    addToCart(product.id, qty); navigate("/cart");
  };

  return (
    <div className=" -mt-px lg:max-w-[1240px] lg:mx-auto lg:px-6 lg:py-6">

      <Helmet>
        <title>{`${product.title} — PUBSTORE`}</title>
        <meta name="description" content={(product.description ?? product.title).slice(0, 155)} />
        <link rel="canonical" href={`https://pubstore.app/product/${product.id}`} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={`https://pubstore.app/product/${product.id}`} />
        <meta property="og:title" content={product.title} />
        <meta property="og:description" content={(product.description ?? product.title).slice(0, 155)} />
        {product.image && <meta property="og:image" content={product.image} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          image: product.gallery ?? [product.image],
          description: product.description ?? product.title,
          sku: product.id,
          aggregateRating: product.reviews > 0 ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews } : undefined,
          offers: { "@type": "Offer", price: unitPrice, priceCurrency: "USD", availability: "https://schema.org/InStock", url: `https://pubstore.app/product/${product.id}` },
        })}</script>
      </Helmet>
      <div className="sticky top-12 z-30 bg-background/90 backdrop-blur border-b px-2 py-2 flex items-center justify-between lg:hidden">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-1">
          <button onClick={() => toggleWishlist(product.id)} aria-label="Wishlist" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
            <Heart className={`w-5 h-5 ${liked ? "fill-destructive text-destructive" : ""}`} />
          </button>
          <button aria-label="Share" onClick={() => setShareOpen(true)} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      <ShareToChatSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        attachment={{
          kind: "product",
          id: product.id,
          title: product.title,
          image: product.image,
          price: unitPrice,
          currency: "USD",
          unit: product.unit,
        }}
      />
      {supplier && (
        <GroupBuyStartSheet
          open={groupBuyOpen}
          onClose={() => setGroupBuyOpen(false)}
          productId={product.id}
          productTitle={product.title}
          supplierId={supplier.id}
        />
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-8 lg:items-start">
      <div className="lg:sticky lg:top-16 lg:rounded-2xl lg:border lg:bg-card lg:overflow-hidden">
      <ProductGallery images={product.gallery ?? [product.image]} alt={product.title} videoUrl={product.videoUrl} />
      </div>

      <div className="lg:min-w-0">
      {product.adHasReel && (
        <div className="px-4 pt-3">
          <AdReel product={product} />
        </div>
      )}


      <section className="px-4 pt-3 lg:px-0 lg:pt-0 lg:flex lg:flex-col">
        <p className="hidden lg:block text-2xl font-semibold leading-snug mb-3">{product.title}</p>
        <div className="lg:rounded-xl lg:bg-muted/50 lg:p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl lg:text-4xl font-bold text-destructive">{fmt(unitPrice)}</span>
          {product.originalPrice && unitPrice < product.originalPrice && (
            <>
              <span className="text-sm text-muted-foreground line-through">{fmt(product.originalPrice)}</span>
              {off > 0 && <span className="bg-destructive/10 text-destructive text-xs font-bold px-1.5 py-0.5 rounded">-{off}%</span>}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">per {product.unit} · MOQ {product.moq} {product.unit}</p>
        </div>
        <h1 className="mt-2 text-base font-medium leading-snug lg:hidden">{product.title}</h1>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
            <span>({product.reviews})</span>
          </span>
          <span>·</span><span>{product.sold.toLocaleString()} sold</span>
          {product.freeShipping && (<><span>·</span><span className="text-primary font-medium inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Free shipping</span></>)}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SocialActions
            target="product"
            id={product.id}
            shareTitle={product.title}
            onShareToChat={() => setShareOpen(true)}
            onGroupBuy={() => setGroupBuyOpen(true)}
          />
          <button
            onClick={() => setGroupBuyOpen(true)}
            className="h-9 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold inline-flex items-center gap-1.5"
          >
            Buy together
          </button>
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

      {supplier && (
        <section className="px-4 mt-3">
          <Link
            to={`/messages?supplier=${supplier.id}&prefill=${encodeURIComponent(
              `Hi, I'd like to order a sample of "${product.title}" before placing a bulk order. What is the sample price and lead time? Thanks.`
            )}`}
            className="flex items-center justify-between rounded-xl bg-muted/50 hover:bg-muted px-3 py-2.5 transition"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Package className="w-4 h-4 text-primary" /> Request a sample
            </span>
            <span className="text-[11px] text-muted-foreground">Test before bulk order →</span>
          </Link>
        </section>
      )}

      {supplier && <SupplierCard supplier={supplier} />}
      </div>
      </div>

      <section className="mt-5 lg:mt-10">

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
          <div className="grid grid-cols-2 gap-1">
            {related.map((p) => (<ProductCard key={p.id} product={p} />))}
          </div>
        </section>
      )}


      <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto px-3 pb-2 pt-2 flex items-center gap-2 pointer-events-auto bg-background/85 backdrop-blur-xl border-t border-border shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]">
          {supplier && (
            <Link
              to={`/supplier/${supplier.id}`}
              className="flex flex-col items-center justify-center w-12 h-12 rounded-full text-[10px] text-foreground bg-background/40 backdrop-blur-xl backdrop-saturate-150 border border-white/30 dark:border-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]"
            >
              <Store className="w-5 h-5" /><span className="leading-none mt-0.5">Store</span>
            </Link>
          )}
          <Link
            to="/messages"
            className="flex flex-col items-center justify-center w-12 h-12 rounded-full text-[10px] text-foreground bg-background/40 backdrop-blur-xl backdrop-saturate-150 border border-white/30 dark:border-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]"
          >
            <MessageCircle className="w-5 h-5" /><span className="leading-none mt-0.5">Chat</span>
          </Link>
          {gated ? (
            <Button
              onClick={() => setInquiryOpen(true)}
              className="flex-1 h-12 rounded-xl font-semibold gap-1.5 bg-background/40 backdrop-blur-xl backdrop-saturate-150 text-foreground border border-white/30 dark:border-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-background/60"
            >
              <ShieldCheck className="w-4 h-4" /> Inquire to unlock checkout
            </Button>
          ) : (
            <>
              <Button
                onClick={handleAdd}
                className="flex-1 h-12 rounded-full font-semibold gap-1.5 bg-background/40 backdrop-blur-xl backdrop-saturate-150 text-foreground border border-white/30 dark:border-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-background/60"
              >
                <ShoppingCart className="w-4 h-4" /> Add
              </Button>
              <Button
                onClick={handleBuy}
                className="flex-1 h-12 rounded-full font-semibold bg-foreground/90 backdrop-blur-xl text-background border border-white/20 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-foreground"
              >
                Buy now
              </Button>
            </>
          )}
        </div>
      </div>

      {supplier && (
        <InquiryGateDialog
          open={inquiryOpen}
          onClose={() => setInquiryOpen(false)}
          productId={product.id}
          productTitle={product.title}
          supplierId={supplier.id}
          buyerId={buyerId}
          onSent={() => setHasInquired(false)}
        />
      )}
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
