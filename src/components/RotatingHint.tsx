import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/data/products";

const FALLBACK_HINTS = [
  "🎧 Wireless earbuds",
  "👜 Leather totes",
  "💄 Korean skincare",
  "🪴 Indoor planters",
  "🧘 Yoga mats",
  "🍳 Air fryers",
  "👕 Linen shirts",
  "💡 LED strip lights",
  "👟 Running sneakers",
  "📱 Phone cases",
];

function useLiveHints() {
  const { data } = useQuery({
    queryKey: ["search-hints-live"],
    queryFn: async () => {
      const top = await fetchProducts({ limit: 20, sortBy: "sold" as any });
      const titles = top
        .map((p: any) => p.title)
        .filter(Boolean)
        .map((t: string) => (t.length > 38 ? t.slice(0, 36) + "…" : t));
      return titles.length > 0 ? titles : FALLBACK_HINTS;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? FALLBACK_HINTS;
}

export default function RotatingHint({ className = "" }: { className?: string }) {
  const HINTS = useLiveHints();
  const [i, setI] = useState(0);
  const [enter, setEnter] = useState(true);

  useEffect(() => {
    setI(0);
  }, [HINTS.length]);

  useEffect(() => {
    const t = setInterval(() => {
      setEnter(false);
      setTimeout(() => {
        setI((v) => (v + 1) % HINTS.length);
        setEnter(true);
      }, 220);
    }, 2400);
    return () => clearInterval(t);
  }, [HINTS.length]);

  return (
    <span className={`inline-block overflow-hidden ${className}`} aria-live="polite">
      <span
        key={i}
        className={`inline-block transition-all duration-200 ${
          enter ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        {HINTS[i] ?? FALLBACK_HINTS[0]}
      </span>
    </span>
  );
}

// Re-export fallback for legacy imports; consumers should prefer useLiveHints
export const POPULAR_HINTS = FALLBACK_HINTS;
export { useLiveHints };
