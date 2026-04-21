import { Link } from "react-router-dom";
import { useCategories } from "@/hooks/useCatalog";

export default function CategoryGrid() {
  const { data: cats = [] } = useCategories();
  const list = cats.slice(0, 10);

  if (list.length === 0) return null;

  return (
    <section className="px-4 mt-4">
      <div className="grid grid-cols-5 gap-2">
        {list.map(({ id, name, icon: Icon }) => (
          <Link
            to={`/categories?cat=${encodeURIComponent(id)}`}
            key={id}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 transition group"
          >
            <span className="w-12 h-12 rounded-2xl bg-card flex items-center justify-center shadow-card group-hover:shadow-elevated group-hover:-translate-y-0.5 transition">
              <Icon className="w-5 h-5 text-foreground" strokeWidth={1.6} />
            </span>
            <span className="text-[11px] text-foreground font-medium leading-tight text-center">
              {name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
