import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Share2,
  Star,
  Truck,
  ShieldCheck,
  Package,
  Minus,
  Plus,
  MessageCircle,
  ShoppingCart,
  Store,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProduct,
  getRelated,
  getSupplier,
  tierPriceFor,
  discountPct,
} from "@/data/products";
import { useShop } from "@/store/shop";
import { Button } from "@/components/ui/button";
import ProductGallery from "@/components/marketplace/ProductGallery";
import SupplierCard from "@/components/marketplace/SupplierCard";
import ProductCard from "@/components/marketplace/ProductCard";

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function ProductDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const product = getProduct(id);
  const { addToCart, toggleWishlist, isWishlisted } = useShop();

  const [qty, setQty] = useState<number>(product?.moq ?? 1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"specs" | "description" | "reviews">("specs");

  const supplier = product ? getSupplier(product.supplierId) : null;
  const related = useMemo(() => (product ? getRelated(product) : []), [product]);
  const unitPrice = useMemo(
    () => (product ? tierPriceFor(product, qty) : 0),
    [product, qty]
  );

  if (!product) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Button onClick={() => navigate("/home")} className="mt-4">
          Back to home
        </Button>
      </div>
    );
  }

  const off = discountPct(product);
  const liked = isWishlisted(product.id);
  const total = unitPrice * qty;

  const handleAdd = () => {
    addToCart(product.id, qty);
    toast.success(`Added ${qty} ${qty === 1 ? product.unit : product.unit + "s"}`, {
      description: product.title,
    });
  };

  const handleBuyNow = () => {
    addToCart(product.id, qty);
    navigate("/cart");
  };

  return (
    <div className="pb-32 -mt-px">
      {/* Floating header */}
      <div className="sticky top-12 z-30 bg-background/90 backdrop-blur border-b border-border px-2 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleWishlist(product.id)}
            aria-label="Wishlist"
            className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-destructive text-destructive" : ""}`} />
          </button>
          <button
            aria-label="Share"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              toast.success("Link copied");
            }}
            className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Gallery */}
      <ProductGallery images={product.gallery ?? [product.image]} alt={product.title} />

      {/* Price block */}
      <section className="px-4 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-destructive">{fmt(unitPrice)}</span>
          {product.originalPrice && unitPrice < product.originalPrice && (
            <>
              <span className="text-sm text-muted-foreground line-through">
                {fmt(product.originalPrice)}
              </span>
              {off > 0 && (
                <span className="bg-destructive/10 text-destructive text-xs font-bold px-1.5 py-0.5 rounded">
                  -{off}%
                </span>
              )}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          per {product.unit} · MOQ {product.moq} {product.unit}{product.moq > 1 ? "s" : ""}
        </p>
        <h1 className="mt-2 text-base font-medium leading-snug">{product.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
            <span>({product.reviews})</span>
          </span>
          <span>·</span>
          <span>{product.sold.toLocaleString()} sold</span>
          {product.freeShipping && (
            <>
              <span>·</span>
              <span className="text-primary font-medium inline-flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                Free shipping
              </span>
            </>
          )}
        </div>
      </section>

      {/* Tier prices */}
      {product.tierPrices && product.tierPrices.length > 0 && (
        <section className="px-4 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Bulk pricing
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {product.tierPrices.map((t, i) => {
              const next = product.tierPrices?.[i + 1];
              const range = next
                ? `${t.minQty}–${next.minQty - 1}`
                : `≥ ${t.minQty}`;
              const active = unitPrice === t.price;
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-2 text-center transition ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <p className="text-base font-bold text-destructive tabular-nums">{fmt(t.price)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {range} {product.unit}{t.minQty > 1 ? "s" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Variants */}
      {product.variants?.map((group) => (
        <section key={group.name} className="px-4 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {group.name}: <span className="text-foreground normal-case font-medium">
              {group.options.find((o) => o.id === selectedVariants[group.name])?.name ?? "Choose"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => {
              const active = selectedVariants[group.name] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setSelectedVariants((s) => ({ ...s, [group.name]: opt.id }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                    active
                      ? "border-foreground bg-foreground/5 font-semibold"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {opt.name}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Quantity */}
      <section className="px-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Quantity
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Min order {product.moq} {product.unit}{product.moq > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty((q) => Math.max(product.moq, q - 1))}
              aria-label="Decrease"
              className="w-9 h-9 rounded-md border border-border flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={qty}
              min={product.moq}
              onChange={(e) =>
                setQty(Math.max(product.moq, parseInt(e.target.value || "0", 10) || product.moq))
              }
              className="w-16 h-9 text-center bg-muted rounded-md text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={() => setQty((q) => q + 1)}
              aria-label="Increase"
              className="w-9 h-9 rounded-md border border-border flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-muted/60 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Subtotal</span>
          <span className="text-lg font-bold text-destructive tabular-nums">{fmt(total)}</span>
        </div>
      </section>

      {/* Trust strip */}
      <section className="px-4 mt-4 grid grid-cols-3 gap-2">
        <Trust icon={ShieldCheck} title="Trade Assurance" desc="Refund if not delivered" />
        <Trust icon={Truck} title="Lead time" desc={product.leadTime} />
        <Trust icon={Globe} title="Ships from" desc={product.shipFrom} />
      </section>

      {/* Supplier */}
      {supplier && <SupplierCard supplier={supplier} />}

      {/* Tabs */}
      <section className="mt-5">
        <div className="border-b border-border px-4 flex gap-5 text-sm">
          {([
            ["specs", "Specifications"],
            ["description", "Description"],
            ["reviews", `Reviews (${product.reviews})`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`py-2.5 -mb-px border-b-2 transition ${
                tab === k
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 py-4">
          {tab === "specs" && (
            <dl className="divide-y divide-border">
              {(product.specs ?? [
                { label: "Category", value: product.category },
                { label: "MOQ", value: `${product.moq} ${product.unit}` },
                { label: "Lead time", value: product.leadTime },
                { label: "Ships from", value: product.shipFrom },
              ]).map((s) => (
                <div key={s.label} className="grid grid-cols-3 gap-3 py-2 text-sm">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="col-span-2 text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {tab === "description" && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {product.description ??
                "This is a quality product manufactured by a verified supplier. Custom packaging, OEM and private label options are typically available — contact the supplier for details and samples."}
            </p>
          )}

          {tab === "reviews" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-3xl font-bold leading-none">{product.rating.toFixed(1)}</p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.round(product.rating)
                            ? "fill-amber-500 text-amber-500"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {product.reviews.toLocaleString()} reviews
                  </p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct = star === 5 ? 72 : star === 4 ? 18 : star === 3 ? 6 : star === 2 ? 2 : 2;
                    return (
                      <div key={star} className="flex items-center gap-2 text-[11px]">
                        <span className="w-3 text-muted-foreground tabular-nums">{star}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ul className="space-y-4">
                {(product.reviewList ?? []).map((r) => (
                  <li key={r.id} className="border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold">
                          {r.user.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold leading-tight">{r.user}</p>
                          <p className="text-[10px] text-muted-foreground">{r.country}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < r.rating
                                ? "fill-amber-500 text-amber-500"
                                : "text-muted-foreground/40"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm mt-2 text-foreground/90">{r.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      {r.variant && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">{r.variant}</span>
                      )}
                      <span>{r.date}</span>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>Verified purchase</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="px-4 mt-6">
          <p className="text-base font-bold mb-3">You may also like</p>
          <div className="grid grid-cols-2 gap-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-30 bg-background border-t border-border safe-bottom">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-2">
          {supplier && (
            <Link
              to={`/supplier/${supplier.id}`}
              aria-label="Supplier store"
              className="flex flex-col items-center justify-center w-12 h-12 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Store className="w-5 h-5" />
              <span>Store</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => toast("Inquiry sent to supplier", { description: "They typically reply within hours." })}
            aria-label="Contact supplier"
            className="flex flex-col items-center justify-center w-12 h-12 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chat</span>
          </button>
          <Button
            onClick={handleAdd}
            variant="outline"
            className="flex-1 h-12 rounded-full border-foreground/20 font-semibold gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" /> Add
          </Button>
          <Button
            onClick={handleBuyNow}
            className="flex-1 h-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}

function Trust({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof ShieldCheck;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2 flex flex-col items-start">
      <Icon className="w-4 h-4 text-primary" />
      <p className="text-[11px] font-semibold mt-1 leading-tight">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{desc}</p>
    </div>
  );
}
