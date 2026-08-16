import {
  LayoutDashboard, ShieldCheck, CreditCard, Banknote, RotateCcw, Star, Settings as SettingsIcon,
  Users, Store, Package, ShoppingBag, Flag, Megaphone, Newspaper, Ticket, Sparkles, Crown, MessageSquare,
  TrendingUp,
} from "lucide-react";

export type AdminNavItem = { icon: any; label: string; section: string };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

/** section === "" is the console home (/admin) */
export const adminNavGroups: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", section: "" },
      { icon: TrendingUp, label: "Revenue & profit", section: "revenue" },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { icon: ShieldCheck, label: "Identity verification", section: "verifications" },
      { icon: Flag, label: "Reports & abuse", section: "reports" },
      { icon: Star, label: "Reviews", section: "reviews" },
      { icon: MessageSquare, label: "Trade assurance", section: "assurance" },
    ],
  },
  {
    title: "Money",
    items: [
      { icon: CreditCard, label: "Manual top-ups", section: "topups" },
      { icon: Banknote, label: "Withdrawals", section: "withdrawals" },
      { icon: RotateCcw, label: "Refunds", section: "refunds" },
      { icon: ShoppingBag, label: "Orders & escrow", section: "orders" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { icon: Store, label: "Stores", section: "suppliers" },
      { icon: Package, label: "Products", section: "products" },
      { icon: Megaphone, label: "Ad campaigns", section: "ads" },
      { icon: Ticket, label: "Coupons", section: "coupons" },
      { icon: Newspaper, label: "News & editorial", section: "news" },
    ],
  },
  {
    title: "People & platform",
    items: [
      { icon: Users, label: "Users & roles", section: "users" },
      { icon: Sparkles, label: "AI credits", section: "ai" },
      { icon: Crown, label: "Plans & commission", section: "plans" },
      { icon: SettingsIcon, label: "Platform settings", section: "settings" },
    ],
  },
];

export const adminSections = adminNavGroups.flatMap((g) => g.items);

export function adminLabelForSection(section: string) {
  return adminSections.find((i) => i.section === section)?.label ?? "Dashboard";
}
