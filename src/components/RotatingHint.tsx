import { useEffect, useState } from "react";

const HINTS = [
  "🎧 Wireless earbuds",
  "👜 Leather totes",
  "💄 Korean skincare",
  "🪴 Indoor planters",
  "🧘 Yoga mats bulk",
  "🍳 Air fryers wholesale",
  "👕 Linen shirts",
  "💡 LED strip lights",
  "👟 Running sneakers",
  "📱 Phone cases",
  "🛋️ Velvet cushions",
  "🧴 Glass dropper bottles",
  "⌚ Smart watches",
  "🎒 Travel backpacks",
  "🍵 Matcha sets",
  "🪞 LED vanity mirrors",
  "🧢 Embroidered caps",
  "🛁 Bath bombs",
  "🪥 Bamboo toothbrushes",
  "🧦 Cotton sock bundles",
];

export default function RotatingHint({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  const [enter, setEnter] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setEnter(false);
      setTimeout(() => {
        setI((v) => (v + 1) % HINTS.length);
        setEnter(true);
      }, 220);
    }, 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <span className={`inline-block overflow-hidden ${className}`} aria-live="polite">
      <span
        key={i}
        className={`inline-block transition-all duration-200 ${
          enter ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        {HINTS[i]}
      </span>
    </span>
  );
}

export const POPULAR_HINTS = HINTS;
