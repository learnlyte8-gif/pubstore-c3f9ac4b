import { useState } from "react";
import { Banknote, Percent, Calendar, FileText, MessageCircle, Car, TrendingUp, ShieldCheck, Wallet } from "lucide-react";
import { fetchFinanceProducts, FINANCE_KINDS, type FinanceProduct } from "@/data/newVerticals";
import FinanceApplicationDialog from "@/components/marketplace/FinanceApplicationDialog";
import BnbVerticalScreen from "@/components/bnb/BnbVerticalScreen";

const KIND_ICONS: Record<string, any> = {
  loan: Wallet,
  vehicle_financing: Car,
  working_capital: TrendingUp,
  insurance: ShieldCheck,
};

const BNB_FINANCE_CATS = [
  { slug: "all", label: "All", icon: Banknote },
  ...FINANCE_KINDS.map((k) => ({ slug: k.slug, label: k.label, icon: KIND_ICONS[k.slug] ?? Banknote })),
];

export default function Finance() {
  const [applyFor, setApplyFor] = useState<FinanceProduct | null>(null);

  return (
    <>
      <BnbVerticalScreen
        queryKey={["bnb-finance"]}
        fetcher={(cat) => fetchFinanceProducts(cat === "all" ? { limit: 60 } : { kind: cat, limit: 60 })}
        categories={BNB_FINANCE_CATS}
        units="none"
        saveKind="finance"
        wherePlaceholder="Search lenders or products"
        emptyLabel="No finance products available"
        toListing={(p) => ({
          id: p.id,
          title: p.title,
          location: [p.city, p.country].filter(Boolean).join(", ") || p.provider_name || null,
          subtitle: [
            p.interest_rate != null ? `${p.interest_rate}% APR` : null,
            p.term_months ? `${p.term_months} mo` : null,
          ].filter(Boolean).join(" · "),
          images: [p.cover, ...(p.gallery ?? [])].filter(Boolean) as string[],
          priceLabel: p.min_amount || p.max_amount
            ? `$${p.min_amount?.toLocaleString() ?? "0"}–$${p.max_amount?.toLocaleString() ?? "∞"}`
            : "Apply for terms",
          badge: p.featured ? "Featured" : null,
        })}
      />
      {applyFor && (
        <FinanceApplicationDialog
          product={applyFor}
          open={!!applyFor}
          onOpenChange={(v) => !v && setApplyFor(null)}
        />
      )}
    </>
  );
}
