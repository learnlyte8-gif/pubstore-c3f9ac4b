import { useEffect, useRef } from "react";
import CircleSpinner from "@/components/CircleSpinner";

interface Props {
  /** Called when the sentinel scrolls into view. */
  onLoadMore: () => void;
  /** Whether more pages exist. */
  hasMore: boolean;
  /** Whether a fetch is currently in flight. */
  isLoading?: boolean;
  /** Distance (px) before the bottom at which to prefetch. */
  rootMargin?: string;
}

/**
 * Invisible div that triggers `onLoadMore` when it enters the viewport.
 * Render at the bottom of any paginated list.
 */
export default function InfiniteScrollSentinel({
  onLoadMore,
  hasMore,
  isLoading,
  rootMargin = "600px 0px",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isLoading) onLoadMore();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, onLoadMore, rootMargin]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="col-span-full flex justify-center py-6">
      {isLoading ? <CircleSpinner size={24} /> : <div className="h-6" />}
    </div>
  );
}
