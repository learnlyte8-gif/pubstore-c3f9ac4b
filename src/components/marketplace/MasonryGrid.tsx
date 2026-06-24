import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface MasonryGridProps {
  children: React.ReactNode;
  className?: string;
  gap?: string;
}

export default function MasonryGrid({ children, className, gap = "gap-1" }: MasonryGridProps) {
  const isMobile = useIsMobile();
  const items = Array.isArray(children) ? children : [children];

  if (isMobile) {
    return (
      <div className={cn("flex flex-col", gap, className)}>
        {items}
      </div>
    );
  }

  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);

  return (
    <div className={cn("grid grid-cols-2 items-start", gap, className)}>
      <div className={cn("flex flex-col", gap)}>{left}</div>
      <div className={cn("flex flex-col", gap)}>{right}</div>
    </div>
  );
}

