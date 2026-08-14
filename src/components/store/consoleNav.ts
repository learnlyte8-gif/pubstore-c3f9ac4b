import { Package, BarChart3, Megaphone, Truck, Star, ShoppingBag, MessageCircle, Settings, Download, BedDouble, Car, Factory, Newspaper, Navigation, Wrench, Home as HomeIcon, Banknote, Sprout, Inbox, UtensilsCrossed, Crown, Store, LayoutDashboard } from "lucide-react";

export type ConsoleNavItem = {
  icon: any;
  label: string;
  to: string;
  /** optional secondary "actions" destination (per-vertical inbox) */
  manageTo?: string;
  /** vertical slug used to filter by what the supplier provides */
  slug?: string;
  /** only visible to internal/admin accounts */
  adminOnly?: boolean;
};

export type ConsoleNavGroup = { title: string; items: ConsoleNavItem[] };

export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    title: "Overview",
    items: [{ icon: LayoutDashboard, label: "Dashboard", to: "/store" }],
  },
  {
    title: "Manage",
    items: [
      { icon: Package, label: "Products", to: "/store/products" },
      { icon: Download, label: "Import from the web", to: "/store/import", adminOnly: true },
      { icon: ShoppingBag, label: "Orders", to: "/store/orders" },
      { icon: Inbox, label: "Actions inbox", to: "/store/actions" },
      { icon: Truck, label: "Shipping & logistics", to: "/store/shipping" },
      { icon: MessageCircle, label: "Customer messages", to: "/messages" },
    ],
  },
  {
    title: "Grow",
    items: [
      { icon: Megaphone, label: "PUBSTORE Ads", to: "/store/ads" },
      { icon: Megaphone, label: "Promotions & coupons", to: "/store/promote" },
      { icon: BarChart3, label: "Analytics & insights", to: "/store/analytics" },
      { icon: Star, label: "Reviews", to: "/store/reviews" },
    ],
  },
  {
    title: "Services & verticals",
    items: [
      { slug: "restaurants", icon: UtensilsCrossed, label: "Restaurants & food", to: "/restaurants" },
      { slug: "agro", icon: Sprout, label: "Agro listings", to: "/store/services/agro", manageTo: "/store/services/agro?tab=actions" },
      { slug: "stays", icon: BedDouble, label: "Stays & B&B", to: "/store/services/stays", manageTo: "/store/services/stays?tab=actions" },
      { slug: "vehicles", icon: Car, label: "Vehicles", to: "/store/services/vehicles", manageTo: "/store/services/vehicles?tab=actions" },
      { slug: "industrial", icon: Factory, label: "Industrial listings", to: "/store/services/industrial", manageTo: "/store/services/industrial?tab=actions" },
      { slug: "rides", icon: Navigation, label: "Ride driver", to: "/store/services/driver", manageTo: "/store/services/driver?tab=actions" },
      { slug: "services", icon: Wrench, label: "Local services", to: "/store/services/pros", manageTo: "/store/services/pros?tab=actions" },
      { slug: "properties", icon: HomeIcon, label: "Real estate", to: "/store/services/properties", manageTo: "/store/services/properties?tab=actions" },
      { slug: "shop", icon: Truck, label: "Courier / logistics", to: "/store/services/logistics", manageTo: "/store/services/logistics?tab=actions" },
      { slug: "finance", icon: Banknote, label: "Finance products", to: "/store/services/finance", manageTo: "/store/services/finance?tab=actions" },
      { slug: "car_rentals", icon: Car, label: "Car rentals", to: "/store/services/car-rentals", manageTo: "/store/services/car-rentals?tab=actions" },
      { icon: Newspaper, label: "News & editorial", to: "/store/services/news", manageTo: "/store/services/news?tab=actions", adminOnly: true },
    ],
  },
  {
    title: "Storefront",
    items: [
      { icon: Crown, label: "Selling plan & commission", to: "/store/plans" },
      { icon: Store, label: "Store profile", to: "/store/profile" },
      { icon: Settings, label: "Store settings", to: "/store/settings" },
    ],
  },
];

/** Human label for a console tab, derived from the pathname. */
export function labelForPath(pathname: string, search = ""): string {
  const all = consoleNavGroups.flatMap((g) => g.items);
  const withSearch = `${pathname}${search}`;
  const exact = all.find((i) => i.manageTo === withSearch);
  if (exact) return `${exact.label} · actions`;
  const hit = all.find((i) => i.to === pathname);
  if (hit) return hit.label;
  // fall back to prettified last segment(s)
  const segs = pathname.replace(/^\/store\/?/, "").split("/").filter(Boolean);
  if (segs.length === 0) return "Dashboard";
  const pretty = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  if (segs[0] === "products" && segs[1] === "new") return "New product";
  if (segs[0] === "ads" && segs[1] === "new") return "New campaign";
  return pretty(segs[segs.length - 1]);
}
