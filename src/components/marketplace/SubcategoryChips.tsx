import type { Subcategory } from "@/lib/subcategories";

interface Props {
  subs: Subcategory[];
  active: string | null;
  onChange: (id: string | null) => void;
}

export default function SubcategoryChips({ subs, active, onChange }: Props) {
  if (!subs.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none px-3 py-2 border-b bg-card/60">
      <button
        onClick={() => onChange(null)}
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
          active === null
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-foreground border-border hover:bg-muted"
        }`}
      >
        All
      </button>
      {subs.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onChange(isActive ? null : s.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            <span>{s.label}</span>
            <span className={`text-[10px] ${isActive ? "opacity-90" : "text-muted-foreground"}`}>
              {s.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
