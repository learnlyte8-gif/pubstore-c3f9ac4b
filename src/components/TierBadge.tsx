import { Award, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tier } from "@/hooks/useUserTier";

const META: Record<Tier, { label: string; icon: typeof Award; classes: string }> = {
  bronze: {
    label: "Bronze",
    icon: Medal,
    classes: "bg-amber-700/15 text-amber-800 dark:text-amber-300 border-amber-700/30",
  },
  silver: {
    label: "Silver",
    icon: Award,
    classes: "bg-slate-400/20 text-slate-700 dark:text-slate-200 border-slate-400/40",
  },
  gold: {
    label: "Gold",
    icon: Trophy,
    classes: "bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/50",
  },
};

export default function TierBadge({
  tier,
  role = "buyer",
  size = "sm",
  className,
}: {
  tier: Tier;
  role?: "buyer" | "supplier";
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const m = META[tier] ?? META.bronze;
  const Icon = m.icon;
  const sizing =
    size === "xs"
      ? "px-1.5 py-0.5 text-[9px] gap-0.5"
      : size === "md"
      ? "px-2.5 py-1 text-xs gap-1.5"
      : "px-2 py-0.5 text-[10px] gap-1";
  const iconSize = size === "md" ? "w-3.5 h-3.5" : size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold uppercase tracking-wider border",
        m.classes,
        sizing,
        className,
      )}
      title={`${m.label} ${role}`}
    >
      <Icon className={iconSize} strokeWidth={2.5} />
      {m.label}
    </span>
  );
}
