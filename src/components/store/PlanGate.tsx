import { Link } from "react-router-dom";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import CircleSpinner from "@/components/CircleSpinner";
import { useSupplierPlan, FEATURE_LABEL, type SupplierFeature } from "@/hooks/useSupplierPlan";

export function usePlanFeature(feature: SupplierFeature) {
  const { can, loading, plan, upgradeFor } = useSupplierPlan();
  return { allowed: can(feature), loading, plan, requiredPlan: upgradeFor(feature) };
}

export function UpgradeNotice({
  feature,
  compact = false,
}: {
  feature: SupplierFeature;
  compact?: boolean;
}) {
  const { requiredPlan, plan } = usePlanFeature(feature);
  const label = FEATURE_LABEL[feature] ?? feature;
  const needed = requiredPlan?.name ?? "Pro";

  if (compact) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/40 p-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{label} is a {needed} feature</p>
          <p className="text-[11px] text-muted-foreground">You're on the {plan?.name ?? "Free"} plan.</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/store/plans">Upgrade</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-10">
      <div className="max-w-md mx-auto text-center rounded-3xl border bg-card p-6 shadow-card">
        <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Crown className="w-6 h-6" />
        </span>
        <h2 className="mt-3 text-lg font-bold">{label} needs the {needed} plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You're currently on the {plan?.name ?? "Free"} plan. Upgrade to unlock {label.toLowerCase()} and lower
          commission on every order.
        </p>
        <div className="mt-4 flex gap-2 justify-center">
          <Button asChild><Link to="/store/plans">See plans</Link></Button>
          <Button variant="outline" asChild><Link to="/store">Back to store</Link></Button>
        </div>
      </div>
    </div>
  );
}

/** Renders children only when the supplier's plan includes `feature`. */
export default function PlanGate({
  feature,
  children,
  compact = false,
}: {
  feature: SupplierFeature;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { allowed, loading } = usePlanFeature(feature);
  if (loading) return <div className="p-8 text-center"><CircleSpinner size={28} /></div>;
  if (!allowed) return <UpgradeNotice feature={feature} compact={compact} />;
  return <>{children}</>;
}
