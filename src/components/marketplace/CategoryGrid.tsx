import { CATEGORIES } from "@/data/products";

export default function CategoryGrid() {
  return (
    <section className="px-4 mt-4">
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 transition group"
          >
            <span className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-foreground/5 transition">
              <Icon className="w-5 h-5 text-foreground" strokeWidth={1.6} />
            </span>
            <span className="text-[11px] text-foreground font-medium leading-tight text-center">
              {name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
