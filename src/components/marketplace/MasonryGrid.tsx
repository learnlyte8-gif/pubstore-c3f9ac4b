import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MasonryGridProps {
  children: React.ReactNode;
  className?: string;
  gap?: string;
}

/**
 * Responsive masonry grid that distributes items across N flex columns.
 *   mobile: 2 · md: 3 · lg: 4 · xl: 5
 * Items are placed left-to-right in row order so reading flow is preserved,
 * and each column stacks naturally — no blank gaps, no CSS-column reordering
 * artifacts when new items append during infinite scroll.
 */
export default function MasonryGrid({ children, className, gap = "gap-1" }: MasonryGridProps) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);

  const [cols, setCols] = useState<number>(() => {
    if (typeof window === "undefined") return 2;
    const w = window.innerWidth;
    if (w >= 1280) return 5;
    if (w >= 1024) return 4;
    if (w >= 768) return 3;
    return 2;
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : 2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const columns: React.ReactNode[][] = Array.from({ length: cols }, () => []);
  items.forEach((child, i) => {
    columns[i % cols].push(
      <div key={i} className="w-full">
        {child}
      </div>,
    );
  });

  return (
    <div className={cn("flex w-full", gap, className)}>
      {columns.map((col, idx) => (
        <div key={idx} className={cn("flex-1 min-w-0 flex flex-col", gap)}>
          {col}
        </div>
      ))}
    </div>
  );
}
