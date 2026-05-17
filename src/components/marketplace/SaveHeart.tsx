import { Heart } from "lucide-react";
import { useSaves, type SaveKind, type SaveSnapshot } from "@/hooks/useSaves";
import { cn } from "@/lib/utils";

type Props = {
  kind: SaveKind;
  itemId: string;
  snapshot?: SaveSnapshot;
  className?: string;
  size?: number;
};

export default function SaveHeart({ kind, itemId, snapshot, className, size = 14 }: Props) {
  const { isSaved, toggle } = useSaves(kind);
  const saved = isSaved(itemId);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(itemId, snapshot); }}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "rounded-full bg-background/90 backdrop-blur shadow-soft flex items-center justify-center transition-transform active:scale-90 hover:bg-background",
        className ?? "w-7 h-7",
      )}
    >
      <Heart
        style={{ width: size, height: size }}
        className={saved ? "fill-destructive text-destructive" : "text-foreground"}
      />
    </button>
  );
}
