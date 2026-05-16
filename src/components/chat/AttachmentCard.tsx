import { Link } from "react-router-dom";
import { Heart, Store, ShieldCheck, Package, ShoppingBag, ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShop } from "@/store/shop";

export type ChatAttachment =
  | {
      kind: "product";
      id: string;
      title: string;
      image: string;
      price?: number;
      currency?: string;
      unit?: string;
    }
  | {
      kind: "wishlist";
      count: number;
      ownerName?: string;
      items: { id: string; title: string; image: string; price?: number }[];
    }
  | {
      kind: "supplier";
      id: string;
      name: string;
      logo?: string | null;
      verified?: boolean | null;
      tagline?: string;
    }
  | {
      kind: "catalog";
      supplierId: string;
      supplierName: string;
      count: number;
      items: { id: string; title: string; image: string; price?: number }[];
    }
  | {
      kind: "cart-unlock";
      productId: string;
      title: string;
      image: string;
      price?: number;
      currency?: string;
      unit?: string;
      moq?: number;
    };

const fmt = (n?: number, c = "USD") =>
  typeof n === "number" ? `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}` : "";

export default function AttachmentCard({
  attachment,
  mine,
}: {
  attachment: ChatAttachment;
  mine: boolean;
}) {
  const surface = mine
    ? "bg-white/12 border-white/20 text-primary-foreground"
    : "bg-card border-border/60 text-foreground";

  if (attachment.kind === "product") {
    return (
      <Link
        to={`/product/${attachment.id}`}
        className={`block w-[230px] rounded-2xl overflow-hidden border ${surface} active:scale-[0.98] transition-transform`}
      >
        <div className="aspect-[4/3] bg-muted/40 relative">
          <img
            src={attachment.image}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> Product
          </p>
          <p className="text-[13px] font-semibold leading-snug line-clamp-2 mt-0.5">
            {attachment.title}
          </p>
          {typeof attachment.price === "number" && (
            <p className="text-sm font-extrabold mt-1">
              {fmt(attachment.price, attachment.currency)}
              {attachment.unit && (
                <span className="text-[10px] opacity-70 font-medium"> /{attachment.unit}</span>
              )}
            </p>
          )}
        </div>
      </Link>
    );
  }

  if (attachment.kind === "supplier") {
    return (
      <Link
        to={`/supplier/${attachment.id}`}
        className={`flex items-center gap-3 w-[260px] p-2.5 rounded-2xl border ${surface} active:scale-[0.98] transition-transform`}
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted/40 shrink-0">
          {attachment.logo ? (
            <img src={attachment.logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store className="w-5 h-5 opacity-60" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Supplier</p>
          <p className="text-sm font-bold truncate flex items-center gap-1">
            {attachment.name}
            {attachment.verified && <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
          </p>
          {attachment.tagline && (
            <p className="text-[11px] opacity-75 truncate">{attachment.tagline}</p>
          )}
        </div>
      </Link>
    );
  }

  if (attachment.kind === "cart-unlock") {
    return <CartUnlockCard attachment={attachment} mine={mine} />;
  }

  // wishlist & catalog share the multi-item layout
  const isWishlist = attachment.kind === "wishlist";
  const items = attachment.items.slice(0, 4);
  const linkTo =
    attachment.kind === "catalog" ? `/supplier/${attachment.supplierId}` : "/wishlist";
  const headerLabel = isWishlist ? "Wishlist" : "Catalog";
  const Icon = isWishlist ? Heart : Package;
  const title = isWishlist
    ? `${attachment.ownerName ? `${attachment.ownerName}'s ` : ""}wishlist · ${attachment.count} items`
    : `${attachment.supplierName} · ${attachment.count} items`;

  return (
    <Link
      to={linkTo}
      className={`block w-[260px] rounded-2xl overflow-hidden border ${surface} active:scale-[0.98] transition-transform`}
    >
      <div className="grid grid-cols-2 gap-0.5 bg-muted/30">
        {items.map((it) => (
          <div key={it.id} className="aspect-square bg-muted/50 overflow-hidden">
            <img src={it.image} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
          <div key={`b${i}`} className="aspect-square bg-muted/40" />
        ))}
      </div>
      <div className="p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1">
          <Icon className="w-3 h-3" /> {headerLabel}
        </p>
        <p className="text-[13px] font-semibold leading-snug mt-0.5 line-clamp-2">{title}</p>
      </div>
    </Link>
  );
}

function CartUnlockCard({
  attachment,
  mine,
}: {
  attachment: Extract<ChatAttachment, { kind: "cart-unlock" }>;
  mine: boolean;
}) {
  const { addToCart } = useShop();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const surface = mine
    ? "bg-white/12 border-white/20 text-primary-foreground"
    : "bg-card border-border/60 text-foreground";

  const add = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await addToCart(attachment.productId, attachment.moq ?? 1);
      setAdded(true);
      toast.success("Added to cart", { description: attachment.title });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not add to cart");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`w-[260px] rounded-2xl overflow-hidden border ${surface}`}>
      <Link to={`/product/${attachment.productId}`} className="block">
        <div className="aspect-[4/3] bg-muted/40 relative">
          <img src={attachment.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wide">
            <ShieldCheck className="w-3 h-3" /> Approved
          </span>
        </div>
      </Link>
      <div className="p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" /> Cart unlocked
        </p>
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 mt-0.5">{attachment.title}</p>
        {typeof attachment.price === "number" && (
          <p className="text-sm font-extrabold mt-1">
            {fmt(attachment.price, attachment.currency)}
            {attachment.unit && <span className="text-[10px] opacity-70 font-medium"> /{attachment.unit}</span>}
          </p>
        )}
        <button
          onClick={add}
          disabled={busy || added}
          className={`mt-2 w-full h-9 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-95 ${
            added
              ? "bg-emerald-500 text-white"
              : mine
              ? "bg-white text-foreground"
              : "bg-foreground text-background"
          } disabled:opacity-70`}
        >
          {added ? <><Check className="w-4 h-4" /> Added</> : <><ShoppingCart className="w-4 h-4" /> {busy ? "Adding…" : "Add to cart"}</>}
        </button>
      </div>
    </div>
  );
}
