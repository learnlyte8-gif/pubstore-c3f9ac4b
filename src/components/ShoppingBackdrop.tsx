import { ShoppingCart, ShoppingBag, Package, Tag, CreditCard, Gift, Heart, Star, Truck, Percent } from "lucide-react";

type Variant = "light" | "dark";

const ICONS = [ShoppingCart, ShoppingBag, Package, Tag, CreditCard, Gift, Heart, Star, Truck, Percent];

// Pre-positioned floating shopping icons. Deterministic so layout is stable.
const ITEMS = [
  { top: "6%",  left: "8%",  size: 36, delay: 0,    duration: 14, drift: 18, icon: 0, rotate: -8 },
  { top: "12%", left: "78%", size: 44, delay: 1.2,  duration: 16, drift: -22, icon: 1, rotate: 12 },
  { top: "22%", left: "42%", size: 28, delay: 2.4,  duration: 12, drift: 14, icon: 7, rotate: 0 },
  { top: "30%", left: "14%", size: 52, delay: 0.6,  duration: 18, drift: -16, icon: 2, rotate: -14 },
  { top: "36%", left: "84%", size: 32, delay: 3.0,  duration: 13, drift: 20, icon: 6, rotate: 8 },
  { top: "48%", left: "6%",  size: 40, delay: 1.8,  duration: 15, drift: 18, icon: 3, rotate: 18 },
  { top: "54%", left: "70%", size: 48, delay: 2.6,  duration: 17, drift: -20, icon: 4, rotate: -10 },
  { top: "62%", left: "38%", size: 30, delay: 0.4,  duration: 14, drift: 16, icon: 9, rotate: 6 },
  { top: "72%", left: "12%", size: 44, delay: 2.0,  duration: 16, drift: -18, icon: 5, rotate: -16 },
  { top: "78%", left: "80%", size: 36, delay: 1.0,  duration: 13, drift: 20, icon: 8, rotate: 14 },
  { top: "86%", left: "46%", size: 32, delay: 3.4,  duration: 15, drift: -14, icon: 0, rotate: 10 },
  { top: "92%", left: "22%", size: 28, delay: 0.8,  duration: 12, drift: 16, icon: 1, rotate: -6 },
];

interface Props {
  variant?: Variant;
  /** Opacity of the icons (0–1). Lower for subtle, higher for bold. */
  opacity?: number;
}

/**
 * Decorative animated shopping icons that float and drift in the background.
 * Pointer-events-none and aria-hidden so they don't interfere with content.
 */
const ShoppingBackdrop = ({ variant = "light", opacity = 0.18 }: Props) => {
  const colorClass = variant === "light" ? "text-white" : "text-foreground";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={{ opacity }}
    >
      {ITEMS.map((item, i) => {
        const Icon = ICONS[item.icon];
        return (
          <span
            key={i}
            className={`absolute ${colorClass} animate-float`}
            style={{
              top: item.top,
              left: item.left,
              ["--drift" as string]: `${item.drift}px`,
              ["--rot" as string]: `${item.rotate}deg`,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
            }}
          >
            <Icon
              size={item.size}
              strokeWidth={1.4}
              style={{ transform: `rotate(${item.rotate}deg)` }}
            />
          </span>
        );
      })}
    </div>
  );
};

export default ShoppingBackdrop;
