import { Heart, Send, Users } from "lucide-react";
import { useToggleLike, useLikeCount, type LikeTarget, logShare } from "@/hooks/useSocial";
import { toast } from "sonner";

interface Props {
  target: LikeTarget;
  id: string;
  shareUrl?: string;
  shareTitle?: string;
  showCount?: boolean;
  onShareToChat?: () => void;
  onGroupBuy?: () => void;
  size?: "sm" | "md";
}

/** Compact like + share row used on cards and product pages. */
export default function SocialActions({
  target, id, shareUrl, shareTitle, showCount = true,
  onShareToChat, onGroupBuy, size = "md",
}: Props) {
  const { liked, toggle } = useToggleLike(target, id);
  const { data: count = 0 } = useLikeCount(target, id);
  const iconClass = size === "sm" ? "w-5 h-5" : "w-6 h-6";

  const handleShare = async () => {
    const url = shareUrl ?? window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
      logShare({ target, id, channel: navigator.share ? "external" : "copy" });
    } catch {/* user cancelled */}
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        aria-label={liked ? "Unlike" : "Like"}
        className="flex items-center gap-1 active:scale-90 transition"
      >
        <Heart
          className={`${iconClass} ${liked ? "fill-destructive text-destructive scale-110" : ""}`}
          strokeWidth={1.8}
        />
        {showCount && count > 0 && (
          <span className="text-xs font-semibold tabular-nums">{count}</span>
        )}
      </button>
      <button
        onClick={onShareToChat ?? handleShare}
        aria-label="Share"
        className="active:scale-90 transition"
      >
        <Send className={iconClass} strokeWidth={1.8} />
      </button>
      {onGroupBuy && (
        <button
          onClick={onGroupBuy}
          aria-label="Buy together"
          className="active:scale-90 transition flex items-center gap-1 text-xs font-bold"
        >
          <Users className={iconClass} strokeWidth={1.8} />
          <span className="hidden xs:inline">Group</span>
        </button>
      )}
    </div>
  );
}
