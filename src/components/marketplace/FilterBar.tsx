import { Search, SlidersHorizontal, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ChipOption = { id: string; label: string; icon?: React.ComponentType<{ className?: string }> };

type Tone = "light" | "dark" | "newsprint" | "blueprint";

const TONES: Record<Tone, {
  bar: string;
  input: string;
  chipBase: string;
  chipActive: string;
  chipIdle: string;
  iconBtn: string;
  badge: string;
  resetBtn: string;
}> = {
  light: {
    bar: "bg-card border border-border",
    input: "bg-background",
    chipBase: "rounded-full",
    chipActive: "bg-foreground text-background",
    chipIdle: "bg-muted text-foreground hover:bg-muted/70",
    iconBtn: "bg-muted hover:bg-muted/70 text-foreground",
    badge: "bg-primary text-primary-foreground",
    resetBtn: "text-muted-foreground hover:text-foreground",
  },
  dark: {
    bar: "bg-zinc-900 ring-1 ring-zinc-100/10",
    input: "bg-zinc-950 text-zinc-50 border-zinc-800 placeholder:text-zinc-500",
    chipBase: "rounded-sm font-mono uppercase tracking-wider",
    chipActive: "bg-zinc-50 text-zinc-950",
    chipIdle: "bg-zinc-950 text-zinc-300 hover:bg-zinc-800 ring-1 ring-zinc-100/10",
    iconBtn: "bg-zinc-950 text-zinc-200 ring-1 ring-zinc-100/10 hover:bg-zinc-800",
    badge: "bg-emerald-400 text-zinc-950",
    resetBtn: "text-zinc-400 hover:text-zinc-50",
  },
  newsprint: {
    bar: "bg-background border border-foreground/15",
    input: "bg-background",
    chipBase: "rounded-full uppercase tracking-wider",
    chipActive: "bg-foreground text-background border border-foreground",
    chipIdle: "bg-background text-foreground border border-foreground/20 hover:border-foreground/50",
    iconBtn: "bg-background border border-foreground/20 hover:border-foreground/50 text-foreground",
    badge: "bg-foreground text-background",
    resetBtn: "text-muted-foreground hover:text-foreground",
  },
  blueprint: {
    bar: "bg-card border border-sky-200/60 dark:border-sky-900/60",
    input: "bg-background",
    chipBase: "rounded-md flex items-center gap-1.5",
    chipActive: "bg-sky-950 text-sky-50",
    chipIdle: "bg-muted text-foreground hover:bg-muted/70",
    iconBtn: "bg-muted text-foreground hover:bg-muted/70",
    badge: "bg-sky-500 text-white",
    resetBtn: "text-muted-foreground hover:text-foreground",
  },
};

type Props = {
  tone?: Tone;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  chips?: ChipOption[];
  chipValue?: string;
  onChipChange?: (id: string) => void;
  /** Additional dropdown content (price/sort/etc.) */
  advanced?: ReactNode;
  activeAdvancedCount?: number;
  /** Show reset button when any filter active */
  canReset?: boolean;
  onReset?: () => void;
  /** Right-side trailing slot (e.g. result count) */
  trailing?: ReactNode;
};

export function FilterBar({
  tone = "light",
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  chips,
  chipValue,
  onChipChange,
  advanced,
  activeAdvancedCount = 0,
  canReset,
  onReset,
  trailing,
}: Props) {
  const t = TONES[tone];
  // Local debounce so URL updates don't yank focus on every keystroke.
  const [local, setLocal] = useState(search);
  useEffect(() => setLocal(search), [search]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== search) onSearchChange(local);
    }, 180);
    return () => clearTimeout(id);
  }, [local, search, onSearchChange]);

  return (
    <div className={`mx-4 mt-4 rounded-2xl p-2.5 shadow-card animate-fade-in ${t.bar}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={searchPlaceholder}
            className={`h-9 pl-8 pr-8 text-[13px] ${t.input}`}
          />
          {local && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setLocal("");
                onSearchChange("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {advanced && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`relative h-9 w-9 rounded-md flex items-center justify-center transition ${t.iconBtn}`}
                aria-label="Advanced filters"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeAdvancedCount > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${t.badge}`}>
                    {activeAdvancedCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 rounded-xl">
              {advanced}
            </PopoverContent>
          </Popover>
        )}

        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className={`h-9 px-2 text-[11px] font-bold uppercase tracking-wider transition ${t.resetBtn}`}
          >
            Reset
          </button>
        )}
      </div>

      {chips && chips.length > 0 && (
        <div className="mt-2 -mx-0.5 px-0.5 flex gap-1.5 overflow-x-auto scrollbar-none">
          {chips.map((c) => {
            const Icon = c.icon;
            const active = (chipValue ?? "") === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChipChange?.(c.id)}
                className={`shrink-0 px-3 h-7 text-[10px] font-bold flex items-center gap-1.5 transition-all duration-200 ${t.chipBase} ${
                  active ? `${t.chipActive} scale-[1.02]` : t.chipIdle
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {trailing && <div className="mt-2 text-[11px] text-muted-foreground">{trailing}</div>}
    </div>
  );
}

/** Reusable bits for the advanced popover */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function SortPills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-2.5 h-7 rounded-md text-[11px] font-semibold transition ${
              active ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
