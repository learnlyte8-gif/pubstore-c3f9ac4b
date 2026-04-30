import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight, Briefcase, Tag, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/data/products";
import type { VerificationStatus } from "@/hooks/useVerification";

export type OnboardingStep = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  to: string;
  icon: any;
};

/**
 * Computes the supplier's onboarding state. The supplier is only allowed
 * to publish products once all three steps are done:
 *   1. Business details (name + country + about + business_type + phone/email)
 *   2. Category preferences (at least one preferred category)
 *   3. Identity verification approved
 */
export function buildOnboardingSteps(
  supplier: (Supplier & {
    business_type?: string | null;
    phone?: string | null;
    email?: string | null;
    categories?: string[];
    onboarding_completed_at?: string | null;
  }) | null,
  verification: VerificationStatus,
): OnboardingStep[] {
  const detailsDone = !!(
    supplier?.name &&
    supplier?.country &&
    supplier?.about &&
    supplier?.business_type &&
    (supplier?.phone || supplier?.email)
  );
  const categoriesDone = (supplier?.categories?.length ?? 0) > 0;
  const verificationDone = verification === "approved";

  return [
    {
      id: "details",
      label: "Business details",
      hint: detailsDone ? "Complete" : "Type, contact, country, about",
      done: detailsDone,
      to: "/store/profile",
      icon: Briefcase,
    },
    {
      id: "categories",
      label: "Category preferences",
      hint: categoriesDone ? `${supplier?.categories?.length} selected` : "Pick what you sell",
      done: categoriesDone,
      to: "/store/profile?step=categories",
      icon: Tag,
    },
    {
      id: "verification",
      label: "Identity verification",
      hint:
        verification === "approved" ? "Approved"
        : verification === "pending" ? "Under review"
        : verification === "rejected" ? "Rejected — re-submit"
        : "ID + proof of residency",
      done: verificationDone,
      to: "/verification",
      icon: ShieldCheck,
    },
  ];
}

export function isOnboardingComplete(steps: OnboardingStep[]) {
  return steps.every((s) => s.done);
}

export default function SupplierOnboarding({
  steps,
}: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  const allDone = done === steps.length;

  if (allDone) return null;

  return (
    <div className="mx-4 -mt-3 relative z-10 rounded-2xl bg-gradient-to-br from-primary via-primary/85 to-primary/65 text-primary-foreground p-4 shadow-elevated overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center backdrop-blur shrink-0">
          <Sparkles className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">Finish setup to publish</p>
          <p className="text-base font-extrabold leading-tight">{done} of {steps.length} steps complete</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-primary-foreground/20 overflow-hidden">
            <div className="h-full bg-primary-foreground transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="relative mt-3 space-y-1.5">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.id}
              to={s.to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/15 backdrop-blur transition"
            >
              {s.done ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 shrink-0 opacity-60" />
              )}
              <Icon className="w-4 h-4 opacity-80 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">{s.label}</p>
                <p className="text-[11px] opacity-80 truncate">{s.hint}</p>
              </div>
              {!s.done && <ChevronRight className="w-4 h-4 opacity-80" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Small inline blocker shown when the user tries to add a product
 * before finishing onboarding.
 */
export function OnboardingBlockedBanner({ steps }: { steps: OnboardingStep[] }) {
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  return (
    <div className="mx-4 mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-3">
      <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">Publishing locked</p>
        <p className="text-[11px] text-muted-foreground">Finish "{next.label}" to start listing.</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to={next.to}>Continue</Link>
      </Button>
    </div>
  );
}
