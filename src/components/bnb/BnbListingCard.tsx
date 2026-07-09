import { useState } from "react";
import { Link } from "react-router-dom";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import SaveHeart from "@/components/marketplace/SaveHeart";
import { cn } from "@/lib/utils";

export interface BnbListing {
  id: string;
  title: string;
  subtitle?: string | null;
  location?: string | null;
  images: string[];
  price?: number | null;
  priceUnit?: string | null;
  priceLabel?: string | null;
  rating?: number | null;
  badge?: string | null;
  href?: string;
}

export default function BnbListingCard({
  listing,
  saveKind,
}: {
  listing: BnbListing;
  saveKind?: string;
}) {
  const [idx, setIdx] = useState(0);
  const imgs = listing.images.length ? listing.images : [""];
  const content = (
    <div className="group">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
        {imgs[idx] ? (
          <img
            src={imgs[idx]}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60" />
        )}

        {listing.badge && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/95 backdrop-blur text-[10px] font-bold uppercase tracking-wider shadow-bnb">
            {listing.badge}
          </span>
        )}

        {saveKind && (
          <SaveHeart
            kind={saveKind as any}
            itemId={listing.id}
            snapshot={{ title: listing.title, image: imgs[0], href: listing.href ?? "" }}
            className="absolute top-2.5 right-2.5 w-8 h-8"
          />
        )}

        {imgs.length > 1 && (
          <>
            <NavBtn side="left" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => (i - 1 + imgs.length) % imgs.length); }} />
            <NavBtn side="right" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => (i + 1) % imgs.length); }} />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {imgs.slice(0, 6).map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-1.5 bg-white" : "w-1 bg-white/60")} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-semibold leading-tight line-clamp-1 flex-1">{listing.title}</p>
          {typeof listing.rating === "number" && listing.rating > 0 && (
            <span className="flex items-center gap-1 text-[12px] font-medium">
              <Star className="w-3 h-3 fill-foreground text-foreground" />
              {listing.rating.toFixed(2)}
            </span>
          )}
        </div>
        {listing.location && (
          <p className="text-[12px] text-[hsl(var(--bnb-foggy))] mt-0.5 line-clamp-1">{listing.location}</p>
        )}
        {listing.subtitle && (
          <p className="text-[12px] text-[hsl(var(--bnb-foggy))] line-clamp-1">{listing.subtitle}</p>
        )}
        <p className="text-[13px] mt-1">
          {listing.priceLabel ? (
            <span className="font-semibold">{listing.priceLabel}</span>
          ) : listing.price != null ? (
            <>
              <span className="font-semibold underline">${Math.round(listing.price).toLocaleString()}</span>
              {listing.priceUnit && <span className="text-[hsl(var(--bnb-foggy))]"> {listing.priceUnit}</span>}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
  return listing.href ? (
    <Link to={listing.href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function NavBtn({ side, onClick }: { side: "left" | "right"; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/90 backdrop-blur grid place-items-center shadow-bnb opacity-0 group-hover:opacity-100 transition-opacity",
        side === "left" ? "left-2" : "right-2"
      )}
      aria-label={side === "left" ? "Previous image" : "Next image"}
    >
      {side === "left" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );
}
