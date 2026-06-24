import { useProducts } from "@/hooks/useCatalog";
import ProductCard from "./ProductCard";
import MasonryGrid from "./MasonryGrid";

export default function NewArrivals() {
  const { data = [] } = useProducts({ sortBy: "newest", limit: 12 });
  if (data.length === 0) return null;
  return (
    <MasonryGrid className="mt-3">
      {data.map((p) => (
        <ProductCard key={`new-${p.id}`} product={p} />
      ))}
    </MasonryGrid>
  );
}
