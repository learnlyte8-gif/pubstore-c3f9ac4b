import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BnbCategory {
  slug: string;
  label: string;
  icon: LucideIcon;
}

export default function BnbCategoryRail({
  categories,
  value,
  onChange,
}: {
  categories: BnbCategory[];
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="sticky top-[76px] z-20 bg-background/95 backdrop-blur-xl border-b border-[hsl(var(--bnb-card-border))]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-4 py-2">
          {categories.map((c) => {
            const active = c.slug === value;
            const Icon = c.icon;
            return (
              <button
                key={c.slug}
                onClick={() => onChange(c.slug)}
                className={cn(
                  "shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 min-w-[64px] group relative",
                  active ? "text-foreground" : "text-[hsl(var(--bnb-foggy))] hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", active && "text-foreground")} strokeWidth={active ? 2.2 : 1.6} />
                <span className={cn("text-[11px] whitespace-nowrap", active ? "font-semibold" : "font-medium")}>
                  {c.label}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-2 left-0 right-0 h-0.5 rounded-full transition-all",
                    active ? "bg-foreground scale-x-100" : "bg-transparent scale-x-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
