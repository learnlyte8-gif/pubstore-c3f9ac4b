import { cn } from "@/lib/utils";

interface MasonryGridProps {
  children: React.ReactNode;
  className?: string;
  gap?: string;
}

/**
 * Responsive masonry-style staggered grid.
 *  - mobile: 2 columns
 *  - md:     3 columns
 *  - lg:     4 columns
 *  - xl:     5 columns
 * Cards keep their natural heights — no forced stretch, no blank gaps.
 * Uses CSS multi-column layout so any number of children flow correctly.
 */
export default function MasonryGrid({ children, className, gap = "gap-1" }: MasonryGridProps) {
  const items = Array.isArray(children) ? children : [children];
  // Map our gap tokens to a matching column-gap. Defaults to 0.25rem (gap-1).
  const colGapClass =
    gap.includes("gap-2") ? "[column-gap:0.5rem]" :
    gap.includes("gap-3") ? "[column-gap:0.75rem]" :
    gap.includes("gap-4") ? "[column-gap:1rem]" :
    "[column-gap:0.25rem]";

  const itemSpaceClass =
    gap.includes("gap-2") ? "mb-2" :
    gap.includes("gap-3") ? "mb-3" :
    gap.includes("gap-4") ? "mb-4" :
    "mb-1";

  return (
    <div
      className={cn(
        "columns-2 md:columns-3 lg:columns-4 xl:columns-5",
        colGapClass,
        className,
      )}
    >
      {items.map((child, i) => (
        <div key={i} className={cn("break-inside-avoid", itemSpaceClass)}>
          {child}
        </div>
      ))}
    </div>
  );
}
