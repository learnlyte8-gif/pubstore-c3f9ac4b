import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";
import { fetchProperties, type Property } from "@/data/newVerticals";
import { Home as HomeIcon, Building2, DoorOpen, MapPin, Warehouse, Sparkles as SparklesIcon } from "lucide-react";

const BNB_PROPERTY_CATS = [
  { slug: "all", label: "All", icon: SparklesIcon },
  { slug: "apartment", label: "Apartments", icon: Building2 },
  { slug: "house", label: "Houses", icon: HomeIcon },
  { slug: "room", label: "Rooms", icon: DoorOpen },
  { slug: "land", label: "Land", icon: MapPin },
  { slug: "commercial", label: "Commercial", icon: Warehouse },
];

export default function Properties() {
  return (
    <BnbVerticalScreen
      queryKey={["bnb-properties"]}
      fetcher={(cat) =>
        fetchProperties({
          property_kind: cat === "all" ? undefined : cat,
          limit: 80,
        })
      }
      categories={BNB_PROPERTY_CATS}
      units="occupants"
      saveKind="property"
      wherePlaceholder="Search cities or neighbourhoods"
      emptyLabel="No properties match your search"
      toListing={(p: Property) => ({
        id: p.id,
        title: p.title,
        location: [p.city, p.country].filter(Boolean).join(", ") || null,
        subtitle: [
          p.bedrooms ? `${p.bedrooms} bd` : null,
          p.baths ? `${p.baths} ba` : null,
          p.area_sqm ? `${p.area_sqm}m²` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        images: [p.cover, ...(p.gallery ?? [])].filter(Boolean) as string[],
        price: p.price,
        priceUnit: p.price_period ? p.price_period : null,
        badge: p.featured ? "Featured" : p.listing_type === "sale" ? "For sale" : null,
        href: `/properties/${p.id}`,
      })}
      toPin={(p) =>
        p.lat != null && p.lng != null
          ? {
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              label: `$${Math.round(p.price / 1000)}k`,
              title: p.title,
              image: p.cover ?? undefined,
              href: `/properties/${p.id}`,
            }
          : null
      }
    />
  );
}
