import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BnbSearchValue {
  where: string;
  when: string;
  who: string;
}

export default function BnbSearchBar({
  value,
  placeholder = "Anywhere · Any week · Add guests",
  onOpen,
  onOpenFilters,
  className,
}: {
  value?: BnbSearchValue;
  placeholder?: string;
  onOpen: () => void;
  onOpenFilters?: () => void;
  className?: string;
}) {
  const hasValue = value && (value.where || value.when || value.who);
  return (
    <div className={cn("sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-[hsl(var(--bnb-card-border))]", className)}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
        <button
          onClick={onOpen}
          className="flex-1 flex items-center gap-3 h-14 pl-5 pr-2 rounded-full border border-[hsl(var(--bnb-card-border))] shadow-bnb bg-background hover:shadow-bnb-lg transition-shadow text-left"
        >
          <Search className="w-4 h-4 shrink-0 text-foreground" strokeWidth={3} />
          {hasValue ? (
            <div className="flex-1 min-w-0 flex items-center gap-2 text-[13px]">
              <span className="font-semibold truncate">{value?.where || "Anywhere"}</span>
              <span className="w-px h-4 bg-[hsl(var(--bnb-card-border))]" />
              <span className="text-[hsl(var(--bnb-foggy))] truncate">{value?.when || "Any week"}</span>
              <span className="w-px h-4 bg-[hsl(var(--bnb-card-border))]" />
              <span className="text-[hsl(var(--bnb-foggy))] truncate">{value?.who || "Add guests"}</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-foreground">Start your search</span>
              <span className="text-[11px] text-[hsl(var(--bnb-foggy))] truncate">{placeholder}</span>
            </div>
          )}
          <span className="ml-auto h-10 w-10 grid place-items-center rounded-full bg-[hsl(var(--bnb-rausch))] text-[hsl(var(--bnb-rausch-foreground))]">
            <Search className="w-4 h-4" strokeWidth={3} />
          </span>
        </button>
        {onOpenFilters && (
          <button
            onClick={onOpenFilters}
            className="h-11 w-11 grid place-items-center rounded-full border border-[hsl(var(--bnb-card-border))] hover:shadow-bnb bg-background"
            aria-label="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
