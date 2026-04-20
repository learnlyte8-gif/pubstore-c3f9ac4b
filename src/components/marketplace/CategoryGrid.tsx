import { CATEGORIES } from "@/data/products";

export default function CategoryGrid() {
  return (
    <section className="px-4 mt-4">
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 transition"
          >
            <span
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center text-2xl shadow-sm`}
            >
              {c.emoji}
            </span>
            <span className="text-[11px] text-foreground font-medium leading-tight text-center">
              {c.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
