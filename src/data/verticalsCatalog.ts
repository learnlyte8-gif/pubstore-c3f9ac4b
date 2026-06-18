import {
  ShoppingBag, Briefcase, Newspaper, UtensilsCrossed, BedDouble, Car,
  Wrench, Factory, Sprout, Home as HomeIcon, Banknote, Navigation, Radio,
  type LucideIcon,
} from "lucide-react";

/**
 * Canonical list of "verticals" the user can opt into during onboarding.
 * The same slugs are stored on:
 *   - public.profiles.verticals (buyer interests — drives Home feed)
 *   - public.suppliers.verticals (supplier offerings — drives MyStore options)
 *
 * Empty array means "no preference" — show everything (back-compat).
 */
export type VerticalSlug =
  | "shop"
  | "jobs"
  | "news"
  | "restaurants"
  | "stays"
  | "vehicles"
  | "car_rentals"
  | "services"
  | "properties"
  | "finance"
  | "industrial"
  | "agro"
  | "rides"
  | "live";

export type Vertical = {
  slug: VerticalSlug;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Whether suppliers can pick this as something they "provide". */
  forSupplier: boolean;
};

export const VERTICALS: Vertical[] = [
  { slug: "shop",        label: "Marketplace",   hint: "Products, deals, suppliers",       icon: ShoppingBag,      forSupplier: true  },
  { slug: "restaurants", label: "Food & dining", hint: "Restaurants, menus, delivery",     icon: UtensilsCrossed,  forSupplier: true  },
  { slug: "agro",        label: "Agro",          hint: "Produce, machinery, livestock",    icon: Sprout,           forSupplier: true  },
  { slug: "stays",       label: "Stays",         hint: "Hotels, B&Bs, factory tours",      icon: BedDouble,        forSupplier: true  },
  { slug: "vehicles",    label: "Vehicles",      hint: "Cars, EVs, trucks, bikes",         icon: Car,              forSupplier: true  },
  { slug: "car_rentals", label: "Car rentals",   hint: "Self-drive rentals",               icon: Car,              forSupplier: true  },
  { slug: "properties",  label: "Real estate",   hint: "Rent or sell apartments, land",    icon: HomeIcon,         forSupplier: true  },
  { slug: "services",    label: "Local services",hint: "Plumbing, tutoring, freelance",    icon: Wrench,           forSupplier: true  },
  { slug: "industrial",  label: "Industrial",    hint: "Machinery, materials, capacity",   icon: Factory,          forSupplier: true  },
  { slug: "finance",     label: "Finance",       hint: "Loans, insurance, financing",      icon: Banknote,         forSupplier: true  },
  { slug: "rides",       label: "Rides",         hint: "Book or drive passengers",         icon: Navigation,       forSupplier: true  },
  { slug: "jobs",        label: "Jobs",          hint: "Listings, applications, network",  icon: Briefcase,        forSupplier: true  },
  { slug: "news",        label: "News",          hint: "Editorial & community stories",    icon: Newspaper,        forSupplier: false },
  { slug: "live",        label: "Live streams",  hint: "Shoppable live broadcasts",        icon: Radio,            forSupplier: false },
];

export const ALL_VERTICAL_SLUGS: VerticalSlug[] = VERTICALS.map((v) => v.slug);

/** True when the user picked this vertical, or has no preference at all. */
export function wantsVertical(selected: string[] | null | undefined, slug: VerticalSlug): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.includes(slug);
}
